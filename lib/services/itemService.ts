import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type {
  CreateTableItemInput,
  ItemLastChange,
  TableItem,
  TableItemWithId,
  UpdateItemDetailsInput,
} from "@/lib/types/item";

function requireCurrentUser() {
  const current = auth.currentUser;

  if (!current) {
    throw new Error("Usuário não autenticado.");
  }

  return current;
}

function normalizeItem(snapshotId: string, data: Record<string, unknown>): TableItemWithId {
  const ownerUid = String(data.ownerUid ?? "");

  // consumerUids é a fonte da verdade; mantém compat com o campo antigo
  // consumerUid (string única) de itens criados antes do compartilhamento.
  let consumerUids: string[] = [];
  if (Array.isArray(data.consumerUids)) {
    consumerUids = data.consumerUids.map((uid) => String(uid)).filter(Boolean);
  } else if (data.consumerUid) {
    consumerUids = [String(data.consumerUid)];
  } else if (ownerUid) {
    consumerUids = [ownerUid];
  }

  // pendingInvites é novo; docs antigos não têm o campo — compat = lista vazia.
  const pendingInvites = Array.isArray(data.pendingInvites)
    ? data.pendingInvites.map((uid) => String(uid)).filter(Boolean)
    : [];

  return {
    id: snapshotId,
    name: String(data.name ?? ""),
    price: Number(data.price ?? 0),
    quantity: Number(data.quantity ?? 1) || 1,
    icon: data.icon ? String(data.icon) : null,
    consumerUids,
    pendingInvites,
    ownerUid,
    settled: data.settled === true,
    createdAt: data.createdAt,
    // Usado pelas rodadas de consumo: item anterior ao último pagamento da
    // pessoa não volta para a conta dela (ver isItemInCurrentRound).
    createdAtMs:
      (data.createdAt as { toMillis?: () => number } | null | undefined)
        ?.toMillis?.() ?? null,
    updatedAt: data.updatedAt,
    lastChange: normalizeLastChange(data.lastChange),
  };
}

/** Normaliza/valida o conjunto de quem divide o item: dono sempre incluído, sem repetições. */
export function buildConsumerUids(ownerUid: string, consumerUids: string[]): string[] {
  const unique = new Set(consumerUids.filter(Boolean));
  unique.add(ownerUid);
  return Array.from(unique);
}

function normalizeLastChange(raw: unknown): ItemLastChange | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const validTypes = ["update", "invite", "accept", "decline", "leave", "remove"];
  const type = validTypes.includes(data.type as string)
    ? (data.type as ItemLastChange["type"])
    : null;

  if (!type || !data.byUid) {
    return null;
  }

  return {
    type,
    byUid: String(data.byUid),
    targetUid: data.targetUid ? String(data.targetUid) : null,
    at: data.at,
  };
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "permission-denied"
  );
}

/**
 * Traduz a negativa das security rules em mensagem de usuário.
 *
 * As validações locais de cada função abaixo cobrem o caso comum e dão a
 * mensagem específica; este catch só é alcançado quando as rules barram algo
 * que o cliente não sabia — item já liquidado, ou alguém da divisão que fechou
 * a conta (`isSettled`/`freeOfPaid` em firestore.rules).
 */
function toItemWriteError(error: unknown, fallback: string): Error {
  if (isPermissionDenied(error)) {
    return new Error(fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
}

export const SETTLED_MESSAGE =
  "Este item já entrou em uma conta paga e não pode mais ser alterado.";

export const PAID_MESSAGE =
  "Sua conta já foi paga. Para consumir mais, saia da mesa e entre novamente.";

export function subscribeToTableItems(
  tableId: string,
  onChange: (items: TableItemWithId[]) => void,
  onError?: (error: Error) => void,
) {
  const itemsQuery = query(
    collection(db, "tables", tableId, "items"),
    orderBy("createdAt", "desc"),
  );

  return onSnapshot(
    itemsQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((itemSnapshot) =>
          normalizeItem(itemSnapshot.id, itemSnapshot.data() as Record<string, unknown>),
        ),
      );
    },
    (error) => {
      onError?.(
        error instanceof Error ? error : new Error("Não foi possível carregar os itens."),
      );
    },
  );
}

