/**
 * @jest-environment node
 */

import { MenuResponseParser } from "@/functions/src/ai/menu/MenuResponseParser";

describe("MenuResponseParser", () => {
  const parser = new MenuResponseParser(300);

  test("lê JSON puro e JSON dentro de cerca markdown", () => {
    expect(parser.parse('{"items":[{"name":"Água","price":5}]}').items).toHaveLength(1);
    expect(
      parser.parse('Claro!\n```json\n{"items":[{"name":"Água","price":5}]}\n```').items,
    ).toHaveLength(1);
  });

  test("texto sem JSON vira AiError bad-response", () => {
    expect(() => parser.parse("não consegui ler")).toThrow(
      expect.objectContaining({ code: "bad-response" }),
    );
  });

  test("aceita preço como número ou string brasileira e limpa textos", () => {
    const parsed = parser.normalize({
      menuName: " Bar do Zé ",
      items: [
        { section: "Cervejas", name: "Long  neck", price: 12.9 },
        { section: null, name: "Porção", price: "R$ 1.234,50" },
        { section: "", name: "Água", price: "5,00" },
      ],
    });

    expect(parsed.menuName).toBe("Bar do Zé");
    expect(parsed.items).toEqual([
      { section: "Cervejas", name: "Long neck", price: 12.9 },
      { section: null, name: "Porção", price: 1234.5 },
      { section: null, name: "Água", price: 5 },
    ]);
    expect(parsed.discarded).toBe(0);
  });

  test("descarta sem nome, sem preço, preço absurdo e duplicados", () => {
    const parsed = parser.normalize({
      items: [
        { name: "", price: 10 },
        { name: "Sob consulta", price: null },
        { name: "Zero", price: 0 },
        { name: "Erro de leitura", price: 129000 },
        { name: "Caipirinha", price: 18 },
        { name: "caipirinha", price: 18 },
      ],
    });

    expect(parsed.items.map((item) => item.name)).toEqual(["Caipirinha"]);
    expect(parsed.discarded).toBe(5);
  });

  test("respeita o limite de itens", () => {
    const items = Array.from({ length: 5 }, (_, i) => ({ name: `Item ${i}`, price: i + 1 }));
    const parsed = new MenuResponseParser(3).normalize({ items });

    expect(parsed.items).toHaveLength(3);
    expect(parsed.discarded).toBe(2);
  });
});
