export type Participant = {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
  isAnonymous: boolean;
  joinedAt: Date;
  paid: boolean;
  paidAt: Date | null;
  tipEnabled: boolean;
  subtotalCents: number;
  totalCents: number;
  settledSubtotalCents: number;
  paidTotalCents: number;
  settledThroughAt: Date | null;
  couvertSettled: boolean;
  left: boolean;
};

export type Payment = {
  id: string;
  amountCents: number;
  subtotalCents: number;
  tipCents: number;
  couvertCents: number;
  paidAt: Date | null;
};
