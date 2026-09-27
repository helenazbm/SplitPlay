jest.mock("../../../../lib/firebase", () => ({
  db: {},
  auth: { currentUser: { uid: "test-user" } },
  app: {},
  functions: {},
}));

jest.mock("firebase/auth", () => ({
  deleteUser: jest.fn(),
  signInAnonymously: jest.fn(),
  signOut: jest.fn(),
  updateProfile: jest.fn(),
}));

jest.mock("firebase/firestore", () => ({
  collection: jest.fn(),
  deleteDoc: jest.fn(),
  doc: jest.fn(),
  getDoc: jest.fn(),
  onSnapshot: jest.fn(),
  orderBy: jest.fn(),
  query: jest.fn(),
  serverTimestamp: jest.fn(),
  setDoc: jest.fn(),
  updateDoc: jest.fn(),
}));

jest.mock("firebase/functions", () => ({
  httpsCallable: jest.fn(),
}));

import { leaveTable, toParticipant } from "@/lib/services/tableService";

describe("Table Service Helpers", () => {
  // Teste 12: toParticipant (dados modernos)
  test("toParticipant: deve normalizar um participante com dados modernos", () => {
    const data = {
      uid: "user1",
      displayName: "John Doe",
      paid: true,
      subtotalCents: 5000,
      totalCents: 5500,
    };
    const participant = toParticipant(data);
    expect(participant.uid).toBe("user1");
    expect(participant.displayName).toBe("John Doe");
    expect(participant.paid).toBe(true);
    expect(participant.subtotalCents).toBe(5000);
    expect(participant.totalCents).toBe(5500);
    expect(participant.paidTotalCents).toBe(0);
  });

  // Teste 13: toParticipant (dados legados)
  test("toParticipant: deve normalizar um participante com dados legados (paidAmount)", () => {
    const data = {
      uid: "user2",
      displayName: "Jane Doe",
      paidAmount: 45.5, // Legado, em reais
    };
    const participant = toParticipant(data);
    expect(participant.uid).toBe("user2");
    expect(participant.paidTotalCents).toBe(4550); // Convertido para centavos
    expect(participant.subtotalCents).toBe(0); // Default para 0
    expect(participant.totalCents).toBe(0); // Default para 0
  });
});
describe("leaveTable", () => {
  test("anônimo que sai preserva users/{uid} e a conta de auth", async () => {
    const { auth } = jest.requireMock("../../../../lib/firebase");
    const { deleteUser, signOut } = jest.requireMock("firebase/auth");
    const { deleteDoc, doc, updateDoc } = jest.requireMock("firebase/firestore");
    auth.currentUser = { uid: "anon-1", isAnonymous: true };
    doc.mockImplementation((_db: unknown, ...path: string[]) => path.join("/"));

    await leaveTable("mesa-1");

    expect(updateDoc).toHaveBeenCalledWith("tables/mesa-1/participants/anon-1", {
      left: true,
    });
    expect(updateDoc).toHaveBeenCalledWith(
      "users/anon-1",
      expect.objectContaining({ currentTableId: null }),
    );
    expect(deleteDoc).not.toHaveBeenCalled();
    expect(deleteUser).not.toHaveBeenCalled();
    expect(signOut).not.toHaveBeenCalled();
  });
});
