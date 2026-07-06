import { signInAnonymously, updateProfile } from "firebase/auth";
import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type { Participant } from "@/lib/types/participant";
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

/**
 * Retorna o id da mesa ATIVA (aberta) em que o usuário está, ou null.
 * Se o currentTableId apontar para uma mesa encerrada/inexistente (ex.: o admin
 * encerrou enquanto o usuário estava offline), limpa a referência e retorna null.
 */
async function getActiveTableId(
  userRef: ReturnType<typeof doc>,
  currentTableId: string | null | undefined,
): Promise<string | null> {
  if (!currentTableId) {
    return null;
  }

  const snapshot = await getDoc(doc(db, "tables", currentTableId));
  const table = snapshot.exists() ? (snapshot.data() as Table) : null;

  if (!table || table.status === "encerrada") {
    await updateDoc(userRef, {
      currentTableId: null,
      updatedAt: serverTimestamp(),
    });
    return null;
  }

  return currentTableId;
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
  const activeTableId = await getActiveTableId(
    userRef,
    userData.currentTableId as string | null | undefined,
  );
  if (activeTableId) {
    throw new AlreadyInTableError(activeTableId);
  }

  const tableId = generateTableId();
  const tableRef = doc(db, "tables", tableId);
  const participantRef = doc(db, "tables", tableId, "participants", current.uid);

  try {
    await setDoc(tableRef, {
      adminUid: current.uid,
      name: trimmedName,
      tipPercent: input.tipPercent ?? 10,
      couvertSuggested: input.couvertSuggested ?? 0,
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
      avatarUrl:
        (userData.avatarUrl as string | null | undefined) ?? current.photoURL ?? null,
      isAnonymous: false,
      joinedAt: serverTimestamp(),
      paid: false,
      paidAmount: 0,
      paidAt: null,
      tipEnabled: false,
      subtotalCents: 0,
      totalCents: 0,
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

/**
 * Retorna a mesa ATIVA (aberta) do usuário atual, ou null. Faz auto-cura:
 * se o currentTableId apontar para uma mesa encerrada/inexistente, libera.
 */
export async function getMyActiveTable(): Promise<{
  id: string;
  table: Table;
} | null> {
  const current = requireCurrentUser();

  const userRef = doc(db, "users", current.uid);
  const userSnapshot = await getDoc(userRef);
  if (!userSnapshot.exists()) {
    return null;
  }

  const activeTableId = await getActiveTableId(
    userRef,
    userSnapshot.data().currentTableId as string | null | undefined,
  );
  if (!activeTableId) {
    return null;
  }

  const tableSnapshot = await getDoc(doc(db, "tables", activeTableId));
  if (!tableSnapshot.exists()) {
    return null;
  }

  return { id: activeTableId, table: tableSnapshot.data() as Table };
}

/**
 * Adiciona o usuário autenticado (registrado ou anônimo) como participante da mesa.
 * Idempotente: se já for participante, apenas garante o currentTableId.
 */
export async function joinTable(tableId: string): Promise<void> {
  const current = requireCurrentUser();

  const tableSnapshot = await getDoc(doc(db, "tables", tableId));
  if (!tableSnapshot.exists()) {
    throw new Error("Mesa não encontrada. Confira o código.");
  }

  const table = tableSnapshot.data() as Table;
  if (table.status === "encerrada") {
    throw new Error("Essa mesa já foi encerrada.");
  }

  const userRef = doc(db, "users", current.uid);
  const userSnapshot = await getDoc(userRef);
  const userData = userSnapshot.exists() ? userSnapshot.data() : null;

  const participantRef = doc(db, "tables", tableId, "participants", current.uid);
  const alreadyParticipant = (await getDoc(participantRef)).exists();

  const activeTableId = await getActiveTableId(
    userRef,
    userData?.currentTableId as string | null | undefined,
  );

  if (alreadyParticipant) {
    if (activeTableId !== tableId) {
      await updateDoc(userRef, {
        currentTableId: tableId,
        updatedAt: serverTimestamp(),
      });
    }
    return;
  }

  if (activeTableId && activeTableId !== tableId) {
    throw new AlreadyInTableError(activeTableId);
  }

  const displayName =
    (userData?.displayName as string | undefined) ??
    current.displayName ??
    "Jogador";

  await setDoc(participantRef, {
    uid: current.uid,
    displayName,
    avatarUrl:
      (userData?.avatarUrl as string | null | undefined) ?? current.photoURL ?? null,
    isAnonymous: current.isAnonymous,
    joinedAt: serverTimestamp(),
    paid: false,
    paidAmount: 0,
    paidAt: null,
    tipEnabled: false,
    subtotalCents: 0,
    totalCents: 0,
  });

  await updateDoc(userRef, {
    currentTableId: tableId,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Entra na mesa como convidado anônimo, informando apenas um nome de exibição.
 * Cria uma sessão anônima no Firebase Auth + um doc users/{uid} mínimo.
 */
export async function joinTableAnonymously(
  tableId: string,
  displayName: string,
): Promise<void> {
  const trimmedName = displayName.trim();
  if (!trimmedName) {
    throw new Error("Informe um nome para entrar na mesa.");
  }

  const credential = await signInAnonymously(auth);
  const anonUser = credential.user;

  await updateProfile(anonUser, { displayName: trimmedName });

  // O Firebase reaproveita a sessão anônima salva no navegador, então o doc pode
  // já existir de uma entrada anterior. Um setDoc cego reescreveria createdAt e
  // seria negado pelas rules (createdAt/coins são imutáveis). Por isso: cria só se
  // não existir; se já existe, apenas atualiza o nome de exibição escolhido agora.
  const userRef = doc(db, "users", anonUser.uid);
  const existing = await getDoc(userRef);

  if (existing.exists()) {
    await updateDoc(userRef, {
      displayName: trimmedName,
      updatedAt: serverTimestamp(),
    });
  } else {
    await setDoc(userRef, {
      uid: anonUser.uid,
      type: "anonymous",
      displayName: trimmedName,
      email: null,
      coins: 0,
      ownedItemIds: [],
      currentTableId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await joinTable(tableId);
}

/**
 * Remove o usuário atual da mesa e libera o currentTableId.
 */
export async function leaveTable(tableId: string): Promise<void> {
  const current = requireCurrentUser();

  await deleteDoc(doc(db, "tables", tableId, "participants", current.uid));
  await updateDoc(doc(db, "users", current.uid), {
    currentTableId: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Encerra a mesa (só o admin, garantido pelas security rules). Os docs dos
 * participantes são preservados como histórico; cada cliente se desconecta
 * sozinho ao detectar o status "encerrada" (ver subscribeToTable).
 */
export async function closeTable(tableId: string): Promise<void> {
  await updateDoc(doc(db, "tables", tableId), {
    status: "encerrada",
    updatedAt: serverTimestamp(),
  });

  // O admin também sai da mesa.
  await releaseCurrentTable();
}

/**
 * Atualiza as configurações da mesa (couvert artístico e gorjeta sugerida em %).
 * Só o admin consegue (garantido pelas security rules). O couvert é por pessoa e
 * a gorjeta é uma sugestão opcional para cada participante.
 */
export async function updateTableSettings(
  tableId: string,
  settings: { couvertSuggested: number; tipPercent: number },
): Promise<void> {
  const couvert = Number.isFinite(settings.couvertSuggested)
    ? Math.max(0, settings.couvertSuggested)
    : 0;
  const tipPercent = Number.isFinite(settings.tipPercent)
    ? Math.max(0, settings.tipPercent)
    : 0;

  await updateDoc(doc(db, "tables", tableId), {
    couvertSuggested: couvert,
    tipPercent,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Transfere a administração da mesa para outro participante. Só o admin atual
 * consegue (garantido pelas security rules) e o novo admin precisa já ser
 * participante. O antigo admin permanece na mesa como participante comum.
 */
export async function transferAdmin(
  tableId: string,
  newAdminUid: string,
): Promise<void> {
  const current = requireCurrentUser();

  if (!newAdminUid || newAdminUid === current.uid) {
    return;
  }

  await updateDoc(doc(db, "tables", tableId), {
    adminUid: newAdminUid,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Libera o usuário atual da mesa (zera o currentTableId) sem apagar seu doc de
 * participante. Usado quando a mesa é encerrada.
 */
export async function releaseCurrentTable(): Promise<void> {
  const current = requireCurrentUser();

  await updateDoc(doc(db, "users", current.uid), {
    currentTableId: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Escuta o doc da mesa em tempo real (nome, status, admin). Retorna a função de
 * cancelamento. Entrega null se a mesa não existir mais.
 */
export function subscribeToTable(
  tableId: string,
  onChange: (table: Table | null) => void,
  onError?: (error: Error) => void,
): () => void {
  return onSnapshot(
    doc(db, "tables", tableId),
    (snapshot) => onChange(snapshot.exists() ? (snapshot.data() as Table) : null),
    (error) => onError?.(error),
  );
}

/**
 * Escuta a lista de participantes da mesa em tempo real.
 * Retorna a função de cancelamento da inscrição.
 */
export function subscribeToParticipants(
  tableId: string,
  onChange: (participants: Participant[]) => void,
  onError?: (error: Error) => void,
): () => void {
  const participantsQuery = query(
    collection(db, "tables", tableId, "participants"),
    orderBy("joinedAt", "asc"),
  );

  return onSnapshot(
    participantsQuery,
    (snapshot) => {
      const participants = snapshot.docs.map((entry) => {
        const data = entry.data();
        return {
          uid: data.uid as string,
          displayName: data.displayName as string,
          avatarUrl: (data.avatarUrl as string | null | undefined) ?? null,
          isAnonymous: Boolean(data.isAnonymous),
          joinedAt: data.joinedAt?.toDate?.() ?? new Date(),
          paid: Boolean(data.paid),
          paidAmount: (data.paidAmount as number) ?? 0,
          paidAt: data.paidAt?.toDate?.() ?? null,
          tipEnabled: Boolean(data.tipEnabled),
          subtotalCents: (data.subtotalCents as number) ?? 0,
          totalCents:
            (data.totalCents as number) ?? (data.subtotalCents as number) ?? 0,
        } satisfies Participant;
      });
      onChange(participants);
    },
    (error) => onError?.(error),
  );
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
