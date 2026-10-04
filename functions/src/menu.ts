/**
 * Regras do cardápio da mesa — funções puras, sem Firebase, para poder testar
 * no Jest da raiz. Quem lê/grava no Firestore é o `index.ts`.
 *
 * Modelo:
 *   tables/{tableId}.menuName             nome do cardápio (editável por participantes)
 *   tables/{tableId}/menuItems/{id}       { section, name, price, position, ... }
 *   tables/{tableId}/items/{id}.menuItemId  item da comanda que veio do cardápio
 *
 * `price` do menuItem é o preço UNITÁRIO; o `price` do item da comanda é o
 * total da linha (unitário × quantidade), igual ao que o CreateItemModal grava.
 */

import type { AiErrorCode } from "./ai/errors/AiError";

export const MAX_MENU_NAME_LENGTH = 80;
export const MAX_MENU_SECTION_LENGTH = 40;
export const MAX_MENU_PRICE = 10000;
export const MAX_MENU_ITEMS = 300;
/** Leituras por IA que uma mesa pode gastar. A cota grátis do OpenRouter é por conta (50/dia). */
export const MAX_MENU_READS_PER_TABLE = 10;

export type MenuItemInput = {
  section: string | null;
  name: string;
  price: number;
};

/** Item do cardápio mal formado no `saveMenu` — vira `invalid-argument`. */
export class MenuValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MenuValidationError";
  }
}

export function cleanMenuText(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const text = value.replace(/\s+/g, " ").trim();
  return text ? text.slice(0, maxLength) : null;
}

/** Preço unitário em reais, duas casas. `null` se não for um preço plausível. */
export function parseMenuPrice(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return null;
  }
  const price = Math.round(value * 100) / 100;
  return price > 0 && price <= MAX_MENU_PRICE ? price : null;
}

export function sanitizeMenuName(value: unknown): string | null {
  return cleanMenuText(value, MAX_MENU_NAME_LENGTH);
}

/**
 * Valida a lista revisada pelo admin. Diferente do parser da IA, aqui não se
 * descarta nada em silêncio: o admin já viu a lista, então item inválido é
 * erro que ele precisa corrigir.
 */
export function sanitizeMenuItems(raw: unknown): MenuItemInput[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    throw new MenuValidationError("O cardápio precisa ter pelo menos um item.");
  }
  if (raw.length > MAX_MENU_ITEMS) {
    throw new MenuValidationError(`O cardápio pode ter no máximo ${MAX_MENU_ITEMS} itens.`);
  }

  return raw.map((entry, index) => {
    const item = (entry ?? {}) as Record<string, unknown>;
    const name = cleanMenuText(item.name, MAX_MENU_NAME_LENGTH);
    const price = parseMenuPrice(item.price);

    if (!name) {
      throw new MenuValidationError(`Item ${index + 1}: informe o nome.`);
    }
    if (price === null) {
      throw new MenuValidationError(`"${name}": informe um preço válido.`);
    }

    return {
      section: cleanMenuText(item.section, MAX_MENU_SECTION_LENGTH),
      name,
      price,
    };
  });
}

/**
 * Valor da linha na comanda. Sem arredondar de propósito: as rules conferem
 * `price == menuItem.price * quantity` com a mesma aritmética de ponto
 * flutuante, então cliente, rules e Function precisam fazer a mesma conta.
 */
export function menuLinePrice(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

export type LinkedComandaItem = {
  name: string;
  price: number;
  quantity: number;
  settled: boolean;
  consumerUids: string[];
};

export type LinkedItemUpdate = {
  name?: string;
  price?: number;
  /** Preço unitário anterior, para o aviso — só quando o preço mudou. */
  oldUnitPrice?: number;
};

/**
 * O que muda num item da comanda quando o item do cardápio dele é editado.
 * `null` = nada a fazer: já está em dia, ou está congelado porque entrou numa
 * conta paga (mesmo critério de `isSettled`/`freeOfPaid` nas rules).
 */
export function planLinkedItemUpdate(
  item: LinkedComandaItem,
  menu: { name: string; price: number },
  paidUids: Iterable<string>,
): LinkedItemUpdate | null {
  const paid = new Set(paidUids);
  if (item.settled || item.consumerUids.some((uid) => paid.has(uid))) {
    return null;
  }

  const quantity = item.quantity >= 1 ? item.quantity : 1;
  const update: LinkedItemUpdate = {};

  const price = menuLinePrice(menu.price, quantity);
  if (item.price !== price) {
    update.price = price;
    update.oldUnitPrice = Math.round((item.price / quantity) * 100) / 100;
  }
  if (item.name !== menu.name) {
    update.name = menu.name;
  }

  return Object.keys(update).length > 0 ? update : null;
}

export type MenuFailureStatus =
  | "invalid-argument"
  | "resource-exhausted"
  | "deadline-exceeded"
  | "unavailable"
  | "internal";

/**
 * Tradução de `AiError.code` para o que o app mostra ao admin. `message: null`
 * = usar a mensagem do próprio AiError (já escrita para o usuário).
 */
export function describeAiFailure(code: AiErrorCode): {
  status: MenuFailureStatus;
  message: string | null;
} {
  switch (code) {
    case "invalid-input":
      return { status: "invalid-argument", message: null };
    case "rate-limited":
    case "no-credits":
      return {
        status: "resource-exhausted",
        message:
          "O limite de leituras de cardápio foi atingido. Tente mais tarde ou adicione os itens manualmente.",
      };
    case "timeout":
      return {
        status: "deadline-exceeded",
        message: "A leitura demorou demais. Tente de novo, de preferência com uma foto por vez.",
      };
    case "bad-response":
      return {
        status: "unavailable",
        message: "Não consegui ler o cardápio. Tente uma foto mais nítida e bem enquadrada.",
      };
    case "provider-unavailable":
      return {
        status: "unavailable",
        message: "O serviço de leitura está fora do ar. Tente de novo em instantes.",
      };
    case "missing-key":
    case "invalid-key":
    case "config-invalid":
    default:
      return {
        status: "internal",
        message: "A leitura de cardápio está indisponível no momento.",
      };
  }
}
