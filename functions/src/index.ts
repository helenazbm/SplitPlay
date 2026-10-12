/**
 * Cálculo autoritativo da conta no servidor.
 */

import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger, setGlobalOptions } from "firebase-functions/v2";

import { AiError, MenuReaderClient, aiSecrets, type UsageSink } from "./ai";
import {
  isItemInCurrentRound,
  reaisToCents,
  userSubtotalCents,
  userTotalCents,
  type BillItem,
} from "./billing";
import {
  MAX_MENU_ITEMS,
  MAX_MENU_READS_PER_TABLE,
  MenuValidationError,
  describeAiFailure,
  planLinkedItemUpdate,
  sanitizeMenuItems,
  sanitizeMenuName,
} from "./menu";

setGlobalOptions({
  region: "southamerica-east1",
  maxInstances: 10,
  memory: "256MiB",
});

initializeApp();
const db = getFirestore();
const MAX_EVENT_AGE_MS = 3 * 60 * 1000;

function tooOldToRetry(eventTime: string, tableId: string): boolean {
  if (Date.now() - Date.parse(eventTime) <= MAX_EVENT_AGE_MS) {
    return false;
  }
  logger.error("Evento antigo demais — desistindo do reprocessamento", {
    tableId,
    eventTime,
  });
  return true;
}

function toMillis(value: unknown): number | null {
  if (value && typeof (value as { toMillis?: unknown }).toMillis === "function") {
    return (value as { toMillis: () => number }).toMillis();
  }
  return null;
}

/** Lê os itens (com compat para o campo antigo `consumerUid`) de um snapshot. */
function toBillItems(
  docs: FirebaseFirestore.QueryDocumentSnapshot[],
): BillItem[] {
  return docs.map((doc) => {
    const data = doc.data();
    const ownerUid = String(data.ownerUid ?? "");

    let consumerUids: string[] = [];
    if (Array.isArray(data.consumerUids)) {
      consumerUids = data.consumerUids.map((uid: unknown) => String(uid));
    } else if (data.consumerUid) {
      consumerUids = [String(data.consumerUid)];
    } else if (ownerUid) {
      consumerUids = [ownerUid];
    }

    // pendingInvites nunca entra no rateio — só quem já aceitou divide o item.
    return {
      price: Number(data.price ?? 0),
      consumerUids,
      createdAtMs: toMillis(data.createdAt),
    };
  });
}

/** Rodada de consumo atual do participante (ver `settledThroughAt`). */
function roundOf(participant: FirebaseFirestore.DocumentSnapshot) {
  return {
    settledThroughMs: toMillis(participant.get("settledThroughAt")),
    couvertSettled: participant.get("couvertSettled") === true,
  };
}

/**
 * Recalcula e persiste `subtotalCents` e `totalCents` de cada participante da
 * mesa. Tudo numa transação: lê mesa + itens + participantes e grava apenas as
 * diferenças (idempotente — se nada mudou, não escreve, o que evita laços com o
 * gatilho de participantes).
 *
 * - subtotalCents = couvert (por pessoa) + soma das partes nos itens.
 * - totalCents    = subtotal + gorjeta, quando o participante optou por incluí-la.
 */
async function recomputeBill(tableId: string): Promise<void> {
  const tableRef = db.doc(`tables/${tableId}`);
  const itemsRef = db.collection(`tables/${tableId}/items`);
  const participantsRef = db.collection(`tables/${tableId}/participants`);

  await db.runTransaction(async (tx) => {
    // Todas as leituras antes de qualquer escrita (exigência de transação).
    const [tableSnap, itemsSnap, participantsSnap] = await Promise.all([
      tx.get(tableRef),
      tx.get(itemsRef),
      tx.get(participantsRef),
    ]);

    if (!tableSnap.exists) {
      return;
    }

    const couvert = Number(tableSnap.get("couvertSuggested") ?? 0);
    const tipPercent = Number(tableSnap.get("tipPercent") ?? 0);
    const items = toBillItems(itemsSnap.docs);

    let updated = 0;
    participantsSnap.docs.forEach((participant) => {
      const subtotal = userSubtotalCents(
        participant.id,
        items,
        couvert,
        roundOf(participant),
      );
      const tipEnabled = participant.get("tipEnabled") === true;
      const total = userTotalCents(subtotal, tipPercent, tipEnabled);

      const changes: { subtotalCents?: number; totalCents?: number } = {};
      if (Number(participant.get("subtotalCents") ?? 0) !== subtotal) {
        changes.subtotalCents = subtotal;
      }
      if (Number(participant.get("totalCents") ?? 0) !== total) {
        changes.totalCents = total;
      }

      if (Object.keys(changes).length > 0) {
        tx.update(participant.ref, changes);
        updated += 1;
      }
    });

    logger.info("Conta recalculada", { tableId, updated });
  });
}

