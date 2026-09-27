import { signInAnonymously, updateProfile } from "firebase/auth";
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";

import { httpsCallable } from "firebase/functions";

import { auth, db, functions } from "@/lib/firebase";
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

/**
 * Estado financeiro de quem acabou de entrar na mesa: nada consumido, nada
 * liquidado. As rules exigem exatamente esses valores no `create`.
 */
function freshParticipantState() {
  return {
    paid: false,
    paidAt: null,
    tipEnabled: false,
    subtotalCents: 0,
    totalCents: 0,
    settledSubtotalCents: 0,
    paidTotalCents: 0,
    settledThroughAt: null,
    couvertSettled: false,
    left: false,
  };
}

/**
 * Normaliza o doc do participante, incluindo mesas anteriores às rodadas de
 * consumo: `paidAmount` (em reais) vira `paidTotalCents`, e o consumo já pago
 * daquelas mesas continua em `subtotalCents` — por isso o default 0 aqui.
 */
export function toParticipant(
  data: Record<string, unknown>,
  fallbackUid?: string,
): Participant {
  const legacyPaidAmount = Number(data.paidAmount ?? 0);
  const paidAt = data.paidAt as { toDate?: () => Date } | null | undefined;
  const settledThroughAt = data.settledThroughAt as
    | { toDate?: () => Date }
    | null
    | undefined;
  const joinedAt = data.joinedAt as { toDate?: () => Date } | null | undefined;

  return {
    uid: String(data.uid ?? fallbackUid ?? ""),
    displayName: String(data.displayName ?? "Jogador"),
    avatarUrl: (data.avatarUrl as string | null | undefined) ?? null,
    isAnonymous: Boolean(data.isAnonymous),
    joinedAt: joinedAt?.toDate?.() ?? new Date(),
    paid: Boolean(data.paid),
    paidAt: paidAt?.toDate?.() ?? null,
    tipEnabled: Boolean(data.tipEnabled),
    subtotalCents: Number(data.subtotalCents ?? 0),
    totalCents: Number(data.totalCents ?? data.subtotalCents ?? 0),
    settledSubtotalCents: Number(data.settledSubtotalCents ?? 0),
    paidTotalCents: Number(
      data.paidTotalCents ?? Math.round(legacyPaidAmount * 100),
    ),
    settledThroughAt: settledThroughAt?.toDate?.() ?? null,
    couvertSettled: Boolean(data.couvertSettled),
    left: Boolean(data.left),
  };
}

export function requireCurrentUser() {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
}

export function generateTableId(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/**
 * Retorna a mesa ATIVA (aberta) em que o usuário está, ou null.
 * Se o currentTableId apontar para uma mesa encerrada/inexistente (ex.: o admin
 * encerrou enquanto o usuário estava offline), limpa a referência e retorna null.
 */
async function getActiveTable(
  userRef: ReturnType<typeof doc>,
  currentTableId: string | null | undefined,
): Promise<{ id: string; table: Table } | null> {
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

  return { id: currentTableId, table };
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
  const active = await getActiveTable(
    userRef,
    userData.currentTableId as string | null | undefined,
  );
  if (active) {
    throw new AlreadyInTableError(active.id);
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
      paidUids: [],
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
      ...freshParticipantState(),
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

  return getActiveTable(
    userRef,
    userSnapshot.data().currentTableId as string | null | undefined,
  );
}

/**
 * Reabre a participação de quem já pagou e voltou a consumir. É callable porque
 * `paid` e `paidUids` não podem ficar na mão do cliente — quem escreve `paid`
 * escreve quanto deve. Idempotente no servidor.
 */
export async function reopenParticipation(tableId: string): Promise<void> {
  const call = httpsCallable<{ tableId: string }, void>(
    functions,
    "reopenParticipation",
  );
  await call({ tableId });
}

/**
 * Adiciona o usuário autenticado (registrado ou anônimo) como participante da mesa.
 * Idempotente: se já for participante, apenas garante o currentTableId.
 */
export async function joinTable(tableId: string): Promise<void> {
  const current = requireCurrentUser();

  const userRef = doc(db, "users", current.uid);
  const userSnapshot = await getDoc(userRef);
  const userData = userSnapshot.exists() ? userSnapshot.data() : null;

  const active = await getActiveTable(
    userRef,
    userData?.currentTableId as string | null | undefined,
  );
  const activeTableId = active?.id ?? null;

  const table = activeTableId === tableId ? active!.table : await getTable(tableId);
  if (!table || table.status === "encerrada") {
    throw new Error("Mesa não encontrada. Confira o código.");
  }

  const participantRef = doc(db, "tables", tableId, "participants", current.uid);
  const participantSnapshot = await getDoc(participantRef);

  if (participantSnapshot.exists()) {
    if (participantSnapshot.data().paid === true) {
      await reopenParticipation(tableId);
    } else {
      await updateDoc(participantRef, { left: false });
    }

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
    ...freshParticipantState(),
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
      currentTableId: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  }

  await joinTable(tableId);
}

/**
 * Sai da mesa e libera o currentTableId.
 *
 * Igual para anônimo e registrado: a conta é preservada, então quem volta pelo
 * mesmo navegador reencontra o próprio participante (ver joinTable).
 */
export async function leaveTable(tableId: string): Promise<void> {
  const current = requireCurrentUser();

  await updateDoc(doc(db, "tables", tableId, "participants", current.uid), {
    left: true,
  });

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
      const participants = snapshot.docs.map((entry) =>
        toParticipant(entry.data(), entry.id),
      );
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
