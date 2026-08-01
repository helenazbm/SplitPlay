jest.mock("../../../../lib/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-user" } },
  app: {},
}));

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  arrayRemove: jest.fn((...args: unknown[]) => ({ __op: "arrayRemove", args })),
  arrayUnion: jest.fn((...args: unknown[]) => ({ __op: "arrayUnion", args })),
  collection: jest.fn(() => "items-collection-ref"),
  doc: jest.fn(() => "item-doc-ref"),
  getDoc: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  updateDoc: jest.fn(),
}));

import { auth } from "@/lib/firebase";
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  getDoc,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import {
  PAID_MESSAGE,
  SETTLED_MESSAGE,
  acceptItemInvite,
  addItemParticipant,
  buildConsumerUids,
  createTableItem,
  declineItemInvite,
  leaveItem,
  removeItemParticipant,
  updateItemDetails,
} from "@/lib/services/itemService";

const addDocMock = addDoc as jest.Mock;
const arrayRemoveMock = arrayRemove as jest.Mock;
const arrayUnionMock = arrayUnion as jest.Mock;
const getDocMock = getDoc as jest.Mock;
const serverTimestampMock = serverTimestamp as jest.Mock;
const updateDocMock = updateDoc as jest.Mock;

/** Snapshot fake compatível com o retorno de getDoc usado pelo itemService. */
function makeSnapshot(data?: Record<string, unknown>, exists = true) {
  return {
    exists: () => exists,
    data: () => data,
  };
}

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

