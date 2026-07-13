import {
  collection,
  doc,
  getDoc,
  getDocs,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { centsToReais } from "@/lib/billing";
import { auth, db } from "@/lib/firebase";
import type { Participant } from "@/lib/types/participant";
import type { Table } from "@/lib/types/table";

function requireCurrentUser() {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
}

async function requireOpenTable(tableId: string): Promise<Table> {
  const snapshot = await getDoc(doc(db, "tables", tableId));
  if (!snapshot.exists()) {
    throw new Error("Mesa não encontrada.");
  }

  const table = snapshot.data() as Table;
  if (table.status === "encerrada") {
    throw new Error("Essa mesa já foi encerrada.");
  }

  return table;
}

async function requireOwnParticipant(
  tableId: string,
  uid: string,
): Promise<Participant & { ref: ReturnType<typeof doc> }> {
  const participantRef = doc(db, "tables", tableId, "participants", uid);
  const snapshot = await getDoc(participantRef);

  if (!snapshot.exists()) {
    throw new Error("Você não é participante desta mesa.");
  }

  const data = snapshot.data();
  return {
    ref: participantRef,
    uid: String(data.uid ?? uid),
    displayName: String(data.displayName ?? "Jogador"),
    avatarUrl: (data.avatarUrl as string | null | undefined) ?? null,
    isAnonymous: Boolean(data.isAnonymous),
    joinedAt: data.joinedAt?.toDate?.() ?? new Date(),
    paid: Boolean(data.paid),
    paidAmount: Number(data.paidAmount ?? 0),
    paidAt: data.paidAt?.toDate?.() ?? null,
    tipEnabled: Boolean(data.tipEnabled),
    subtotalCents: Number(data.subtotalCents ?? 0),
    totalCents: Number(data.totalCents ?? data.subtotalCents ?? 0),
  };
}

/**
 * Saldo pendente da mesa em centavos: soma de `totalCents` de quem ainda não pagou.
 * Diminui automaticamente quando alguém registra pagamento (`paid: true`).
 */
export function pendingBalanceCents(
  participants: Array<Pick<Participant, "paid" | "totalCents">>,
): number {
  return participants.reduce(
    (sum, participant) =>
      sum + (participant.paid ? 0 : Math.max(0, participant.totalCents)),
    0,
  );
}

/** Saldo já pago da mesa em centavos (usa `paidAmount` em reais). */
export function paidBalanceCents(
  participants: Array<Pick<Participant, "paid" | "paidAmount">>,
): number {
  return participants.reduce((sum, participant) => {
    if (!participant.paid) {
      return sum;
    }
    return sum + Math.round(Number(participant.paidAmount ?? 0) * 100);
  }, 0);
}

/**
 * Liga/desliga a gorjeta opcional do participante atual.
 * As Cloud Functions recalculam `totalCents`. Não permite alterar após pagar.
 */
export async function setTipEnabled(
  tableId: string,
  tipEnabled: boolean,
): Promise<void> {
  const current = requireCurrentUser();
  await requireOpenTable(tableId);

  const participant = await requireOwnParticipant(tableId, current.uid);

  if (participant.paid) {
    throw new Error("Não é possível alterar a gorjeta após registrar o pagamento.");
  }

  if (participant.tipEnabled === tipEnabled) {
    return;
  }

  await updateDoc(participant.ref, { tipEnabled });
}

/**
 * Registra o pagamento da parte do usuário autenticado.
 * Grava `paid`, `paidAmount` (reais = totalCents/100) e `paidAt`.
 * O saldo pendente da mesa cai na leitura via `pendingBalanceCents`.
 * Quando todos pagarem, a Cloud Function encerra a mesa automaticamente.
 */
export async function registerPayment(tableId: string): Promise<void> {
  const current = requireCurrentUser();
  await requireOpenTable(tableId);

  const participant = await requireOwnParticipant(tableId, current.uid);

  if (participant.paid) {
    return;
  }

  const paidAmount = centsToReais(participant.totalCents);

  await updateDoc(participant.ref, {
    paid: true,
    paidAmount,
    paidAt: serverTimestamp(),
  });
}

/**
 * Lê participantes e devolve o saldo pendente atual (centavos).
 * Útil para checagens no back sem UI.
 */
export async function getPendingBalanceCents(tableId: string): Promise<number> {
  const snapshot = await getDocs(
    collection(db, "tables", tableId, "participants"),
  );

  const participants = snapshot.docs.map((entry) => {
    const data = entry.data();
    return {
      paid: Boolean(data.paid),
      totalCents: Number(data.totalCents ?? data.subtotalCents ?? 0),
    };
  });

  return pendingBalanceCents(participants);
}
