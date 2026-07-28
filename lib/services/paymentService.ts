import { httpsCallable } from "firebase/functions";

import { auth, functions } from "@/lib/firebase";
import type { Participant } from "@/lib/types/participant";

function requireCurrentUser() {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
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
