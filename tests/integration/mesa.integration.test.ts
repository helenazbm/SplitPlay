import { doc, getDoc } from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import {
  AlreadyInTableError,
  closeTable,
  createTable,
  joinTable,
  leaveTable,
} from "@/lib/services/tableService";

import {
  createRegisteredUser,
  getParticipantData,
  getTableData,
  getUserData,
  signOutCurrent,
  waitFor,
} from "./helpers";

describe("Integração: Mesa", () => {
  test("1. criar mesa: cria table, admin como participante e currentTableId", async () => {
    const admin = await createRegisteredUser("admin1@test.com", "Admin");

    const tableId = await createTable({ name: "Mesa Integração", tipPercent: 10 });

    const table = await getTableData(tableId);
    expect(table?.name).toBe("Mesa Integração");
    expect(table?.adminUid).toBe(admin.uid);
    expect(table?.status).toBe("aberta");
    expect(table?.paidUids).toEqual([]);

    const participant = await getParticipantData(tableId, admin.uid);
    expect(participant?.uid).toBe(admin.uid);
    expect(participant?.paid).toBe(false);
    expect(participant?.left).toBe(false);

    const user = await getUserData(admin.uid);
    expect(user?.currentTableId).toBe(tableId);
  });

  test("2. entrar na mesa: vira participante e atualiza currentTableId", async () => {
    const admin = await createRegisteredUser("admin2@test.com", "Admin");
    const tableId = await createTable({ name: "Mesa Join" });
    await signOutCurrent();

    const guest = await createRegisteredUser("guest2@test.com", "Guest");
    await joinTable(tableId);

    const participant = await getParticipantData(tableId, guest.uid);
    expect(participant?.displayName).toBe("Guest");
    expect(participant?.paid).toBe(false);

    const user = await getUserData(guest.uid);
    expect(user?.currentTableId).toBe(tableId);
    expect(admin.uid).not.toBe(guest.uid);
  });

  test("3. entrar na mesa bloqueia se já estiver em outra", async () => {
    await createRegisteredUser("a3@test.com", "A");
    const tableA = await createTable({ name: "Mesa A" });
    await signOutCurrent();

    await createRegisteredUser("b3@test.com", "B");
    const tableB = await createTable({ name: "Mesa B" });

    await expect(joinTable(tableA)).rejects.toBeInstanceOf(AlreadyInTableError);

    const user = await getUserData(auth.currentUser!.uid);
    expect(user?.currentTableId).toBe(tableB);
    expect(await getParticipantData(tableA, auth.currentUser!.uid)).toBeNull();
  });

  test("4. deixar a mesa: marca left e zera currentTableId", async () => {
    const user = await createRegisteredUser("leave4@test.com", "Leaver");
    const tableId = await createTable({ name: "Mesa Leave" });

    await leaveTable(tableId);

    const participant = await getParticipantData(tableId, user.uid);
    expect(participant?.left).toBe(true);

    const userDoc = await getUserData(user.uid);
    expect(userDoc?.currentTableId).toBeNull();
  });

  test("5. entrar em mesa encerrada falha", async () => {
    await createRegisteredUser("admin5@test.com", "Admin");
    const tableId = await createTable({ name: "Mesa Fechada" });
    await closeTable(tableId);
    await signOutCurrent();

    await createRegisteredUser("guest5@test.com", "Guest");
    await expect(joinTable(tableId)).rejects.toThrow(/não encontrada|encerrada/i);

    expect(await getParticipantData(tableId, auth.currentUser!.uid)).toBeNull();
  });

  test("19. quando o último participante ativo sai, a mesa encerra automaticamente", async () => {
    // Comportamento atual: auto-close ao sair o último ativo (não ao pagar todos).
    const admin = await createRegisteredUser("admin19@test.com", "Admin");
    const tableId = await createTable({ name: "Mesa AutoClose" });
    await signOutCurrent();

    const guest = await createRegisteredUser("guest19@test.com", "Guest");
    await joinTable(tableId);

    await leaveTable(tableId);
    await signOutCurrent();

    const { signInWithEmailAndPassword } = await import("firebase/auth");
    await signInWithEmailAndPassword(auth, "admin19@test.com", "senha123");
    expect(admin.uid).toBe(auth.currentUser!.uid);

    await leaveTable(tableId);

    await waitFor(
      async () => (await getTableData(tableId))?.status === "encerrada",
      { label: "mesa status encerrada" },
    );

    const tableSnap = await getDoc(doc(db, "tables", tableId));
    expect(tableSnap.data()?.status).toBe("encerrada");
    expect(guest.uid).toBeTruthy();
  });
});
