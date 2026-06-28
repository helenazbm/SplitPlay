export type Participant = {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
  isAnonymous: boolean;
  joinedAt: Date;
  paid: boolean;
  paidAmount: number;
  paidAt: Date | null;
  tipEnabled: boolean;
  /**
   * Subtotal da parte do participante, em CENTAVOS (itens + couvert, sem
   * gorjeta). Persistido pelo próprio cliente; base para o pagamento.
   */
  subtotalCents: number;
};