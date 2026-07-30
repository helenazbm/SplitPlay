jest.mock("../../../../lib/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-user" } },
  app: {},
}));

import {
  centsToReais,
  isItemInCurrentRound,
  itemSharesByUid,
  reaisToCents,
  splitCents,
  userItemShareCents,
  userSubtotalCents,
  type BillItem,
} from "@/lib/billing";

describe("Billing Logic", () => {
  // Teste 1: reaisToCents
  test("reaisToCents: deve converter BRL para centavos corretamente", () => {
    expect(reaisToCents(10.5)).toBe(1050);
    expect(reaisToCents(0.99)).toBe(99);
    expect(reaisToCents(100)).toBe(10000);
  });

  // Teste 2: centsToReais
  test("centsToReais: deve converter centavos para BRL corretamente", () => {
    expect(centsToReais(1050)).toBe(10.5);
    expect(centsToReais(99)).toBe(0.99);
    expect(centsToReais(10000)).toBe(100);
  });

  // Teste 3: splitCents (divisão exata)
  test("splitCents: deve dividir centavos igualmente quando não há resto", () => {
    expect(splitCents(1000, 4)).toEqual([250, 250, 250, 250]);
  });

  // Teste 4: splitCents (com resto)
  test("splitCents: deve aplicar o 'maior resto' corretamente", () => {
    expect(splitCents(100, 3)).toEqual([34, 33, 33]);
    expect(splitCents(10, 3)).toEqual([4, 3, 3]);
  });

  // Teste 5: itemSharesByUid
  test("itemSharesByUid: deve calcular a parte de cada usuário em um item", () => {
        const shares = itemSharesByUid(29.99, ["user1", "user2", "user3"]);
        expect(shares.get("user1")).toBe(1000);
        expect(shares.get("user2")).toBe(1000);
        expect(shares.get("user3")).toBe(999);
    });

  // Teste 6: userItemShareCents
  test("userItemShareCents: deve retornar a parte de um usuário específico", () => {
    const item: BillItem = { price: 29.99, consumerUids: ["user1", "user2"] };
    // 2999 centavos / 2 = 1499.5 -> [1500, 1499]
    expect(userItemShareCents("user1", item)).toBe(1500);
    expect(userItemShareCents("user2", item)).toBe(1499);
    expect(userItemShareCents("user3", item)).toBe(0);
  });

  // Teste 7: userSubtotalCents (sem couvert)
  test("userSubtotalCents: deve calcular o subtotal de um usuário sem couvert", () => {
    const items: BillItem[] = [
      { price: 50, consumerUids: ["user1", "user2"] }, // user1: 2500
      { price: 20, consumerUids: ["user1"] }, // user1: 2000
    ];
    const subtotal = userSubtotalCents("user1", items, 0);
    expect(subtotal).toBe(4500); // 2500 + 2000
  });

  // Teste 8: userSubtotalCents (com couvert)
  test("userSubtotalCents: deve calcular o subtotal de um usuário com couvert", () => {
    const items: BillItem[] = [{ price: 50, consumerUids: ["user1", "user2"] }]; // user1: 2500
    const subtotal = userSubtotalCents("user1", items, 15); // 1500 centavos de couvert
    expect(subtotal).toBe(4000); // 2500 + 1500
  });

  // Teste 9: isItemInCurrentRound
  describe("isItemInCurrentRound", () => {
    test("deve retornar true se a rodada não foi liquidada", () => {
      const item = { createdAtMs: Date.now() } as BillItem;
      expect(isItemInCurrentRound(item, null)).toBe(true);
    });

    test("deve retornar true para itens criados após a última liquidação", () => {
      const settledThroughMs = Date.now() - 1000;
      const item = { createdAtMs: Date.now() } as BillItem;
      expect(isItemInCurrentRound(item, settledThroughMs)).toBe(true);
    });

    test("deve retornar false para itens criados antes da última liquidação", () => {
      const settledThroughMs = Date.now();
      const item = { createdAtMs: Date.now() - 1000 } as BillItem;
      expect(isItemInCurrentRound(item, settledThroughMs)).toBe(false);
    });

    test("deve retornar true se o item não tiver timestamp", () => {
      const item = { createdAtMs: null } as BillItem;
      expect(isItemInCurrentRound(item, Date.now())).toBe(true);
    });
  });
});
