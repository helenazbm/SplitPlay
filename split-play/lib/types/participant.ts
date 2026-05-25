export type Participant = {
  uid: string;
  displayName: string;
  isAnonymous: boolean;
  joinedAt: Date;
  paid: boolean;
  paidAmount: number;
  paidAt: Date | null;
};