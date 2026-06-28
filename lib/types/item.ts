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