/**
 * Se um item ficou sem ninguém (nem consumidor aceito, nem convite
 * pendente), apaga o doc. Idempotente: se ainda houver alguém em qualquer um
 * dos dois arrays, não faz nada. Retorna `true` se apagou.
 *
 * A transação revalida os arrays porque o snapshot do evento pode estar
 * desatualizado — alguém pode ter aceitado o convite nesse intervalo.
 */
async function maybeDeleteEmptyItem(
  tableId: string,
  itemId: string,
): Promise<boolean> {
  const itemRef = db.doc(`tables/${tableId}/items/${itemId}`);

  return db.runTransaction(async (tx) => {
    const snap = await tx.get(itemRef);
    if (!snap.exists) {
      return false;
    }

    const consumerUids: string[] = snap.get("consumerUids") ?? [];
    const pendingInvites: string[] = snap.get("pendingInvites") ?? [];
    if (consumerUids.length > 0 || pendingInvites.length > 0) {
      return false;
    }

    tx.delete(itemRef);

    logger.info("Item apagado (sem participantes)", { tableId, itemId });
    return true;
  });
}

/**
 * Assinatura dos campos do item que ENTRAM na conta: preço, quem divide e a
 * rodada a que pertence. Renomear, trocar o ícone, mudar a quantidade, marcar
 * `settled` ou movimentar `pendingInvites` não altera o valor de ninguém —
 * convite só pesa na conta quando vira `consumerUids`, no aceite.
 */
function billingSignature(
  snapshot: FirebaseFirestore.DocumentSnapshot | undefined,
): string | null {
  if (!snapshot?.exists) {
    return null;
  }

  const [item] = toBillItems([
    snapshot as FirebaseFirestore.QueryDocumentSnapshot,
  ]);

  return JSON.stringify([
    item.price,
    [...item.consumerUids].sort(),
    item.createdAtMs,
  ]);
}

/** Item criado/editado → apaga se ficou vazio, senão recalcula a conta. */
export const onItemWrite = onDocumentWritten(
  { document: "tables/{tableId}/items/{itemId}", retry: true },
  async (event) => {
    const afterSnap = event.data?.after;

    // Só entra na transação quando o snapshot já indica item órfão — evita
    // uma leitura por escrita de item no caminho comum.
    const looksEmpty =
      afterSnap?.exists === true &&
      ((afterSnap.get("consumerUids") as string[] | undefined) ?? []).length === 0 &&
      ((afterSnap.get("pendingInvites") as string[] | undefined) ?? []).length === 0;

    if (looksEmpty) {
      const deleted = await maybeDeleteEmptyItem(
        event.params.tableId,
        event.params.itemId,
      );
      if (deleted) {
        // A própria exclusão re-dispara este gatilho, que recalcula a conta.
        return;
      }
    }

    const before = billingSignature(event.data?.before);
    const after = billingSignature(afterSnap);

    if (before === after) {
      return;
    }

    if (tooOldToRetry(event.time, event.params.tableId)) {
      return;
    }

    await recomputeBill(event.params.tableId);
  },
);

/**
 * Config da mesa mudou → recalcula quando o que compõe a conta muda: couvert
 * (entra no subtotal de cada um) ou a gorjeta % (entra no total). Ignora
 * mudanças de nome/status/admin/etc.
 */
export const onTableWrite = onDocumentWritten(
  { document: "tables/{tableId}", retry: true },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;

    const couvertChanged =
      before?.get("couvertSuggested") !== after?.get("couvertSuggested");
    const tipChanged = before?.get("tipPercent") !== after?.get("tipPercent");

    if (!couvertChanged && !tipChanged) {
      return;
    }

    if (tooOldToRetry(event.time, event.params.tableId)) {
      return;
    }

    await recomputeBill(event.params.tableId);
  },
);

