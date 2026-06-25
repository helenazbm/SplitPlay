export type TableItem = {
  name: string;
  price: number;
  consumerUid: string;
  ownerUid: string;
  createdAt: unknown;
  updatedAt: unknown;
};

export type CreateTableItemInput = {
  name: string;
  price: number;
  consumerUid: string;
};

export type UpdateTableItemInput = {
  name: string;
  price: number;
  consumerUid: string;
};

export type TableItemWithId = TableItem & {
  id: string;
};