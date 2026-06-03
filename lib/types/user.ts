export type UserType = 'anonymous' | 'registered';

export type User = {
  uid: string;
  type: UserType;
  displayName: string;
  email?: string | null;
  photoURL?: string | null;
  coins: number;
  ownedItemIds: string[];
  currentTableId: string | null;
  createdAt: Date;
  updatedAt: Date;
};

