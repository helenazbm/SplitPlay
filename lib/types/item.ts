export type TableItem = {
  name: string;
  price: number;
  quantity: number;
  icon: string | null;
  consumerUids: string[];
  ownerUid: string;
  settled: boolean;
  createdAt: unknown;
  createdAtMs: number | null;
  updatedAt: unknown;
};

export type CreateTableItemInput = {
  name: string;
  price: number;
  quantity?: number;
  consumerUids: string[];
  icon?: string | null;
};

export type UpdateTableItemInput = {
  name: string;
  price: number;
  quantity?: number;
  consumerUids: string[];
  icon?: string | null;
};

export type TableItemWithId = TableItem & {
  id: string;
};
