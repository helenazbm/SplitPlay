/**
 * Cálculo autoritativo da conta no servidor.
 *
 * Sempre que um item muda (ou o couvert da mesa muda), recalcula o subtotal de
 * TODOS os participantes da mesa em uma transação e grava em cada doc. Como roda
 * no servidor (com o Admin SDK, que ignora as security rules), o número é
 * confiável, fica correto mesmo para quem está offline e é imune a condições de
 * corrida entre escritas concorrentes.
 */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { onDocumentWritten } from "firebase-functions/v2/firestore";
import { logger } from "firebase-functions/v2";

import { userSubtotalCents, type BillItem } from "./billing";

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
 * Recalcula e persiste o subtotal (centavos) de cada participante da mesa.
 * Tudo numa transação: lê mesa + itens + participantes e grava as diferenças.
 */
async function recomputeSubtotals(tableId: string): Promise<void> {
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
    const items = toBillItems(itemsSnap.docs);

    let updated = 0;
    participantsSnap.docs.forEach((participant) => {
      const subtotal = userSubtotalCents(participant.id, items, couvert);
      const current = Number(participant.get("subtotalCents") ?? 0);
      if (current !== subtotal) {
        tx.update(participant.ref, { subtotalCents: subtotal });
        updated += 1;
      }
    });

    logger.info("Subtotais recalculados", { tableId, updated });
  });
}

/** Item criado/editado/excluído → recalcula a conta da mesa toda. */
export const onItemWrite = onDocumentWritten(
  "tables/{tableId}/items/{itemId}",
  async (event) => {
    await recomputeSubtotals(event.params.tableId);
  },
);

/** Couvert da mesa mudou → recalcula (o couvert entra na conta de cada um). */
export const onTableWrite = onDocumentWritten(
  "tables/{tableId}",
  async (event) => {
    const before = event.data?.before.get("couvertSuggested");
    const after = event.data?.after.get("couvertSuggested");

    // Só recalcula quando o couvert muda; ignora mudanças de nome/status/etc.
    if (before === after) {
      return;
    }

    await recomputeSubtotals(event.params.tableId);
  },
);
