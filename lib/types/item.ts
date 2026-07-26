export type ItemLastChangeType =
  | "update"
  | "invite"
  | "accept"
  | "decline"
  | "leave"
  | "remove";

/** Último evento relevante do item — alimenta o aviso inline (sem central de notificações). */
export type ItemLastChange = {
  type: ItemLastChangeType;
  byUid: string;
  /** Relevante para "invite" (quem foi convidado) e "remove" (quem foi removido). */
  targetUid?: string | null;
  at: unknown;
};

export type TableItem = {
  name: string;
  price: number;
  quantity: number;
  icon: string | null;
  /**
   * Participantes que já aceitaram dividir o item (fonte da verdade do
   * rateio — lib/billing.ts só olha para este array). Sempre inclui quem
   * criou o item.
   */
  consumerUids: string[];
  /**
   * Convidados aguardando aceitar ou recusar. Nunca entram no rateio
   * enquanto estiverem aqui.
   */
  pendingInvites: string[];
  /** Quem criou o item. Só histórico após a criação — sem privilégio especial. */
  ownerUid: string;
  settled: boolean;
  createdAt: unknown;
  createdAtMs: number | null;
  updatedAt: unknown;
  lastChange: ItemLastChange | null;
};

export type CreateTableItemInput = {
  name: string;
  price: number;
  quantity?: number;
  /** Criador + convidados; o service separa quem entra aceito e quem entra pendente. */
  consumerUids: string[];
  icon?: string | null;
};

export type UpdateItemDetailsInput = {
  name: string;
  price: number;
  quantity?: number;
  icon?: string | null;
};

export type TableItemWithId = TableItem & {
  id: string;
};
