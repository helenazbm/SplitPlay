/**
 * Catálogo de ícones de comida (Icons8) que o usuário pode atribuir a um item.
 * A `key` é o que persiste no item (campo `icon`); o `src` é o PNG em /public.
 */

export type FoodIcon = {
  key: string;
  label: string;
  src: string;
};

const DIR = "/foods/Icons8";

function make(key: string, label: string): FoodIcon {
  return { key, label, src: `${DIR}/icons8-${key}-50.png` };
}

export const FOOD_ICONS: FoodIcon[] = [
  make("salami-pizza", "Pizza"),
  make("pizza-five-eighths", "Fatia de pizza"),
  make("hamburger", "Hambúrguer"),
  make("hot-dog", "Cachorro-quente"),
  make("french-fries", "Batata frita"),
  make("barbecue", "Churrasco"),
  make("salmon-sushi", "Sushi"),
  make("gyoza", "Guioza"),
  make("burrito", "Burrito"),
  make("sunny-side-up-eggs", "Ovos"),
  make("popcorn", "Pipoca"),
  make("cola", "Refrigerante"),
  make("orange-juice", "Suco"),
  make("food-and-wine", "Vinho"),
  make("coffee-beans", "Café"),
  make("milk-bottle", "Leite"),
  make("yogurt", "Iogurte"),
  make("ice-cream-cone", "Sorvete"),
  make("ice-cream-sundae", "Sundae"),
  make("banana-split", "Banana split"),
  make("brigadeiro", "Brigadeiro"),
  make("cherry-cheesecake", "Cheesecake"),
  make("citrus", "Frutas"),
  make("topping", "Doce"),
];

const BY_KEY = new Map(FOOD_ICONS.map((icon) => [icon.key, icon]));

/** Caminho do PNG para uma key de ícone, ou null se não houver. */
export function foodIconSrc(key?: string | null): string | null {
  if (!key) {
    return null;
  }
  return BY_KEY.get(key)?.src ?? null;
}
