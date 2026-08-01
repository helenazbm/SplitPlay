import { doc, updateDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import { tipCents } from "@/lib/billing";
import { createTableItem } from "@/lib/services/itemService";
import {
  pendingBalanceCents,
  registerPayment,
  setTipEnabled,
} from "@/lib/services/paymentService";
import { createTable, joinTable } from "@/lib/services/tableService";

import {
  createRegisteredUser,
  getParticipantData,
  getTableData,
  signOutCurrent,
  waitFor,
  waitForTotalCents,
} from "./helpers";

describe("Integração: Pagamento", () => {
  test("15. registrar pagamento: paid, paidTotalCents, paidAt e paidUids", async () => {
    const user = await createRegisteredUser("pay15@test.com", "Payer");
    const tableId = await createTable({
      name: "Mesa Pay",
      tipPercent: 0,
      couvertSuggested: 0,
    });

    await createTableItem(tableId, {
      name: "Refri",
      price: 10,
      consumerUids: [],
    });
    await waitForTotalCents(tableId, user.uid, 1000);

    await registerPayment(tableId);

    const participant = await getParticipantData(tableId, user.uid);
    expect(participant?.paid).toBe(true);
    expect(participant?.paidAt).toBeTruthy();
    expect(participant?.paidTotalCents).toBe(1000);
    expect(participant?.totalCents).toBe(0);

    const table = await getTableData(tableId);
    expect(table?.paidUids).toEqual(expect.arrayContaining([user.uid]));
  });

  test("16. ligar/desligar gorjeta antes de pagar atualiza totalCents", async () => {
    const user = await createRegisteredUser("tip16@test.com", "Tipper");
    const tableId = await createTable({
      name: "Mesa Tip",
      tipPercent: 10,
      couvertSuggested: 0,
    });

    await createTableItem(tableId, {
      name: "Prato",
      price: 100,
      consumerUids: [],
    });
    await waitForTotalCents(tableId, user.uid, 10000);

    await setTipEnabled(tableId, true);
    const withTip = 10000 + tipCents(10000, 10);
    await waitForTotalCents(tableId, user.uid, withTip);

    await setTipEnabled(tableId, false);
    await waitForTotalCents(tableId, user.uid, 10000);

    const data = await getParticipantData(tableId, user.uid);
    expect(data?.tipEnabled).toBe(false);
  });

  test("17. não permite alterar gorjeta depois de pagar", async () => {
    const user = await createRegisteredUser("tip17@test.com", "Tipper");
    const tableId = await createTable({
      name: "Mesa Tip Locked",
      tipPercent: 10,
      couvertSuggested: 0,
    });

    await createTableItem(tableId, {
      name: "Prato",
      price: 20,
      consumerUids: [],
    });
    await waitForTotalCents(tableId, user.uid, 2000);
    await registerPayment(tableId);

    await expect(setTipEnabled(tableId, true)).rejects.toThrow(
      /gorjeta|pagamento|encerrada/i,
    );

    const data = await getParticipantData(tableId, user.uid);
    expect(data?.tipEnabled).toBe(false);
    expect(data?.paid).toBe(true);
  });

  test("18. saldo pendente diminui após alguém pagar", async () => {
    await createRegisteredUser("a18@test.com", "A");
    const tableId = await createTable({
      name: "Mesa Pending",
      tipPercent: 0,
      couvertSuggested: 0,
    });
    await signOutCurrent();

    const b = await createRegisteredUser("b18@test.com", "B");
    await joinTable(tableId);
    await signOutCurrent();

    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, "a18@test.com", "senha123");
    const aUid = auth.currentUser!.uid;

    await createTableItem(tableId, {
      name: "Só A",
      price: 30,
      consumerUids: [],
    });
    await waitForTotalCents(tableId, aUid, 3000);
    await signOutCurrent();

    await signInWithEmailAndPassword(auth, "b18@test.com", "senha123");
    await createTableItem(tableId, {
      name: "Só B",
      price: 20,
      consumerUids: [],
    });
    await waitForTotalCents(tableId, b.uid, 2000);

    const beforePending = pendingBalanceCents([
      { paid: false, totalCents: 3000 },
      { paid: false, totalCents: 2000 },
    ]);
    expect(beforePending).toBe(5000);

    await signOutCurrent();
    await signInWithEmailAndPassword(auth, "a18@test.com", "senha123");
    await registerPayment(tableId);

    const aData = await getParticipantData(tableId, aUid);
    const bData = await getParticipantData(tableId, b.uid);
    const afterPending = pendingBalanceCents([
      {
        paid: Boolean(aData?.paid),
        totalCents: Number(aData?.totalCents ?? 0),
      },
      {
        paid: Boolean(bData?.paid),
        totalCents: Number(bData?.totalCents ?? 0),
      },
    ]);

    expect(aData?.paid).toBe(true);
    expect(bData?.paid).toBe(false);
    expect(afterPending).toBe(2000);
    expect(afterPending).toBeLessThan(beforePending);
  });
});

describe("Integração: Rules de pagamento", () => {
  test("20. participante não pode alterar totalCents pelo client", async () => {
    const user = await createRegisteredUser("rules20@test.com", "R");
    const tableId = await createTable({ name: "Mesa Rules Total" });

    await expect(
      updateDoc(doc(db, "tables", tableId, "participants", user.uid), {
        totalCents: 99999,
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });
  });

  test("21. participante não pode marcar pagamento de outro", async () => {
    const admin = await createRegisteredUser("rules21a@test.com", "A");
    const tableId = await createTable({ name: "Mesa Rules Other" });
    await signOutCurrent();

    const guest = await createRegisteredUser("rules21b@test.com", "B");
    await joinTable(tableId);

    await expect(
      updateDoc(doc(db, "tables", tableId, "participants", admin.uid), {
        paid: true,
      }),
    ).rejects.toMatchObject({ code: "permission-denied" });

    const adminData = await getParticipantData(tableId, admin.uid);
    expect(adminData?.paid).toBe(false);
    expect(guest.uid).toBe(auth.currentUser!.uid);
  });
});
