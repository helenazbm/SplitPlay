jest.mock("../../../../lib/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-user" } },
  app: {},
}));

import { buildConsumerUids } from "@/lib/services/itemService";

describe("Item Service Helpers", () => {
  // Teste 10: buildConsumerUids (básico)
  test("buildConsumerUids: deve adicionar o dono e remover duplicatas", () => {
    const ownerUid = "owner1";
    const consumerUids = ["user2", "user3", "user2"];
    const result = buildConsumerUids(ownerUid, consumerUids);
    expect(result).toHaveLength(3);
    expect(result).toContain("owner1");
    expect(result).toContain("user2");
    expect(result).toContain("user3");
  });

  // Teste 11: buildConsumerUids (dono já na lista)
  test("buildConsumerUids: não deve duplicar o dono se ele já estiver na lista", () => {
    const ownerUid = "owner1";
    const consumerUids = ["owner1", "user2"];
    const result = buildConsumerUids(ownerUid, consumerUids);
    expect(result).toHaveLength(2);
  });
});