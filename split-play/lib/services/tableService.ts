import {
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { CreateTableInput, Table } from "@/lib/types/table";

export class AlreadyInTableError extends Error {
  tableId: string;

  constructor(tableId: string) {
    super("Usuário já está em uma mesa.");
    this.name = "AlreadyInTableError";
    this.tableId = tableId;
  }
}

function requireCurrentUser() {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
}

function generateTableId(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

export async function createTable(input: CreateTableInput): Promise<string> {
  const current = requireCurrentUser();
  const trimmedName = input.name.trim();

  if (!trimmedName) {
    throw new Error("Nome da mesa é obrigatório.");
  }

  const userRef = doc(db, "users", current.uid);
  const userSnapshot = await getDoc(userRef);

  if (!userSnapshot.exists()) {
    throw new Error("Perfil não encontrado.");
  }

  const userData = userSnapshot.data();
  if (userData.currentTableId) {
    throw new AlreadyInTableError(userData.currentTableId as string);
  }

  const tableId = generateTableId();
  const tableRef = doc(db, "tables", tableId);
  const participantRef = doc(db, "tables", tableId, "participants", current.uid);

  try {
    await setDoc(tableRef, {
      adminUid: current.uid,
      name: trimmedName,
      tipSuggested: false,
      couvertSuggested: 0,
      status: "aberta",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    await setDoc(participantRef, {
      uid: current.uid,
      displayName:
        (userData.displayName as string | undefined) ??
        current.displayName ??
        "Jogador",
      isAnonymous: false,
      joinedAt: serverTimestamp(),
      paid: false,
      paidAmount: 0,
      paidAt: null,
      tipEnabled: false,
    });

    await updateDoc(userRef, {
      currentTableId: tableId,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    console.error("Erro ao criar mesa:", error);
    throw error;
  }

  return tableId;
}

export async function getTable(tableId: string): Promise<Table | null> {
  const snapshot = await getDoc(doc(db, "tables", tableId));
  if (!snapshot.exists()) {
    return null;
  }

  return snapshot.data() as Table;
}

export function getTableShareUrl(tableId: string): string {
  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ??
    (typeof window !== "undefined" ? window.location.origin : "");

  return `${base}/mesa/${tableId}`;
}

export function getFirestoreErrorMessage(error: unknown): string {
  if (
    error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: string }).code === "permission-denied"
  ) {
    return "Sem permissão no Firebase. Verifique se as regras do Firestore foram publicadas.";
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Não foi possível criar a mesa. Tente novamente.";
}