describe("Item Service Mutations", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    serverTimestampMock.mockReturnValue("SERVER_TIMESTAMP");
    addDocMock.mockResolvedValue({ id: "new-item-id" });
    updateDocMock.mockResolvedValue(undefined);
  });

  describe("createTableItem", () => {
    // Teste 14: createTableItem (validação de nome)
    test("deve rejeitar nome vazio sem chamar o Firestore", async () => {
      await expect(
        createTableItem("table1", {
          name: "   ",
          price: 10,
          consumerUids: [],
        }),
      ).rejects.toThrow("Nome do item é obrigatório.");
      expect(addDocMock).not.toHaveBeenCalled();
    });

    // Teste 15: createTableItem (validação de valor)
    test("deve rejeitar valor inválido sem chamar o Firestore", async () => {
      await expect(
        createTableItem("table1", {
          name: "Pizza",
          price: 0,
          consumerUids: [],
        }),
      ).rejects.toThrow("Informe um valor válido.");
      expect(addDocMock).not.toHaveBeenCalled();
    });

    // Teste 16: createTableItem (quem cria entra aceito; demais viram convite)
    test("deve criar o item com o criador aceito e os demais como convite pendente", async () => {
      await createTableItem("table1", {
        name: "Pizza",
        price: 50,
        consumerUids: ["test-user", "user2", "user3", "user2"],
      });

      expect(addDocMock).toHaveBeenCalledWith(
        "items-collection-ref",
        expect.objectContaining({
          name: "Pizza",
          price: 50,
          quantity: 1,
          icon: null,
          consumerUids: ["test-user"],
          pendingInvites: ["user2", "user3"],
          ownerUid: "test-user",
          settled: false,
          lastChange: null,
        }),
      );
    });

    // Teste 17: createTableItem (traduz permission-denied em PAID_MESSAGE)
    test("deve traduzir erro de permissão em PAID_MESSAGE", async () => {
      addDocMock.mockRejectedValueOnce({ code: "permission-denied" });

      await expect(
        createTableItem("table1", { name: "Pizza", price: 50, consumerUids: [] }),
      ).rejects.toThrow(PAID_MESSAGE);
    });
  });

  describe("updateItemDetails", () => {
    // Teste 18: updateItemDetails (item inexistente)
    test("deve rejeitar quando o item não existe", async () => {
      getDocMock.mockResolvedValueOnce(makeSnapshot(undefined, false));

      await expect(
        updateItemDetails("table1", "item1", { name: "Pizza", price: 10 }),
      ).rejects.toThrow("Item não encontrado.");
      expect(updateDocMock).not.toHaveBeenCalled();
    });

    // Teste 19: updateItemDetails (só quem participa pode editar)
    test("deve rejeitar quando o usuário não é consumidor do item", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["outro-user"] }),
      );

      await expect(
        updateItemDetails("table1", "item1", { name: "Pizza", price: 10 }),
      ).rejects.toThrow("Você não participa deste item.");
      expect(updateDocMock).not.toHaveBeenCalled();
    });

    // Teste 20: updateItemDetails (edição vale na hora, sem aprovação)
    test("deve editar nome e valor na hora, gravando lastChange do tipo update", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["test-user", "outro-user"] }),
      );

      await updateItemDetails("table1", "item1", {
        name: "Pizza Grande",
        price: 60,
        quantity: 2,
        icon: "pizza",
      });

      expect(updateDocMock).toHaveBeenCalledWith(
        "item-doc-ref",
        expect.objectContaining({
          name: "Pizza Grande",
          price: 60,
          quantity: 2,
          icon: "pizza",
          lastChange: {
            type: "update",
            byUid: "test-user",
            targetUid: null,
            at: "SERVER_TIMESTAMP",
          },
        }),
      );
    });

    // Teste 21: updateItemDetails (traduz permission-denied em SETTLED_MESSAGE)
    test("deve traduzir erro de permissão em SETTLED_MESSAGE", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["test-user"] }),
      );
      updateDocMock.mockRejectedValueOnce({ code: "permission-denied" });

      await expect(
        updateItemDetails("table1", "item1", { name: "Pizza", price: 10 }),
      ).rejects.toThrow(SETTLED_MESSAGE);
    });

    // Teste 22: updateItemDetails (erro sem ser de permissão passa direto)
    test("deve propagar erros que não são de permissão sem trocar a mensagem", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["test-user"] }),
      );
      updateDocMock.mockRejectedValueOnce(new Error("falha de rede"));

      await expect(
        updateItemDetails("table1", "item1", { name: "Pizza", price: 10 }),
      ).rejects.toThrow("falha de rede");
    });
  });

  describe("addItemParticipant", () => {
    // Teste 23: addItemParticipant (não deixa convidar quem já está no item)
    test("deve rejeitar quando o alvo já é consumidor ou já foi convidado", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["test-user"], pendingInvites: ["ja-convidado"] }),
      );

      await expect(
        addItemParticipant("table1", "item1", "ja-convidado"),
      ).rejects.toThrow("Este participante já está no item.");
      expect(updateDocMock).not.toHaveBeenCalled();
    });

    // Teste 24: addItemParticipant (convite fica pendente, ainda não divide o item)
    test("deve adicionar o alvo em pendingInvites e registrar o convite em lastChange", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["test-user"], pendingInvites: [] }),
      );

      await addItemParticipant("table1", "item1", "novo-user");

      expect(arrayUnionMock).toHaveBeenCalledWith("novo-user");
      expect(updateDocMock).toHaveBeenCalledWith(
        "item-doc-ref",
        expect.objectContaining({
          pendingInvites: { __op: "arrayUnion", args: ["novo-user"] },
          lastChange: {
            type: "invite",
            byUid: "test-user",
            targetUid: "novo-user",
            at: "SERVER_TIMESTAMP",
          },
        }),
      );
    });
  });

  describe("acceptItemInvite / declineItemInvite", () => {
    // Teste 25: acceptItemInvite (só quem foi convidado pode aceitar)
    test("acceptItemInvite: deve rejeitar quando não há convite pendente para o usuário", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["dono"], pendingInvites: [] }),
      );

      await expect(acceptItemInvite("table1", "item1")).rejects.toThrow(
        "Você não tem convite pendente para este item.",
      );
      expect(updateDocMock).not.toHaveBeenCalled();
    });

    // Teste 26: acceptItemInvite (aceitar move de pendingInvites pra consumerUids)
    test("acceptItemInvite: deve mover o usuário de pendingInvites para consumerUids", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["dono"], pendingInvites: ["test-user"] }),
      );

      await acceptItemInvite("table1", "item1");

      expect(arrayRemoveMock).toHaveBeenCalledWith("test-user");
      expect(arrayUnionMock).toHaveBeenCalledWith("test-user");
      expect(updateDocMock).toHaveBeenCalledWith(
        "item-doc-ref",
        expect.objectContaining({
          pendingInvites: { __op: "arrayRemove", args: ["test-user"] },
          consumerUids: { __op: "arrayUnion", args: ["test-user"] },
          lastChange: {
            type: "accept",
            byUid: "test-user",
            targetUid: null,
            at: "SERVER_TIMESTAMP",
          },
        }),
      );
    });

    // Teste 27: declineItemInvite (recusar nunca entra no rateio)
    test("declineItemInvite: deve remover de pendingInvites sem tocar em consumerUids", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["dono"], pendingInvites: ["test-user"] }),
      );

      await declineItemInvite("table1", "item1");

      expect(updateDocMock).toHaveBeenCalledWith(
        "item-doc-ref",
        expect.objectContaining({
          pendingInvites: { __op: "arrayRemove", args: ["test-user"] },
          lastChange: {
            type: "decline",
            byUid: "test-user",
            targetUid: null,
            at: "SERVER_TIMESTAMP",
          },
        }),
      );
      const call = updateDocMock.mock.calls[0][1];
      expect(call.consumerUids).toBeUndefined();
    });
  });

  describe("leaveItem", () => {
    // Teste 28: leaveItem (autoexclusão sem aprovação de ninguém)
    test("deve remover o próprio usuário de consumerUids e registrar lastChange leave", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["test-user", "outro-user"] }),
      );

      await leaveItem("table1", "item1");

      expect(arrayRemoveMock).toHaveBeenCalledWith("test-user");
      expect(updateDocMock).toHaveBeenCalledWith(
        "item-doc-ref",
        expect.objectContaining({
          consumerUids: { __op: "arrayRemove", args: ["test-user"] },
          lastChange: {
            type: "leave",
            byUid: "test-user",
            targetUid: null,
            at: "SERVER_TIMESTAMP",
          },
        }),
      );
    });

    // Teste 29: leaveItem (quem não participa não pode sair)
    test("deve rejeitar quando o usuário não participa do item", async () => {
      getDocMock.mockResolvedValueOnce(makeSnapshot({ consumerUids: ["outro-user"] }));

      await expect(leaveItem("table1", "item1")).rejects.toThrow(
        "Você não participa deste item.",
      );
      expect(updateDocMock).not.toHaveBeenCalled();
    });
  });

  describe("removeItemParticipant", () => {
    // Teste 30: removeItemParticipant (não pode remover a si mesmo por aqui)
    test("deve rejeitar remover a si mesmo, sem sequer consultar o Firestore", async () => {
      await expect(
        removeItemParticipant("table1", "item1", "test-user"),
      ).rejects.toThrow("Para remover a si mesmo, use a opção de sair do item.");
      expect(getDocMock).not.toHaveBeenCalled();
      expect(updateDocMock).not.toHaveBeenCalled();
    });

    // Teste 31: removeItemParticipant (alvo precisa estar no item)
    test("deve rejeitar quando o alvo não está no item", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["test-user"], pendingInvites: [] }),
      );

      await expect(
        removeItemParticipant("table1", "item1", "quem-nao-ta-no-item"),
      ).rejects.toThrow("Este participante não está no item.");
      expect(updateDocMock).not.toHaveBeenCalled();
    });

    // Teste 32: removeItemParticipant (remove de ambos os arrays, vale na hora)
    test("deve remover o alvo de consumerUids e pendingInvites, registrando quem removeu", async () => {
      getDocMock.mockResolvedValueOnce(
        makeSnapshot({ consumerUids: ["test-user", "alvo"], pendingInvites: [] }),
      );

      await removeItemParticipant("table1", "item1", "alvo");

      expect(updateDocMock).toHaveBeenCalledWith(
        "item-doc-ref",
        expect.objectContaining({
          consumerUids: { __op: "arrayRemove", args: ["alvo"] },
          pendingInvites: { __op: "arrayRemove", args: ["alvo"] },
          lastChange: {
            type: "remove",
            byUid: "test-user",
            targetUid: "alvo",
            at: "SERVER_TIMESTAMP",
          },
        }),
      );
    });
  });

  describe("requireCurrentUser", () => {
    const originalCurrentUser = auth.currentUser;

    afterEach(() => {
      // @ts-expect-error mock simplificado só tem currentUser
      auth.currentUser = originalCurrentUser;
    });

    // Teste 33: sem usuário logado, nenhuma mutação deve ir pro Firestore
    test("deve rejeitar qualquer mutação quando não há usuário autenticado", async () => {
      // @ts-expect-error mock simplificado só tem currentUser
      auth.currentUser = null;

      await expect(
        createTableItem("table1", { name: "Pizza", price: 10, consumerUids: [] }),
      ).rejects.toThrow("Usuário não autenticado.");
      expect(addDocMock).not.toHaveBeenCalled();
    });
  });
});
