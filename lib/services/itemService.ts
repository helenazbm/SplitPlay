import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
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
  ItemPendingChange,
  TableItem,
  TableItemWithId,
  UpdateTableItemInput,
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
  }
  if (consumerUids.length === 0 && ownerUid) {
    consumerUids = [ownerUid];
  }

  return {
    id: snapshotId,
    name: String(data.name ?? ""),
    price: Number(data.price ?? 0),
    quantity: Number(data.quantity ?? 1) || 1,
    icon: data.icon ? String(data.icon) : null,
    consumerUids,
    ownerUid,
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
    pendingChange: normalizePendingChange(data.pendingChange),
  };
}

function normalizePendingChange(raw: unknown): ItemPendingChange | null {
  if (!raw || typeof raw !== "object") {
    return null;
  }

  const data = raw as Record<string, unknown>;
  const type = data.type === "delete" ? "delete" : data.type === "update" ? "update" : null;
  if (!type) {
    return null;
  }

  const awaitingUids = Array.isArray(data.awaitingUids)
    ? data.awaitingUids.map((uid) => String(uid)).filter(Boolean)
    : [];
  const confirmedUids = Array.isArray(data.confirmedUids)
    ? data.confirmedUids.map((uid) => String(uid)).filter(Boolean)
    : [];

  let proposedData = null as ItemPendingChange["proposedData"];
  if (type === "update" && data.proposedData && typeof data.proposedData === "object") {
    const proposed = data.proposedData as Record<string, unknown>;
    proposedData = {
      name: String(proposed.name ?? ""),
      price: Number(proposed.price ?? 0),
      quantity: Number(proposed.quantity ?? 1) || 1,
      icon: proposed.icon ? String(proposed.icon) : null,
      consumerUids: Array.isArray(proposed.consumerUids)
        ? proposed.consumerUids.map((uid) => String(uid)).filter(Boolean)
        : [],
    };
  }

  return {
    type,
    proposedBy: String(data.proposedBy ?? ""),
    proposedData,
    awaitingUids,
    confirmedUids,
    createdAt: data.createdAt,
  };
}

/** Normaliza/valida o conjunto de quem divide o item: dono sempre incluído, sem repetições. */
function buildConsumerUids(ownerUid: string, consumerUids: string[]): string[] {
  const unique = new Set(consumerUids.filter(Boolean));
  unique.add(ownerUid);
  return Array.from(unique);
}

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

export function subscribeToTableParticipants(
  tableId: string,
  onChange: (participants: Array<{ uid: string; displayName: string; avatarUrl?: string | null }>) => void,
  onError?: (error: Error) => void,
) {
  const participantsQuery = query(
    collection(db, "tables", tableId, "participants"),
    orderBy("joinedAt", "asc"),
  );

  return onSnapshot(
    participantsQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((participantSnapshot) => {
          const data = participantSnapshot.data() as Record<string, unknown>;

          return {
            uid: String(data.uid ?? participantSnapshot.id),
            displayName: String(data.displayName ?? "Participante"),
            avatarUrl: (data.avatarUrl as string | null | undefined) ?? null,
          };
        }),
      );
    },
    (error) => {
      onError?.(
        error instanceof Error
          ? error
          : new Error("Não foi possível carregar os participantes."),
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

  const consumerUids = buildConsumerUids(current.uid, input.consumerUids);

  const itemRef = await addDoc(collection(db, "tables", tableId, "items"), {
    name,
    price: input.price,
    quantity: input.quantity ?? 1,
    icon: input.icon ?? null,
    consumerUids,
    ownerUid: current.uid,
    pendingChange: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });

  await updateDoc(doc(db, "users", current.uid), {
    ownedItemIds: arrayUnion(itemRef.id),
    updatedAt: serverTimestamp(),
  });

  return itemRef.id;
}

export async function updateTableItem(
  tableId: string,
  itemId: string,
  input: UpdateTableItemInput,
) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  if (item.ownerUid !== current.uid) {
    throw new Error("Apenas o dono pode editar este item.");
  }

  if (item.consumerUids.length > 1) {
    throw new Error("Item compartilhado: proponha a alteração com proposeItemUpdate.");
  }

  const name = input.name.trim();
  if (!name) {
    throw new Error("Nome do item é obrigatório.");
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Informe um valor válido.");
  }

  await updateDoc(itemRef, {
    name,
    price: input.price,
    quantity: input.quantity ?? 1,
    icon: input.icon ?? null,
    consumerUids: buildConsumerUids(current.uid, input.consumerUids),
    updatedAt: serverTimestamp(),
  });
}

