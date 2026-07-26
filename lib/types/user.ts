export type UserType = 'anonymous' | 'registered';

export type User = {
  uid: string;
  type: UserType;
  displayName: string;
  email?: string | null;
  avatarUrl?: string | null;
  coins: number;
  currentTableId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

