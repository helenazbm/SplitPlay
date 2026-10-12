import { signInWithEmailAndPassword } from "firebase/auth";
import { addDoc, collection, doc, getDocs, orderBy, query, serverTimestamp, updateDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { auth, db, functions } from "@/lib/firebase";
import { registerPayment } from "@/lib/services/paymentService";
import {
  addMenuItemToComanda,
  saveMenu,
  updateMenuItem,
  updateMenuName,
} from "@/lib/services/menuService";
import { createTable, joinTable } from "@/lib/services/tableService";
import type { MenuItemWithId, MenuReadResult } from "@/lib/types/menu";

import {
  createRegisteredUser,
  getItemData,
  getTableData,
  signOutCurrent,
  waitFor,
  waitForTotalCents,
} from "./helpers";

/**
 * Sem `functions/.env.local`, o emulador usa o perfil mock da IA (cardápio de
 * exemplo com 6 itens) — não gasta cota nem precisa de chave.
 * `readMenuFromPhotos` redimensiona com canvas (só navegador), então aqui a
 * callable é chamada direto com uma imagem fake.
 */
const FAKE_IMAGE = { mimeType: "image/jpeg", base64: "AAAA" };

function readMenu(tableId: string) {
  return httpsCallable<unknown, MenuReadResult>(functions, "readMenu")({
    tableId,
    images: [FAKE_IMAGE],
  });
}

async function getMenuItems(tableId: string): Promise<MenuItemWithId[]> {
  const snap = await getDocs(
    query(collection(db, "tables", tableId, "menuItems"), orderBy("position")),
  );
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<MenuItemWithId, "id">) }));
}

/** Admin cria a mesa e salva um cardápio; convidado entra. Termina logado como convidado. */
async function tableWithMenuAndGuest(prefix: string) {
  const admin = await createRegisteredUser(`${prefix}-admin@test.com`, "Admin");
  const tableId = await createTable({ name: `Mesa ${prefix}`, tipPercent: 0 });
  await saveMenu(tableId, {
    menuName: "Bar Teste",
    items: [
      { section: "Cervejas", name: "Long neck", price: 12.9 },
      { section: "Petiscos", name: "Fritas", price: 25 },
    ],
  });
  await signOutCurrent();

  const guest = await createRegisteredUser(`${prefix}-guest@test.com`, "Convidado");
  await joinTable(tableId);
  const menu = await getMenuItems(tableId);

  return { admin, guest, tableId, menu };
}

