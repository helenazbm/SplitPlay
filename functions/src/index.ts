/**
 * Cálculo autoritativo da conta no servidor.
 */

import { initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

import { userSubtotalCents, userTotalCents, type BillItem } from "./billing";

initializeApp();
const db = getFirestore();

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
    }
    if (consumerUids.length === 0 && ownerUid) {
      consumerUids = [ownerUid];
    }

    return { price: Number(data.price ?? 0), consumerUids };
  });
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
      const subtotal = userSubtotalCents(participant.id, items, couvert);
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

/** Item criado/editado/excluído → recalcula a conta da mesa toda. */
export const onItemWrite = onDocumentWritten(
  "tables/{tableId}/items/{itemId}",
  async (event) => {
    await recomputeBill(event.params.tableId);
  },
);

/**
 * Config da mesa mudou → recalcula quando o que compõe a conta muda: couvert
 * (entra no subtotal de cada um) ou a gorjeta % (entra no total). Ignora
 * mudanças de nome/status/admin/etc.
 */
export const onTableWrite = onDocumentWritten(
  "tables/{tableId}",
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;

    const couvertChanged =
      before?.get("couvertSuggested") !== after?.get("couvertSuggested");
    const tipChanged = before?.get("tipPercent") !== after?.get("tipPercent");

    if (!couvertChanged && !tipChanged) {
      return;
    }

    await recomputeBill(event.params.tableId);
  },
);

/**
 * Encerra a mesa quando todos os participantes estão com `paid === true`.
 * Idempotente: se a mesa já estiver encerrada ou ainda houver pendentes, não escreve.
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

    const allPaid = participantsSnap.docs.every(
      (participant) => participant.get("paid") === true,
    );

    if (!allPaid) {
      return;
    }

    tx.update(tableRef, {
      status: "encerrada",
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info("Mesa encerrada automaticamente — todos pagaram", { tableId });
  });
}

/**
 * Participante entrou (create) ou ligou/desligou a gorjeta (tipEnabled) →
 * recalcula. Não reage às próprias escritas de subtotalCents/totalCents (que não
 * mexem em tipEnabled nem criam docs), o que evita laço infinito com o gatilho.
 *
 * Quando `paid` vira true, tenta encerrar a mesa se todos já pagaram.
 */
export const onParticipantWrite = onDocumentWritten(
  "tables/{tableId}/participants/{participantId}",
  async (event) => {
    const before = event.data?.before;
    const after = event.data?.after;

    // Saída de participante: se os restantes já pagaram, pode encerrar.
    if (!after?.exists) {
      if (before?.exists && before.get("paid") !== true) {
        await maybeAutoCloseTable(event.params.tableId);
      }
      return;
    }

    const isCreate = !before?.exists;
    const tipChanged = before?.get("tipEnabled") !== after.get("tipEnabled");
    const justPaid =
      after.get("paid") === true && before?.get("paid") !== true;

    if (isCreate || tipChanged) {
      await recomputeBill(event.params.tableId);
    }

    if (justPaid) {
      await maybeAutoCloseTable(event.params.tableId);
    }
  },
);