/**
 * Encerra a mesa quando o ÚLTIMO participante ativo sai
 *
 */
async function maybeAutoCloseTable(tableId: string): Promise<void> {
  const tableRef = db.doc(`tables/${tableId}`);
  const participantsRef = db.collection(`tables/${tableId}/participants`);

  await db.runTransaction(async (tx) => {
    const [tableSnap, participantsSnap] = await Promise.all([
      tx.get(tableRef),
      tx.get(participantsRef),
    ]);

    if (!tableSnap.exists) {
      return;
    }

    if (tableSnap.get("status") === "encerrada") {
      return;
    }

    if (participantsSnap.empty) {
      return;
    }

    const active = participantsSnap.docs.filter(
      (participant) => participant.get("left") !== true,
    );

    if (active.length > 0) {
      return;
    }

    const unpaid = participantsSnap.docs.filter(
      (participant) => participant.get("paid") !== true,
    ).length;

    tx.update(tableRef, {
      status: "encerrada",
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Mesa encerrada — último participante saiu", {
      tableId,
      unpaid,
    });
  });
}

/**
 * Participante saiu da mesa: remove o uid de `consumerUids`/`pendingInvites`
 * de qualquer item onde ele estivesse (aceito ou convidado). Quem cuida da
 * cascata de apagar itens que ficaram vazios é o próprio `onItemWrite`,
 * reagindo a esta escrita.
 */
async function removeParticipantFromItems(
  tableId: string,
  uid: string,
): Promise<void> {
  const itemsRef = db.collection(`tables/${tableId}/items`);
  const [consumerSnap, invitedSnap] = await Promise.all([
    itemsRef.where("consumerUids", "array-contains", uid).get(),
    itemsRef.where("pendingInvites", "array-contains", uid).get(),
  ]);

  if (consumerSnap.empty && invitedSnap.empty) {
    return;
  }

  const batch = db.batch();
  const seen = new Set<string>();
  let count = 0;

  [...consumerSnap.docs, ...invitedSnap.docs].forEach((docSnap) => {
    if (seen.has(docSnap.ref.path)) {
      return;
    }
    seen.add(docSnap.ref.path);

    batch.update(docSnap.ref, {
      consumerUids: FieldValue.arrayRemove(uid),
      pendingInvites: FieldValue.arrayRemove(uid),
      lastChange: { type: "leave", byUid: uid, targetUid: null, at: FieldValue.serverTimestamp() },
    });
    count += 1;
  });

  if (count > 0) {
    await batch.commit();
    logger.info("Participante removido de itens por sair da mesa", { tableId, uid, count });
  }
}

/**
 * Participante entrou (create) ou ligou/desligou a gorjeta (tipEnabled) →
 * recalcula. Não reage às próprias escritas de subtotalCents/totalCents (que não
 * mexem em tipEnabled nem criam docs), o que evita laço infinito com o gatilho.
 *
 */
export const onParticipantWrite = onDocumentWritten(
  { document: "tables/{tableId}/participants/{participantId}", retry: true },
  async (event) => {
    if (tooOldToRetry(event.time, event.params.tableId)) {
      return;
    }

    const before = event.data?.before;
    const after = event.data?.after;

    // Saída de participante: remove-o dos itens em que estava e, se não sobrou
    // ninguém ativo, encerra a mesa.
    //
    // `maybeAutoCloseTable` é chamado mesmo quando quem saiu já tinha pago: ele
    // é idempotente e só encerra se de fato não houver mais ninguém ativo. Com
    // a checagem de `paid` que existia aqui, uma mesa cujo último participante
    // saía já quitado ficava aberta para sempre.
    if (!after?.exists) {
      if (before?.exists) {
        await removeParticipantFromItems(
          event.params.tableId,
          event.params.participantId,
        );
        await maybeAutoCloseTable(event.params.tableId);
      }
      return;
    }

    const isCreate = !before?.exists;
    const tipChanged = before?.get("tipEnabled") !== after.get("tipEnabled");
    const justLeft =
      after.get("left") === true && before?.get("left") !== true;

    if (isCreate || tipChanged) {
      await recomputeBill(event.params.tableId);
    }

    if (justLeft) {
      await maybeAutoCloseTable(event.params.tableId);
    }
  },
);