export async function createTableItem(tableId: string, input: CreateTableItemInput) {
  const current = requireCurrentUser();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Nome do item é obrigatório.");
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Informe um valor válido.");
  }

  // Quem cria entra aceito de cara; os demais selecionados entram como
  // convite pendente (só passam a dividir o item depois que aceitarem).
  const pendingInvites = Array.from(
    new Set(input.consumerUids.filter((uid) => Boolean(uid) && uid !== current.uid)),
  );

  try {
    const itemRef = await addDoc(collection(db, "tables", tableId, "items"), {
      name,
      price: input.price,
      quantity: input.quantity ?? 1,
      icon: input.icon ?? null,
      consumerUids: [current.uid],
      pendingInvites,
      ownerUid: current.uid,
      settled: false,
      lastChange: null,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return itemRef.id;
  } catch (error) {
    throw toItemWriteError(error, PAID_MESSAGE);
  }
}

/** Edita nome/valor/quantidade/ícone. Vale na hora, sem aprovação de ninguém. */
export async function updateItemDetails(
  tableId: string,
  itemId: string,
  input: UpdateItemDetailsInput,
) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  if (!item.consumerUids.includes(current.uid)) {
    throw new Error("Você não participa deste item.");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("Nome do item é obrigatório.");
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Informe um valor válido.");
  }

  const lastChange: ItemLastChange = {
    type: "update",
    byUid: current.uid,
    targetUid: null,
    at: serverTimestamp(),
  };

  try {
    await updateDoc(itemRef, {
      name,
      price: input.price,
      quantity: input.quantity ?? 1,
      icon: input.icon ?? null,
      lastChange,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toItemWriteError(error, SETTLED_MESSAGE);
  }
}

/** Convida um novo participante. Ele só passa a dividir o item depois de aceitar. */
export async function addItemParticipant(tableId: string, itemId: string, targetUid: string) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  if (!item.consumerUids.includes(current.uid)) {
    throw new Error("Você não participa deste item.");
  }

  if (item.consumerUids.includes(targetUid) || item.pendingInvites.includes(targetUid)) {
    throw new Error("Este participante já está no item.");
  }

  const lastChange: ItemLastChange = {
    type: "invite",
    byUid: current.uid,
    targetUid,
    at: serverTimestamp(),
  };

  try {
    await updateDoc(itemRef, {
      pendingInvites: arrayUnion(targetUid),
      lastChange,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toItemWriteError(error, SETTLED_MESSAGE);
  }
}

/** Aceita um convite pendente: passa a dividir o item de fato. */
export async function acceptItemInvite(tableId: string, itemId: string) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  if (!item.pendingInvites.includes(current.uid)) {
    throw new Error("Você não tem convite pendente para este item.");
  }

  const lastChange: ItemLastChange = {
    type: "accept",
    byUid: current.uid,
    targetUid: null,
    at: serverTimestamp(),
  };

  try {
    await updateDoc(itemRef, {
      pendingInvites: arrayRemove(current.uid),
      consumerUids: arrayUnion(current.uid),
      lastChange,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toItemWriteError(
      error,
      "Não foi possível aceitar: sua conta já foi fechada ou o item já entrou em uma conta paga.",
    );
  }
}

/** Recusa um convite pendente: não entra no item, nunca é cobrado por ele. */
export async function declineItemInvite(tableId: string, itemId: string) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  if (!item.pendingInvites.includes(current.uid)) {
    throw new Error("Você não tem convite pendente para este item.");
  }

  const lastChange: ItemLastChange = {
    type: "decline",
    byUid: current.uid,
    targetUid: null,
    at: serverTimestamp(),
  };

  try {
    await updateDoc(itemRef, {
      pendingInvites: arrayRemove(current.uid),
      lastChange,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toItemWriteError(error, SETTLED_MESSAGE);
  }
}

/**
 * Autoexclusão: remove a própria participação do item, sem aprovação de
 * ninguém. Serve também para "excluir" um item onde você é o único
 * participante — a Cloud Function apaga o doc quando ele fica vazio.
 */
export async function leaveItem(tableId: string, itemId: string) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  if (!item.consumerUids.includes(current.uid)) {
    throw new Error("Você não participa deste item.");
  }

  const lastChange: ItemLastChange = {
    type: "leave",
    byUid: current.uid,
    targetUid: null,
    at: serverTimestamp(),
  };

  try {
    await updateDoc(itemRef, {
      consumerUids: arrayRemove(current.uid),
      lastChange,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toItemWriteError(error, SETTLED_MESSAGE);
  }
}

/** Remove outro participante (aceito ou convidado) do item. Vale na hora, sem aprovação. */
export async function removeItemParticipant(
  tableId: string,
  itemId: string,
  targetUid: string,
) {
  const current = requireCurrentUser();

  if (targetUid === current.uid) {
    throw new Error("Para remover a si mesmo, use a opção de sair do item.");
  }

  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  if (!item.consumerUids.includes(current.uid)) {
    throw new Error("Você não participa deste item.");
  }

  if (!item.consumerUids.includes(targetUid) && !item.pendingInvites.includes(targetUid)) {
    throw new Error("Este participante não está no item.");
  }

  const lastChange: ItemLastChange = {
    type: "remove",
    byUid: current.uid,
    targetUid,
    at: serverTimestamp(),
  };

  try {
    await updateDoc(itemRef, {
      consumerUids: arrayRemove(targetUid),
      pendingInvites: arrayRemove(targetUid),
      lastChange,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toItemWriteError(error, SETTLED_MESSAGE);
  }
}
