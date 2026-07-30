/**
 * Cálculo autoritativo da conta no servidor.
 */

import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { logger, setGlobalOptions } from "firebase-functions/v2";

import {
  isItemInCurrentRound,
  reaisToCents,
  userSubtotalCents,
  userTotalCents,
  type BillItem,
} from "./billing";

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