export const registerPayment = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Faça login para registrar o pagamento.");
  }

  const tableId = String(request.data?.tableId ?? "");
  if (!tableId) {
    throw new HttpsError("invalid-argument", "tableId é obrigatório.");
  }

  const tableRef = db.doc(`tables/${tableId}`);
  const itemsRef = db.collection(`tables/${tableId}/items`);
  const participantRef = db.doc(`tables/${tableId}/participants/${uid}`);

  await db.runTransaction(async (tx) => {
    const [tableSnap, itemsSnap, participantSnap] = await Promise.all([
      tx.get(tableRef),
      tx.get(itemsRef),
      tx.get(participantRef),
    ]);

    if (!tableSnap.exists) {
      throw new HttpsError("not-found", "Mesa não encontrada.");
    }
    if (tableSnap.get("status") === "encerrada") {
      throw new HttpsError("failed-precondition", "Essa mesa já foi encerrada.");
    }
    if (!participantSnap.exists) {
      throw new HttpsError("failed-precondition", "Você não é participante desta mesa.");
    }
    if (participantSnap.get("paid") === true) {
      return; // já pago — idempotente
    }

    const couvert = Number(tableSnap.get("couvertSuggested") ?? 0);
    const tipPercent = Number(tableSnap.get("tipPercent") ?? 0);
    const items = toBillItems(itemsSnap.docs);
    const round = roundOf(participantSnap);


    const subtotal = userSubtotalCents(uid, items, couvert, round);
    const tipEnabled = participantSnap.get("tipEnabled") === true;
    const total = userTotalCents(subtotal, tipPercent, tipEnabled);
    const couvertCents = round.couvertSettled ? 0 : reaisToCents(couvert);
    const paidAt = Timestamp.now();

    itemsSnap.docs.forEach((item) => {
      if (item.get("settled") === true) {
        return;
      }
      const billItem = toBillItems([item])[0];
      if (
        billItem.consumerUids.includes(uid) &&
        isItemInCurrentRound(billItem, round.settledThroughMs)
      ) {
        tx.update(item.ref, { settled: true });
      }
    });

    tx.set(participantRef.collection("payments").doc(), {
      amountCents: total,
      subtotalCents: subtotal,
      tipCents: total - subtotal,
      couvertCents,
      paidAt,
    });

    tx.update(participantRef, {
      subtotalCents: 0,
      totalCents: 0,
      settledSubtotalCents: FieldValue.increment(subtotal),
      paidTotalCents: FieldValue.increment(total),
      settledThroughAt: paidAt,
      couvertSettled: true,
      paid: true,
      paidAt,
    });
    tx.update(tableRef, {
      paidUids: FieldValue.arrayUnion(uid),
    });

    logger.info("Pagamento registrado", { tableId, uid, totalCents: total });
  });
});

export const reopenParticipation = onCall(async (request) => {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", "Faça login para voltar à mesa.");
  }

  const tableId = String(request.data?.tableId ?? "");
  if (!tableId) {
    throw new HttpsError("invalid-argument", "tableId é obrigatório.");
  }

  const tableRef = db.doc(`tables/${tableId}`);
  const participantRef = db.doc(`tables/${tableId}/participants/${uid}`);

  await db.runTransaction(async (tx) => {
    const [tableSnap, participantSnap] = await Promise.all([
      tx.get(tableRef),
      tx.get(participantRef),
    ]);

    if (!tableSnap.exists || tableSnap.get("status") === "encerrada") {
      throw new HttpsError("not-found", "Mesa não encontrada. Confira o código.");
    }
    if (!participantSnap.exists) {
      throw new HttpsError("failed-precondition", "Você não é participante desta mesa.");
    }
    if (participantSnap.get("paid") !== true) {
      return;
    }

    tx.update(participantRef, {
      paid: false,
      paidAt: null,
      left: false,
      subtotalCents: 0,
      totalCents: 0,
    });
    tx.update(tableRef, {
      paidUids: FieldValue.arrayRemove(uid),
    });

    logger.info("Participação reaberta", { tableId, uid });
  });
});

// ─── Cardápio ────────────────────────────────────────────────────────────────

function requireUid(request: { auth?: { uid: string } | null }, message: string): string {
  const uid = request.auth?.uid;
  if (!uid) {
    throw new HttpsError("unauthenticated", message);
  }
  return uid;
}

