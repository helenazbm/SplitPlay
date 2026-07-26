import { doc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { auth, db, functions } from "@/lib/firebase";
import type { Participant } from "@/lib/types/participant";

function requireCurrentUser() {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
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

/**
 * Saldo já pago da mesa em centavos: acumulado de TODO mundo, inclusive de quem
 * pagou e voltou a consumir (`paid` volta a false, mas o dinheiro já entrou).
 */
export function paidBalanceCents(
  participants: Array<Pick<Participant, "paidTotalCents">>,
): number {
  return participants.reduce(
    (sum, participant) => sum + Math.max(0, participant.paidTotalCents),
    0,
  );
}

export async function setTipEnabled(
  tableId: string,
  tipEnabled: boolean,
): Promise<void> {
  const current = requireCurrentUser();

  try {
    await updateDoc(
      doc(db, "tables", tableId, "participants", current.uid),
      { tipEnabled },
    );
  } catch (error) {
    if (
      typeof error === "object" &&
      error !== null &&
      "code" in error &&
      (error as { code: string }).code === "permission-denied"
    ) {
      // As rules negam nos dois casos: pagamento já registrado ou mesa encerrada.
      throw new Error(
        "Não foi possível alterar a gorjeta. Seu pagamento já pode ter sido registrado ou a mesa foi encerrada.",
      );
    }
    throw error;
  }
}

/**
 * Registra o pagamento da parte do usuário autenticado.
 */
export async function registerPayment(tableId: string): Promise<void> {
  requireCurrentUser();

  const call = httpsCallable<{ tableId: string }, void>(
    functions,
    "registerPayment",
  );
  await call({ tableId });
}
