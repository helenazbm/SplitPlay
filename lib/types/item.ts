export type ItemLastChangeType =
  | "update"
  | "invite"
  | "accept"
  | "decline"
  | "leave"
  | "remove"
  /** Preço do item no cardápio mudou (gravado pela Cloud Function `onMenuItemWrite`). */
  | "menu-price";

/** Último evento relevante do item — alimenta o aviso inline (sem central de notificações). */
export type ItemLastChange = {
  type: ItemLastChangeType;
  byUid: string;
  /** Relevante para "invite" (quem foi convidado) e "remove" (quem foi removido). */
  targetUid?: string | null;
  at: unknown;
  /** Preço unitário antes/depois — só em "menu-price". */
  oldPrice?: number | null;
  newPrice?: number | null;
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
  /**
   * Item do cardápio de onde veio. Nome e preço seguem o cardápio e não podem
   * ser editados na comanda. `null` = item digitado à mão.
   */
  menuItemId: string | null;
};

export type CreateTableItemInput = {
  name: string;
  price: number;
  quantity?: number;
  /** Criador + convidados; o service separa quem entra aceito e quem entra pendente. */
  consumerUids: string[];
  icon?: string | null;
  /** Use `addMenuItemToComanda` (menuService), que calcula nome e preço. */
  menuItemId?: string | null;
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
