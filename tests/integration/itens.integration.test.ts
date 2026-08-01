import { auth } from "@/lib/firebase";
import {
  acceptItemInvite,
  createTableItem,
  declineItemInvite,
  leaveItem,
  updateItemDetails,
} from "@/lib/services/itemService";
import { createTable, joinTable } from "@/lib/services/tableService";
import { tipCents } from "@/lib/billing";

import {
  createRegisteredUser,
  getItemData,
  getParticipantData,
  signOutCurrent,
  waitFor,
  waitForTotalCents,
} from "./helpers";

describe("Integração: Itens", () => {
  test("8. adicionar item", async () => {
    const owner = await createRegisteredUser("owner8@test.com", "Owner");
    const tableId = await createTable({ name: "Mesa Item Add" });

    const itemId = await createTableItem(tableId, {
      name: "Pizza",
      price: 40,
      consumerUids: [],
    });

    const item = await getItemData(tableId, itemId);
    expect(item?.name).toBe("Pizza");
    expect(item?.price).toBe(40);
    expect(item?.ownerUid).toBe(owner.uid);
    expect(item?.consumerUids).toEqual([owner.uid]);
    expect(item?.pendingInvites).toEqual([]);
    expect(item?.settled).toBe(false);
  });

  test("9. editar item (participante aceito pode editar)", async () => {
    await createRegisteredUser("owner9@test.com", "Owner");
    const tableId = await createTable({ name: "Mesa Item Edit" });
    const itemId = await createTableItem(tableId, {
      name: "Suco",
      price: 10,
      consumerUids: [],
    });

    await updateItemDetails(tableId, itemId, {
      name: "Suco de Laranja",
      price: 12,
    });

    const item = await getItemData(tableId, itemId);
    expect(item?.name).toBe("Suco de Laranja");
    expect(item?.price).toBe(12);
  });

  test("10. apagar item (sair como único consumidor → CF remove o doc)", async () => {
    await createRegisteredUser("owner10@test.com", "Owner");
    const tableId = await createTable({ name: "Mesa Item Delete" });
    const itemId = await createTableItem(tableId, {
      name: "Batata",
      price: 15,
      consumerUids: [],
    });

    await leaveItem(tableId, itemId);

    await waitFor(
      async () => (await getItemData(tableId, itemId)) === null,
      { label: "item apagado pela Cloud Function" },
    );
  });

  test("11. convidar para dividir item: fica em pendingInvites", async () => {
    const owner = await createRegisteredUser("owner11@test.com", "Owner");
    const tableId = await createTable({ name: "Mesa Invite" });
    await signOutCurrent();

    const guest = await createRegisteredUser("guest11@test.com", "Guest");
    await joinTable(tableId);
    await signOutCurrent();

    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, "owner11@test.com", "senha123");

    const itemId = await createTableItem(tableId, {
      name: "Burger",
      price: 30,
      consumerUids: [guest.uid],
    });

    const item = await getItemData(tableId, itemId);
    expect(item?.consumerUids).toEqual([owner.uid]);
    expect(item?.pendingInvites).toEqual([guest.uid]);
  });

  test("12. aceitar convite de divisão: entra em consumerUids", async () => {
    const owner = await createRegisteredUser("owner12@test.com", "Owner");
    const tableId = await createTable({ name: "Mesa Accept" });
    await signOutCurrent();

    const guest = await createRegisteredUser("guest12@test.com", "Guest");
    await joinTable(tableId);
    await signOutCurrent();

    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, "owner12@test.com", "senha123");
    const itemId = await createTableItem(tableId, {
      name: "Pizza",
      price: 50,
      consumerUids: [guest.uid],
    });
    await signOutCurrent();

    await signInWithEmailAndPassword(auth, "guest12@test.com", "senha123");
    await acceptItemInvite(tableId, itemId);

    const item = await getItemData(tableId, itemId);
    expect(item?.consumerUids).toEqual(
      expect.arrayContaining([owner.uid, guest.uid]),
    );
    expect(item?.consumerUids).toHaveLength(2);
    expect(item?.pendingInvites).toEqual([]);
  });

  test("13. rejeitar convite de divisão: some do pendente e não divide", async () => {
    await createRegisteredUser("owner13@test.com", "Owner");
    const tableId = await createTable({ name: "Mesa Decline" });
    await signOutCurrent();

    const guest = await createRegisteredUser("guest13@test.com", "Guest");
    await joinTable(tableId);
    await signOutCurrent();

    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, "owner13@test.com", "senha123");
    const ownerUid = auth.currentUser!.uid;
    const itemId = await createTableItem(tableId, {
      name: "Açaí",
      price: 20,
      consumerUids: [guest.uid],
    });
    await signOutCurrent();

    await signInWithEmailAndPassword(auth, "guest13@test.com", "senha123");
    await declineItemInvite(tableId, itemId);

    const item = await getItemData(tableId, itemId);
    expect(item?.consumerUids).toEqual([ownerUid]);
    expect(item?.pendingInvites).toEqual([]);
  });

  test("14. após aceitar divisão, totais dos participantes refletem o split", async () => {
    await createRegisteredUser("owner14@test.com", "Owner");
    const tableId = await createTable({
      name: "Mesa Split Totals",
      tipPercent: 0,
      couvertSuggested: 0,
    });
    await signOutCurrent();

    const guest = await createRegisteredUser("guest14@test.com", "Guest");
    await joinTable(tableId);
    await signOutCurrent();

    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, "owner14@test.com", "senha123");
    const ownerUid = auth.currentUser!.uid;
    const itemId = await createTableItem(tableId, {
      name: "Conta",
      price: 10,
      consumerUids: [guest.uid],
    });
    await signOutCurrent();

    await signInWithEmailAndPassword(auth, "guest14@test.com", "senha123");
    await acceptItemInvite(tableId, itemId);

    // R$ 10,00 / 2 = 500 centavos cada (divisão exata).
    await waitForTotalCents(tableId, ownerUid, 500);
    await waitForTotalCents(tableId, guest.uid, 500);

    const ownerPart = await getParticipantData(tableId, ownerUid);
    const guestPart = await getParticipantData(tableId, guest.uid);
    expect(ownerPart?.subtotalCents).toBe(500);
    expect(guestPart?.subtotalCents).toBe(500);
    expect(tipCents(500, 0)).toBe(0);
  });
});