describe("Integração: Cardápio", () => {
  test("admin lê o cardápio com IA: devolve os itens sem gravar nada", async () => {
    await createRegisteredUser("menu1@test.com", "Admin");
    const tableId = await createTable({ name: "Mesa Menu Read" });

    const { data } = await readMenu(tableId);

    expect(data.menuName).toBe("Bar de Exemplo");
    expect(data.items).toHaveLength(6);
    expect(data.items[0]).toEqual({ section: "Cervejas", name: "Long neck", price: 12.9 });
    expect(await getMenuItems(tableId)).toEqual([]);
  });

  test("só o admin lê e salva o cardápio", async () => {
    await createRegisteredUser("menu2-admin@test.com", "Admin");
    const tableId = await createTable({ name: "Mesa Menu Admin" });
    await signOutCurrent();

    await createRegisteredUser("menu2-guest@test.com", "Convidado");
    await joinTable(tableId);

    await expect(readMenu(tableId)).rejects.toMatchObject({ code: "functions/permission-denied" });
    await expect(
      saveMenu(tableId, { menuName: null, items: [{ section: null, name: "Água", price: 5 }] }),
    ).rejects.toMatchObject({ code: "functions/permission-denied" });
  });

  test("salvar cardápio revisado grava itens em ordem e o nome na mesa", async () => {
    await createRegisteredUser("menu3@test.com", "Admin");
    const tableId = await createTable({ name: "Mesa Menu Save" });

    const saved = await saveMenu(tableId, {
      menuName: "Bar do Zé",
      items: [
        { section: "Cervejas", name: "Long neck", price: 12.9 },
        { section: null, name: "Água", price: 5 },
      ],
    });

    expect(saved).toBe(2);
    const menu = await getMenuItems(tableId);
    expect(menu.map((m) => [m.name, m.price, m.position])).toEqual([
      ["Long neck", 12.9, 0],
      ["Água", 5, 1],
    ]);
    expect((await getTableData(tableId))?.menuName).toBe("Bar do Zé");
  });

  test("participante pede item do cardápio, mas não edita nome/preço na comanda", async () => {
    const { guest, tableId, menu } = await tableWithMenuAndGuest("menu4");
    const longNeck = menu[0];

    const itemId = await addMenuItemToComanda(tableId, longNeck, { quantity: 2 });
    const item = await getItemData(tableId, itemId);
    expect(item?.menuItemId).toBe(longNeck.id);
    expect(item?.price).toBe(12.9 * 2);
    await waitForTotalCents(tableId, guest.uid, 2580);

    // Direto no Firestore, sem a checagem do service: as rules barram.
    await expect(
      updateDoc(doc(db, "tables", tableId, "items", itemId), {
        price: 1,
        lastChange: { type: "update", byUid: guest.uid, targetUid: null, at: serverTimestamp() },
        updatedAt: serverTimestamp(),
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("rules recusam item do cardápio com preço diferente do cardápio", async () => {
    const { guest, tableId, menu } = await tableWithMenuAndGuest("menu5");

    await expect(
      addDoc(collection(db, "tables", tableId, "items"), {
        name: menu[0].name,
        price: 1,
        quantity: 1,
        icon: null,
        consumerUids: [guest.uid],
        pendingInvites: [],
        ownerUid: guest.uid,
        settled: false,
        lastChange: null,
        menuItemId: menu[0].id,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("participante muda o preço no cardápio: comanda acompanha e quem pediu é avisado", async () => {
    const { admin, tableId, menu } = await tableWithMenuAndGuest("menu6");
    const longNeck = menu[0];
    const guestUid = auth.currentUser!.uid;
    await signOutCurrent();

    // Admin pede 2 long necks.
    await signInWithEmailAndPassword(auth, "menu6-admin@test.com", "senha123");
    const itemId = await addMenuItemToComanda(tableId, longNeck, { quantity: 2 });
    await waitForTotalCents(tableId, admin.uid, 2580);
    await signOutCurrent();

    // Convidado corrige o preço no cardápio.
    await signInWithEmailAndPassword(auth, "menu6-guest@test.com", "senha123");
    await updateMenuItem(tableId, longNeck.id, { name: "Long neck", section: "Cervejas", price: 14 });

    await waitFor(
      async () => (await getItemData(tableId, itemId))?.price === 28,
      { label: "preço do item da comanda acompanhar o cardápio" },
    );
    const item = await getItemData(tableId, itemId);
    expect(item?.lastChange).toMatchObject({
      type: "menu-price",
      byUid: guestUid,
      oldPrice: 12.9,
      newPrice: 14,
    });

    await signOutCurrent();
    await signInWithEmailAndPassword(auth, "menu6-admin@test.com", "senha123");
    await waitForTotalCents(tableId, admin.uid, 2800);
  });

  test("item que entrou numa conta paga não muda com o cardápio", async () => {
    const { guest, tableId, menu } = await tableWithMenuAndGuest("menu7");
    const fritas = menu[1];

    const itemId = await addMenuItemToComanda(tableId, fritas);
    await waitForTotalCents(tableId, guest.uid, 2500);
    await registerPayment(tableId);
    await signOutCurrent();

    await signInWithEmailAndPassword(auth, "menu7-admin@test.com", "senha123");
    await updateMenuItem(tableId, fritas.id, { name: "Fritas", section: "Petiscos", price: 30 });

    // Dá tempo para o gatilho rodar; o item precisa continuar intacto.
    await new Promise((resolve) => setTimeout(resolve, 3000));
    const item = await getItemData(tableId, itemId);
    expect(item?.price).toBe(25);
    expect(item?.lastChange).toBeNull();
  });

  test("participante renomeia o cardápio", async () => {
    const { tableId } = await tableWithMenuAndGuest("menu8");

    await updateMenuName(tableId, "Bar Novo");

    expect((await getTableData(tableId))?.menuName).toBe("Bar Novo");
  });
});