function requireTableId(data: unknown): string {
  const tableId = String((data as { tableId?: unknown } | null)?.tableId ?? "");
  if (!tableId) {
    throw new HttpsError("invalid-argument", "tableId é obrigatório.");
  }
  return tableId;
}

/** Só o admin, com a mesa aberta, mexe na origem do cardápio (leitura por IA e gravação). */
async function assertMenuAdmin(tableId: string, uid: string): Promise<void> {
  const tableSnap = await db.doc(`tables/${tableId}`).get();
  if (!tableSnap.exists || tableSnap.get("status") === "encerrada") {
    throw new HttpsError("not-found", "Mesa não encontrada.");
  }
  if (tableSnap.get("adminUid") !== uid) {
    throw new HttpsError("permission-denied", "Só o admin da mesa pode adicionar o cardápio.");
  }
}

/**
 * Reserva uma leitura na cota da mesa (`aiQuota/{tableId}`, só Admin SDK).
 * A cota grátis do OpenRouter é da conta inteira — sem isso, uma mesa só
 * esgotaria as leituras do dia de todo mundo.
 */
async function reserveMenuRead(tableId: string): Promise<void> {
  const quotaRef = db.doc(`aiQuota/${tableId}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(quotaRef);
    const used = Number(snap.get("menuReads") ?? 0);
    if (used >= MAX_MENU_READS_PER_TABLE) {
      throw new HttpsError(
        "resource-exhausted",
        "Esta mesa já usou todas as leituras de cardápio. Adicione os itens manualmente.",
      );
    }
    tx.set(quotaRef, { menuReads: used + 1, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
  });
}

/** Devolve a leitura quando a IA nem chegou a ser chamada (ex.: foto inválida). */
async function releaseMenuRead(tableId: string): Promise<void> {
  await db.doc(`aiQuota/${tableId}`).update({ menuReads: FieldValue.increment(-1) });
}

/** Consumo de cada chamada à IA em `aiUsage` (só Admin SDK) — custo, tokens, latência. */
function firestoreUsageSink(tableId: string, uid: string): UsageSink {
  return {
    record: async (report) => {
      await db.collection("aiUsage").add({
        ...report,
        tableId,
        uid,
        createdAt: FieldValue.serverTimestamp(),
      });
    },
  };
}

/**
 * Lê fotos do cardápio com IA e devolve os itens SEM salvar: o admin revisa e
 * corrige no app, e só então chama `saveMenu`. Preço lido errado vira cobrança
 * errada, por isso nada vai direto para o Firestore.
 */
export const readMenu = onCall(
  { secrets: aiSecrets(), timeoutSeconds: 120, memory: "512MiB" },
  async (request) => {
    const uid = requireUid(request, "Faça login para ler o cardápio.");
    const tableId = requireTableId(request.data);
    await assertMenuAdmin(tableId, uid);
    await reserveMenuRead(tableId);

    try {
      const reader = MenuReaderClient.create({ usageSink: firestoreUsageSink(tableId, uid) });
      const { menuName, items, discarded } = await reader.readMenu(request.data?.images);

      logger.info("Cardápio lido", { tableId, items: items.length, discarded, profile: reader.profileName });
      return { menuName, items, discarded };
    } catch (error) {
      if (!(error instanceof AiError)) {
        throw error;
      }
      if (!error.usage) {
        await releaseMenuRead(tableId);
      }

      logger.warn("Falha na leitura do cardápio", { tableId, code: error.code, message: error.message });
      const failure = describeAiFailure(error.code);
      throw new HttpsError(failure.status, failure.message ?? error.message);
    }
  },
);

/**
 * Grava o cardápio revisado pelo admin. Acrescenta ao que já existe (ex.:
 * segunda página fotografada depois), mantendo a ordem em `position`. Nunca
 * apaga itens: itens da comanda apontam para eles via `menuItemId`.
 */
export const saveMenu = onCall(async (request) => {
  const uid = requireUid(request, "Faça login para salvar o cardápio.");
  const tableId = requireTableId(request.data);
  await assertMenuAdmin(tableId, uid);

  let items;
  try {
    items = sanitizeMenuItems(request.data?.items);
  } catch (error) {
    if (error instanceof MenuValidationError) {
      throw new HttpsError("invalid-argument", error.message);
    }
    throw error;
  }
  const menuName = sanitizeMenuName(request.data?.menuName);

  const menuRef = db.collection(`tables/${tableId}/menuItems`);
  const existing = (await menuRef.count().get()).data().count;
  if (existing + items.length > MAX_MENU_ITEMS) {
    throw new HttpsError(
      "invalid-argument",
      `O cardápio pode ter no máximo ${MAX_MENU_ITEMS} itens (já tem ${existing}).`,
    );
  }

  const now = FieldValue.serverTimestamp();
  const batch = db.batch();
  items.forEach((item, index) => {
    batch.set(menuRef.doc(), {
      ...item,
      position: existing + index,
      createdAt: now,
      createdBy: uid,
      updatedAt: now,
      updatedBy: uid,
    });
  });
  if (menuName) {
    batch.update(db.doc(`tables/${tableId}`), { menuName, updatedAt: now });
  }
  await batch.commit();

  logger.info("Cardápio salvo", { tableId, saved: items.length, total: existing + items.length });
  return { saved: items.length };
});

/**
 * Item do cardápio editado → os itens da comanda ligados a ele acompanham o
 * nome e o preço (unitário × quantidade), exceto os que já entraram numa conta
 * paga. Mudança de preço grava `lastChange` "menu-price", que vira o aviso
 * "o preço do item X foi mudado por Fulano para R$ Y" para quem está no item.
 * A conta de cada um é recalculada pelo `onItemWrite`, reagindo a esta escrita.
 */
async function propagateMenuItemChange(tableId: string, menuItemId: string): Promise<void> {
  const tableRef = db.doc(`tables/${tableId}`);
  const menuItemRef = db.doc(`tables/${tableId}/menuItems/${menuItemId}`);
  const linkedQuery = db.collection(`tables/${tableId}/items`).where("menuItemId", "==", menuItemId);

  await db.runTransaction(async (tx) => {
    const [tableSnap, menuSnap, linkedSnap] = await Promise.all([
      tx.get(tableRef),
      tx.get(menuItemRef),
      tx.get(linkedQuery),
    ]);

    if (!tableSnap.exists || !menuSnap.exists) {
      return;
    }

    const menu = { name: String(menuSnap.get("name") ?? ""), price: Number(menuSnap.get("price") ?? 0) };
    const byUid = String(menuSnap.get("updatedBy") ?? "");
    const paidUids: string[] = tableSnap.get("paidUids") ?? [];

    let updated = 0;
    linkedSnap.docs.forEach((itemSnap) => {
      const plan = planLinkedItemUpdate(
        {
          name: String(itemSnap.get("name") ?? ""),
          price: Number(itemSnap.get("price") ?? 0),
          quantity: Number(itemSnap.get("quantity") ?? 1) || 1,
          settled: itemSnap.get("settled") === true,
          consumerUids: itemSnap.get("consumerUids") ?? [],
        },
        menu,
        paidUids,
      );
      if (!plan) {
        return;
      }

      const changes: Record<string, unknown> = { updatedAt: FieldValue.serverTimestamp() };
      if (plan.name !== undefined) {
        changes.name = plan.name;
      }
      if (plan.price !== undefined) {
        changes.price = plan.price;
        changes.lastChange = {
          type: "menu-price",
          byUid,
          targetUid: null,
          at: FieldValue.serverTimestamp(),
          oldPrice: plan.oldUnitPrice ?? null,
          newPrice: menu.price,
        };
      }

      tx.update(itemSnap.ref, changes);
      updated += 1;
    });

    logger.info("Itens da comanda atualizados pelo cardápio", { tableId, menuItemId, updated });
  });
}

export const onMenuItemWrite = onDocumentWritten(
  { document: "tables/{tableId}/menuItems/{menuItemId}", retry: true },
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;

    // Criação vem do saveMenu (ninguém aponta para o item ainda) e exclusão
    // não tem caminho pelo cliente: só edição interessa.
    if (!before?.exists || !after?.exists) {
      return;
    }

    const priceChanged = before.get("price") !== after.get("price");
    const nameChanged = before.get("name") !== after.get("name");
    if (!priceChanged && !nameChanged) {
      return;
    }

    if (tooOldToRetry(event.time, event.params.tableId)) {
      return;
    }

    await propagateMenuItemChange(event.params.tableId, event.params.menuItemId);
  },
);
