import type { UsageReport } from "../usage/UsageReport";

/** Item lido do cardápio, ainda sem id — o backend decide onde e como salvar. */
export type MenuItemDraft = {
  section: string | null;
  name: string;
  /** Preço unitário em reais, duas casas. */
  price: number;
};

export type MenuReadResult = {
  /** Nome do estabelecimento, se aparecer na foto. */
  menuName: string | null;
  items: MenuItemDraft[];
  /** Itens que o modelo devolveu mas foram descartados (sem preço válido, duplicados...). */
  discarded: number;
  usage: UsageReport;
};
