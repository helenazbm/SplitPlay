/**
 * Regras de exibição do cardápio na tela (busca, filtro por seção, agrupamento
 * e ícone). Funções puras, testadas no Jest da raiz.
 */

import type { MenuItemWithId } from "@/lib/types/menu";

/** Rótulo usado para itens que a IA leu sem seção. */
export const NO_SECTION_LABEL = "Outros";

export type MenuSection = {
  title: string;
  items: MenuItemWithId[];
};

/** Minúsculas e sem acento: "Açaí" e "acai" casam na busca. */
export function normalizeSearch(text: string): string {
  return text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}

function sectionTitle(item: Pick<MenuItemWithId, "section">): string {
  return item.section?.trim() || NO_SECTION_LABEL;
}

/** Seções na ordem em que aparecem no cardápio (que é a ordem da foto). */
export function menuSectionTitles(items: Pick<MenuItemWithId, "section">[]): string[] {
  const titles: string[] = [];
  for (const item of items) {
    const title = sectionTitle(item);
    if (!titles.includes(title)) {
      titles.push(title);
    }
  }
  return titles;
}

/**
 * Agrupa por seção depois de aplicar a busca (nome ou seção) e o filtro de
 * seção (`null` = todas). Seções que ficam vazias somem.
 */
export function groupMenu(
  items: MenuItemWithId[],
  options: { search?: string; section?: string | null } = {},
): MenuSection[] {
  const term = normalizeSearch(options.search ?? "");
  const groups = new Map<string, MenuItemWithId[]>();

  for (const item of items) {
    const title = sectionTitle(item);
    if (options.section && title !== options.section) {
      continue;
    }
    if (term && !normalizeSearch(`${item.name} ${title}`).includes(term)) {
      continue;
    }
    const group = groups.get(title);
    if (group) {
      group.push(item);
    } else {
      groups.set(title, [item]);
    }
  }

  return Array.from(groups, ([title, sectionItems]) => ({ title, items: sectionItems }));
}

/**
 * Palavras-chave → ícone de `lib/foodIcons.ts`. A ordem importa: a primeira
 * regra que casar vence ("suco de laranja" é suco, não fruta).
 */
const ICON_RULES: { icon: string; words: string[] }[] = [
  { icon: "orange-juice", words: ["suco", "limonada", "juice", "vitamina"] },
  { icon: "food-and-wine", words: ["vinho", "espumante", "drink", "caipirinha", "cerveja", "chopp", "chope", "long neck", "gin", "whisky", "vodka", "dose"] },
  { icon: "cola", words: ["refri", "coca", "guarana", "soda", "agua", "tonica", "bebida"] },
  { icon: "coffee-beans", words: ["cafe", "expresso", "espresso", "capuccino", "cappuccino", "cha "] },
  { icon: "salami-pizza", words: ["pizza", "calabresa", "marguerita", "margherita", "mussarela"] },
  { icon: "hamburger", words: ["burger", "hamburguer", "x-", "sanduiche", "lanche"] },
  { icon: "hot-dog", words: ["cachorro", "hot dog", "hot-dog"] },
  { icon: "french-fries", words: ["batata", "fritas", "porcao", "petisco", "isca"] },
  { icon: "barbecue", words: ["churrasco", "picanha", "carne", "costela", "espeto", "frango", "file", "bife"] },
  { icon: "salmon-sushi", words: ["sushi", "sashimi", "temaki", "uramaki", "hot roll", "salmao"] },
  { icon: "gyoza", words: ["guioza", "gyoza", "pastel", "coxinha", "salgado"] },
  { icon: "burrito", words: ["burrito", "taco", "nacho", "wrap"] },
  { icon: "sunny-side-up-eggs", words: ["ovo", "omelete", "cafe da manha"] },
  { icon: "ice-cream-cone", words: ["sorvete", "gelato", "picole"] },
  { icon: "ice-cream-sundae", words: ["sundae", "milk shake", "milkshake", "acai"] },
  { icon: "brigadeiro", words: ["brigadeiro", "chocolate", "brownie"] },
  { icon: "cherry-cheesecake", words: ["cheesecake", "torta", "bolo", "pudim", "sobremesa", "doce"] },
  { icon: "citrus", words: ["fruta", "salada"] },
];

/** Ícone para um item do cardápio, adivinhado pelo nome e pela seção. */
export function guessMenuItemIcon(item: Pick<MenuItemWithId, "name" | "section">): string | null {
  // Nome primeiro: "Suco" dentro da seção "Pizzas" continua sendo suco.
  for (const text of [item.name, item.section ?? ""]) {
    const normalized = ` ${normalizeSearch(text)} `;
    const rule = ICON_RULES.find(({ words }) => words.some((word) => normalized.includes(word)));
    if (rule) {
      return rule.icon;
    }
  }
  return null;
}
