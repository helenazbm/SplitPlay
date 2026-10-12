import {
  NO_SECTION_LABEL,
  groupMenu,
  guessMenuItemIcon,
  menuSectionTitles,
  normalizeSearch,
} from "@/lib/menu/menuView";
import type { MenuItemWithId } from "@/lib/types/menu";

function menuItem(id: string, name: string, section: string | null, price = 10): MenuItemWithId {
  return {
    id,
    name,
    section,
    price,
    position: Number(id),
    hidden: false,
    updatedBy: "u1",
    updatedAt: null,
  };
}

const MENU = [
  menuItem("1", "Pizza Marguerita", "Pizzas", 45),
  menuItem("2", "Coca-Cola 2L", "Bebidas", 14),
  menuItem("3", "Pizza Calabresa", "Pizzas", 48),
  menuItem("4", "Pudim", null, 12),
];

describe("menuView", () => {
  test("normalizeSearch ignora acento e caixa", () => {
    expect(normalizeSearch("  Açaí GRANDE ")).toBe("acai grande");
  });

  test("menuSectionTitles mantém a ordem do cardápio e agrupa os sem seção", () => {
    expect(menuSectionTitles(MENU)).toEqual(["Pizzas", "Bebidas", NO_SECTION_LABEL]);
  });

  test("groupMenu agrupa por seção na ordem do cardápio", () => {
    const groups = groupMenu(MENU);
    expect(groups.map((group) => group.title)).toEqual(["Pizzas", "Bebidas", NO_SECTION_LABEL]);
    expect(groups[0].items.map((item) => item.id)).toEqual(["1", "3"]);
  });

  test("groupMenu filtra por seção e por busca sem acento", () => {
    expect(groupMenu(MENU, { section: "Bebidas" }).map((group) => group.title)).toEqual(["Bebidas"]);

    const found = groupMenu(MENU, { search: "calabrésa" });
    expect(found).toHaveLength(1);
    expect(found[0].items.map((item) => item.id)).toEqual(["3"]);
  });

  test("groupMenu busca também pelo nome da seção", () => {
    expect(groupMenu(MENU, { search: "bebid" })[0].items.map((item) => item.id)).toEqual(["2"]);
  });

  test("groupMenu sem resultado devolve lista vazia", () => {
    expect(groupMenu(MENU, { search: "sushi" })).toEqual([]);
  });

  test("guessMenuItemIcon usa o nome antes da seção", () => {
    expect(guessMenuItemIcon({ name: "Pizza Marguerita", section: null })).toBe("salami-pizza");
    expect(guessMenuItemIcon({ name: "Coca-Cola 2L", section: "Bebidas" })).toBe("cola");
    expect(guessMenuItemIcon({ name: "Suco de laranja", section: "Pizzas" })).toBe("orange-juice");
    expect(guessMenuItemIcon({ name: "Especial da casa", section: "Sobremesas" })).toBe("cherry-cheesecake");
    expect(guessMenuItemIcon({ name: "Especial da casa", section: null })).toBeNull();
  });
});
