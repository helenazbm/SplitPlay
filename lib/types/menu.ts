/** Item do cardápio da mesa (`tables/{tableId}/menuItems/{id}`). */
export type MenuItem = {
  /** Título da seção/categoria no cardápio (ex.: "Cervejas"), ou null. */
  section: string | null;
  name: string;
  /** Preço UNITÁRIO em reais. */
  price: number;
  /** Ordem em que aparece no cardápio. */
  position: number;
  updatedBy: string;
  updatedAt: unknown;
};

export type MenuItemWithId = MenuItem & { id: string };

/** Item lido pela IA (ou editado pelo admin na revisão), ainda não salvo. */
export type MenuItemDraft = {
  section: string | null;
  name: string;
  price: number;
};

export type MenuDraft = {
  menuName: string | null;
  items: MenuItemDraft[];
};

export type MenuReadResult = MenuDraft & {
  /** Itens que a IA devolveu mas foram descartados (sem preço, duplicados...). */
  discarded: number;
};

/** Formato aceito pela Cloud Function `readMenu`. */
export type MenuImageInput = {
  mimeType: "image/jpeg";
  /** Base64 sem o prefixo `data:`. */
  base64: string;
};

export type UpdateMenuItemInput = {
  name: string;
  section: string | null;
  price: number;
};
