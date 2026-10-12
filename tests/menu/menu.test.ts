/**
 * @jest-environment node
 */

import {
  MAX_MENU_ITEMS,
  MenuValidationError,
  describeAiFailure,
  menuLinePrice,
  parseMenuPrice,
  planLinkedItemUpdate,
  sanitizeMenuItems,
  sanitizeMenuName,
} from "@/functions/src/menu";

describe("sanitizeMenuItems", () => {
  test("limpa espaços, arredonda o preço e transforma seção vazia em null", () => {
    expect(
      sanitizeMenuItems([
        { section: "  Cervejas ", name: " Long   neck ", price: 12.899 },
        { section: "", name: "Água", price: 5 },
      ]),
    ).toEqual([
      { section: "Cervejas", name: "Long neck", price: 12.9 },
      { section: null, name: "Água", price: 5 },
    ]);
  });

  test("recusa lista vazia ou que não é lista", () => {
    expect(() => sanitizeMenuItems([])).toThrow(MenuValidationError);
    expect(() => sanitizeMenuItems(undefined)).toThrow(MenuValidationError);
  });

  test("recusa item sem nome ou com preço inválido em vez de descartar", () => {
    expect(() => sanitizeMenuItems([{ section: null, name: " ", price: 10 }])).toThrow(
      "Item 1: informe o nome.",
    );
    expect(() => sanitizeMenuItems([{ section: null, name: "Pizza", price: 0 }])).toThrow(
      '"Pizza": informe um preço válido.',
    );
    expect(() => sanitizeMenuItems([{ section: null, name: "Pizza", price: "12,90" }])).toThrow(
      MenuValidationError,
    );
  });

  test("recusa mais itens que o limite", () => {
    const items = Array.from({ length: MAX_MENU_ITEMS + 1 }, (_, i) => ({
      section: null,
      name: `Item ${i}`,
      price: 1,
    }));
    expect(() => sanitizeMenuItems(items)).toThrow(MenuValidationError);
  });
});

describe("parseMenuPrice / sanitizeMenuName", () => {
  test("aceita só números positivos e plausíveis", () => {
    expect(parseMenuPrice(10)).toBe(10);
    expect(parseMenuPrice(-1)).toBeNull();
    expect(parseMenuPrice(Number.NaN)).toBeNull();
    expect(parseMenuPrice(10001)).toBeNull();
  });

  test("nome vazio vira null", () => {
    expect(sanitizeMenuName("   ")).toBeNull();
    expect(sanitizeMenuName(" Bar do Zé ")).toBe("Bar do Zé");
  });
});

describe("planLinkedItemUpdate", () => {
  const base = {
    name: "Long neck",
    price: 25.8,
    quantity: 2,
    settled: false,
    consumerUids: ["a"],
  };

  test("preço novo vira unitário × quantidade, guardando o unitário anterior", () => {
    expect(planLinkedItemUpdate(base, { name: "Long neck", price: 14 }, [])).toEqual({
      price: menuLinePrice(14, 2),
      oldUnitPrice: 12.9,
    });
  });

  test("só o nome mudou: não mexe no preço", () => {
    expect(planLinkedItemUpdate(base, { name: "Heineken", price: 12.9 }, [])).toEqual({
      name: "Heineken",
    });
  });

  test("nada mudou: null", () => {
    expect(planLinkedItemUpdate(base, { name: "Long neck", price: 12.9 }, [])).toBeNull();
  });

  test("item liquidado ou com alguém que já pagou fica congelado", () => {
    expect(
      planLinkedItemUpdate({ ...base, settled: true }, { name: "Long neck", price: 14 }, []),
    ).toBeNull();
    expect(planLinkedItemUpdate(base, { name: "Long neck", price: 14 }, ["a"])).toBeNull();
  });
});

describe("describeAiFailure", () => {
  test("foto inválida usa a mensagem do próprio erro", () => {
    expect(describeAiFailure("invalid-input")).toEqual({
      status: "invalid-argument",
      message: null,
    });
  });

  test("limite da IA vira resource-exhausted; problema de chave não vaza detalhe", () => {
    expect(describeAiFailure("rate-limited").status).toBe("resource-exhausted");
    expect(describeAiFailure("no-credits").status).toBe("resource-exhausted");
    expect(describeAiFailure("missing-key")).toEqual({
      status: "internal",
      message: "A leitura de cardápio está indisponível no momento.",
    });
  });
});
