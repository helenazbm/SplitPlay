import { AiError } from "../errors/AiError";
import type { MenuItemDraft } from "./MenuTypes";

const MAX_NAME_LENGTH = 80;
const MAX_SECTION_LENGTH = 40;
/** Teto de sanidade: acima disso é quase certo erro de leitura (ex.: "1290" sem vírgula). */
const MAX_PRICE = 10000;

export type ParsedMenu = {
  menuName: string | null;
  items: MenuItemDraft[];
  discarded: number;
};

/**
 * Transforma o texto do modelo em itens confiáveis. Roda mesmo com structured
 * outputs: modelos :free não garantem o schema, e preço errado é bug de dinheiro.
 */
export class MenuResponseParser {
  constructor(private readonly maxItems: number) {}

  parse(text: string): ParsedMenu {
    let raw: unknown;
    try {
      raw = MenuResponseParser.extractJson(text);
    } catch (error) {
      throw new AiError("bad-response", `Resposta do modelo não é JSON válido: ${(error as Error).message}`);
    }
    return this.normalize(raw);
  }

  normalize(raw: unknown): ParsedMenu {
    const data = (raw ?? {}) as { menuName?: unknown; items?: unknown };
    const rawItems = Array.isArray(data.items) ? data.items : [];
    const items: MenuItemDraft[] = [];
    const seen = new Set<string>();
    let discarded = 0;

    for (const entry of rawItems) {
      const item = (entry ?? {}) as Record<string, unknown>;
      const name = MenuResponseParser.cleanText(item.name, MAX_NAME_LENGTH);
      const price = MenuResponseParser.toPrice(item.price);
      // Foto repetida ou página sobreposta duplica itens idênticos.
      const key = `${name?.toLowerCase()}|${price}`;

      if (!name || price === null || items.length >= this.maxItems || seen.has(key)) {
        discarded += 1;
        continue;
      }

      seen.add(key);
      items.push({
        section: MenuResponseParser.cleanText(item.section, MAX_SECTION_LENGTH),
        name,
        price,
      });
    }

    return {
      menuName: MenuResponseParser.cleanText(data.menuName, MAX_NAME_LENGTH),
      items,
      discarded,
    };
  }

  /** Aceita JSON puro ou dentro de cerca ```json``` (modelos sem JSON mode fazem isso). */
  static extractJson(text: string): unknown {
    const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    const body = (fenced ? fenced[1] : text).trim();
    const start = body.indexOf("{");
    const end = body.lastIndexOf("}");
    if (start === -1 || end <= start) {
      throw new Error("nenhum objeto JSON encontrado");
    }
    return JSON.parse(body.slice(start, end + 1));
  }

  private static cleanText(value: unknown, maxLength: number): string | null {
    if (typeof value !== "string") {
      return null;
    }
    const text = value.replace(/\s+/g, " ").trim();
    return text ? text.slice(0, maxLength) : null;
  }

  /** Número ou string brasileira: "12,90", "R$ 1.234,50", "12.90". */
  private static toPrice(value: unknown): number | null {
    let price: number;
    if (typeof value === "number") {
      price = value;
    } else if (typeof value === "string") {
      const digits = value.replace(/[^\d,.]/g, "");
      price = Number(digits.includes(",") ? digits.replace(/\./g, "").replace(",", ".") : digits);
    } else {
      return null;
    }

    if (!Number.isFinite(price) || price <= 0 || price > MAX_PRICE) {
      return null;
    }
    return Math.round(price * 100) / 100;
  }
}