export async function deleteTableItem(tableId: string, itemId: string) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  if (item.ownerUid !== current.uid) {
    throw new Error("Apenas o dono pode excluir este item.");
  }

  if (item.consumerUids.length > 1) {
    throw new Error("Item compartilhado: proponha a exclusão com proposeItemDelete.");
  }

  await deleteDoc(itemRef);

  await updateDoc(doc(db, "users", current.uid), {
    ownedItemIds: arrayRemove(itemId),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Propõe uma edição em um item compartilhado. Qualquer consumidor do item
 * (dono ou não) pode propor; a mudança só é aplicada de fato (pela Cloud
 * Function) quando todos os outros consumidores confirmarem.
 */
export async function proposeItemUpdate(
  tableId: string,
  itemId: string,
  input: UpdateTableItemInput,
) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;

  if (item.consumerUids.length <= 1) {
    throw new Error("Item não é compartilhado.");
  }

  if (item.pendingChange) {
    throw new Error("Já existe uma proposta pendente para este item.");
  }

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

  // Força o dono real do item (não quem propõe) a permanecer na divisão.
  const proposedConsumerUids = buildConsumerUids(item.ownerUid, input.consumerUids);
  const awaitingUids = item.consumerUids.filter((uid) => uid !== current.uid);

  const pendingChange: ItemPendingChange = {
    type: "update",
    proposedBy: current.uid,
    proposedData: {
      name,
      price: input.price,
      quantity: input.quantity ?? 1,
      icon: input.icon ?? null,
      consumerUids: proposedConsumerUids,
    },
    awaitingUids,
    confirmedUids: [],
    createdAt: serverTimestamp(),
  };

  await updateDoc(itemRef, {
    pendingChange,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Propõe a exclusão de um item compartilhado. Só é excluído de fato (pela
 * Cloud Function) quando todos os outros consumidores confirmarem.
 */
export async function proposeItemDelete(tableId: string, itemId: string) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;

  if (item.consumerUids.length <= 1) {
    throw new Error("Item não é compartilhado.");
  }

  if (item.pendingChange) {
    throw new Error("Já existe uma proposta pendente para este item.");
  }

  if (!item.consumerUids.includes(current.uid)) {
    throw new Error("Você não participa deste item.");
  }

  const pendingChange: ItemPendingChange = {
    type: "delete",
    proposedBy: current.uid,
    proposedData: null,
    awaitingUids: item.consumerUids.filter((uid) => uid !== current.uid),
    confirmedUids: [],
    createdAt: serverTimestamp(),
  };

  await updateDoc(itemRef, {
    pendingChange,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Responde a uma proposta pendente de edição/exclusão. Confirmar entra em
 * confirmedUids (a Cloud Function aplica a mudança quando todos confirmarem);
 * recusar cancela a proposta imediatamente, sem alterar o item.
 */
export async function respondToItemProposal(
  tableId: string,
  itemId: string,
  accept: boolean,
) {
  const current = requireCurrentUser();
  const itemRef = doc(db, "tables", tableId, "items", itemId);
  const snapshot = await getDoc(itemRef);

  if (!snapshot.exists()) {
    throw new Error("Item não encontrado.");
  }

  const item = snapshot.data() as TableItem;
  const pending = item.pendingChange;

  if (!pending) {
    throw new Error("Não há proposta pendente para este item.");
  }

  if (!pending.awaitingUids.includes(current.uid)) {
    throw new Error("Você não precisa confirmar esta alteração.");
  }

  if (pending.confirmedUids.includes(current.uid)) {
    throw new Error("Você já confirmou esta alteração.");
  }

  if (accept) {
    await updateDoc(itemRef, {
      "pendingChange.confirmedUids": arrayUnion(current.uid),
      updatedAt: serverTimestamp(),
    });
  } else {
    await updateDoc(itemRef, {
      pendingChange: null,
      updatedAt: serverTimestamp(),
    });
  }
}