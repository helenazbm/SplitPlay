export type TableStatus = "aberta" | "encerrada";

export type Table = {
  adminUid: string;
  name: string;
  /**
   * Gorjeta sugerida (em %). 10 é o costume no Brasil, mas é configurável e
   * sempre opcional para o participante. 0 = sem sugestão de gorjeta.
   */
  tipPercent: number;
  couvertSuggested: number;
  status: TableStatus;
  /** Nome do cardápio (ver `tables/{id}/menuItems`). Ausente enquanto não houver cardápio. */
  menuName?: string | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CreateTableInput = {
  name: string;
  /** Couvert artístico (por pessoa). Default 0. */
  couvertSuggested?: number;
  /** Gorjeta sugerida (%). Default 10. */
  tipPercent?: number;
};
