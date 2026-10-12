jest.mock("../../../../lib/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-user" } },
  functions: {},
  app: {},
}));

jest.mock("firebase/firestore", () => ({
  addDoc: jest.fn(),
  arrayRemove: jest.fn(),
  arrayUnion: jest.fn(),
  collection: jest.fn(() => "collection-ref"),
  doc: jest.fn(() => "doc-ref"),
  getDoc: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(() => "SERVER_TIMESTAMP"),
  updateDoc: jest.fn(),
}));

const callableMock = jest.fn();
jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(() => callableMock),
}));

import { addDoc, getDoc, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { MENU_ITEM_LOCKED_MESSAGE, updateItemDetails } from "@/lib/services/itemService";
import {
  addMenuItemToComanda,
  readMenuFromPhotos,
  saveMenu,
  updateMenuItem,
  updateMenuName,
} from "@/lib/services/menuService";

const addDocMock = addDoc as jest.Mock;
const getDocMock = getDoc as jest.Mock;
const updateDocMock = updateDoc as jest.Mock;
const httpsCallableMock = httpsCallable as jest.Mock;

describe("menuService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("addMenuItemToComanda: cria o item com nome do cardápio, preço × quantidade e menuItemId", async () => {
    addDocMock.mockResolvedValueOnce({ id: "item1" });

    const itemId = await addMenuItemToComanda(
      "table1",
      { id: "menu1", name: "Long neck", price: 12.9 },
      { quantity: 3, consumerUids: ["user2"] },
    );

    expect(itemId).toBe("item1");
    expect(addDocMock).toHaveBeenCalledWith(
      "collection-ref",
      expect.objectContaining({
        name: "Long neck",
        price: 12.9 * 3,
        quantity: 3,
        consumerUids: ["test-user"],
        pendingInvites: ["user2"],
        menuItemId: "menu1",
      }),
    );
  });

  test("addMenuItemToComanda: quantidade inválida vira 1", async () => {
    addDocMock.mockResolvedValueOnce({ id: "item1" });

    await addMenuItemToComanda("table1", { id: "menu1", name: "Água", price: 5 }, { quantity: 0 });

    expect(addDocMock).toHaveBeenCalledWith(
      "collection-ref",
      expect.objectContaining({ price: 5, quantity: 1 }),
    );
  });

  test("updateItemDetails: item vindo do cardápio não é editável na comanda", async () => {
    getDocMock.mockResolvedValueOnce({
      exists: () => true,
      data: () => ({ consumerUids: ["test-user"], pendingInvites: [], menuItemId: "menu1" }),
    });

    await expect(
      updateItemDetails("table1", "item1", { name: "Outro", price: 1 }),
    ).rejects.toThrow(MENU_ITEM_LOCKED_MESSAGE);
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  test("updateMenuItem: grava nome/seção/preço e quem editou", async () => {
    await updateMenuItem("table1", "menu1", { name: " Heineken ", section: " ", price: 14.999 });

    expect(updateDocMock).toHaveBeenCalledWith("doc-ref", {
      name: "Heineken",
      section: null,
      price: 15,
      updatedBy: "test-user",
      updatedAt: "SERVER_TIMESTAMP",
    });
  });

  test("updateMenuItem: valida nome e preço antes de escrever", async () => {
    await expect(
      updateMenuItem("table1", "menu1", { name: "", section: null, price: 10 }),
    ).rejects.toThrow("Nome do item é obrigatório.");
    await expect(
      updateMenuItem("table1", "menu1", { name: "Pizza", section: null, price: 0 }),
    ).rejects.toThrow("Informe um valor válido.");
    expect(updateDocMock).not.toHaveBeenCalled();
  });

  test("updateMenuName: grava só o nome do cardápio", async () => {
    await updateMenuName("table1", "  Bar do Zé ");

    expect(updateDocMock).toHaveBeenCalledWith("doc-ref", {
      menuName: "Bar do Zé",
      updatedAt: "SERVER_TIMESTAMP",
    });
  });

  test("saveMenu: chama a Cloud Function com a lista revisada", async () => {
    callableMock.mockResolvedValueOnce({ data: { saved: 1 } });

    const saved = await saveMenu("table1", {
      menuName: " Bar ",
      items: [{ section: " Bebidas ", name: " Suco ", price: 8 }],
    });

    expect(saved).toBe(1);
    expect(httpsCallableMock).toHaveBeenCalledWith({}, "saveMenu");
    expect(callableMock).toHaveBeenCalledWith({
      tableId: "table1",
      menuName: "Bar",
      items: [{ section: "Bebidas", name: "Suco", price: 8 }],
    });
  });

  test("saveMenu: recusa item sem preço sem chamar a Function", async () => {
    await expect(
      saveMenu("table1", { menuName: null, items: [{ section: null, name: "Suco", price: 0 }] }),
    ).rejects.toThrow('"Suco": informe um preço válido.');
    expect(callableMock).not.toHaveBeenCalled();
  });

  test("readMenuFromPhotos: valida a quantidade de fotos", async () => {
    await expect(readMenuFromPhotos("table1", [])).rejects.toThrow("Envie pelo menos uma foto.");
    await expect(
      readMenuFromPhotos("table1", [new Blob(), new Blob(), new Blob(), new Blob()]),
    ).rejects.toThrow("Envie no máximo 3 fotos por vez.");
  });
});
