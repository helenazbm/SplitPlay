export type TableItem = {
  name: string;
  /** Valor cheio do item (unitário × quantidade). Base do cálculo de divisão. */
  price: number;
  /** Quantidade de unidades do item (apenas exibição; price já é o total). */
  quantity: number;
  /** Key do ícone de comida (ver lib/foodIcons). null = sem ícone. */
  icon: string | null;
  /**
   * Participantes que dividem o item em partes iguais. Sempre inclui o dono
   * (ownerUid): você só lança itens que você mesmo consome e, opcionalmente,
   * compartilha com outros participantes.
   */
  consumerUids: string[];
  ownerUid: string;
  createdAt: unknown;
  updatedAt: unknown;
  /**
   * Proposta de edição/exclusão ainda não confirmada por todos os outros
   * consumidores do item. null = sem proposta ativa.
   */
  pendingChange: ItemPendingChange | null;
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

export type ItemChangeType = "update" | "delete";

export type ItemProposedData = {
  name: string;
  price: number;
  quantity: number;
  icon: string | null;
  consumerUids: string[];
};

export type ItemPendingChange = {
  type: ItemChangeType;
  /** Quem propôs a alteração. */
  proposedBy: string;
  /** Dados propostos; null quando type === "delete". */
  proposedData: ItemProposedData | null;
  /** consumerUids do item (no momento da proposta) menos o proponente. */
  awaitingUids: string[];
  /** Subconjunto de awaitingUids que já confirmou. */
  confirmedUids: string[];
  createdAt: unknown;
};

export type TableItemWithId = TableItem & {
  id: string;
};
