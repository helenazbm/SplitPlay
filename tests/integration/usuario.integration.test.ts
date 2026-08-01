import { auth } from "@/lib/firebase";
import { upgradeAnonymousAccount } from "@/lib/services/authService";
import {
  createTable,
  joinTableAnonymously,
} from "@/lib/services/tableService";

import {
  createRegisteredUser,
  getParticipantData,
  getUserData,
  signOutCurrent,
} from "./helpers";

describe("Integração: Usuário", () => {
  test("6. usuário anônimo criar conta sem perder dados", async () => {
    const admin = await createRegisteredUser("admin6@test.com", "Admin");
    const tableId = await createTable({ name: "Mesa Anon Upgrade" });
    await signOutCurrent();

    await joinTableAnonymously(tableId, "Convidado");
    const anonUid = auth.currentUser!.uid;
    expect(auth.currentUser!.isAnonymous).toBe(true);

    const beforeUser = await getUserData(anonUid);
    expect(beforeUser?.type).toBe("anonymous");
    expect(beforeUser?.currentTableId).toBe(tableId);
    expect(await getParticipantData(tableId, anonUid)).not.toBeNull();

    await upgradeAnonymousAccount({
      email: "convidado6@test.com",
      password: "senha123",
    });

    expect(auth.currentUser!.uid).toBe(anonUid);
    expect(auth.currentUser!.isAnonymous).toBe(false);

    const afterUser = await getUserData(anonUid);
    expect(afterUser?.type).toBe("registered");
    expect(afterUser?.email).toBe("convidado6@test.com");
    expect(afterUser?.currentTableId).toBe(tableId);
    expect(afterUser?.displayName).toBe("Convidado");

    const participant = await getParticipantData(tableId, anonUid);
    expect(participant?.uid).toBe(anonUid);
    expect(admin.uid).not.toBe(anonUid);
  });

  test("7. usuário anônimo entra na mesa com nome", async () => {
    await createRegisteredUser("admin7@test.com", "Admin");
    const tableId = await createTable({ name: "Mesa Anon Join" });
    await signOutCurrent();

    await joinTableAnonymously(tableId, "  Fernanda  ");

    expect(auth.currentUser?.isAnonymous).toBe(true);
    const uid = auth.currentUser!.uid;

    const user = await getUserData(uid);
    expect(user?.type).toBe("anonymous");
    expect(user?.displayName).toBe("Fernanda");
    expect(user?.currentTableId).toBe(tableId);

    const participant = await getParticipantData(tableId, uid);
    expect(participant?.displayName).toBe("Fernanda");
    expect(participant?.isAnonymous).toBe(true);
  });
});
