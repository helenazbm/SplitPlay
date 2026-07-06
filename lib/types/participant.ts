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
  subtotalCents: number;
  totalCents: number;
};