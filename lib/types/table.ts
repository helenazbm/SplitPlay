export type TableStatus = "aberta" | "encerrada";

export type Table = {
  adminUid: string;
  name: string;
  tipSuggested: boolean;
  couvertSuggested: number;
  status: TableStatus;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTableInput = {
  name: string;
};
