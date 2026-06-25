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
  return {
    id: snapshotId,
    name: String(data.name ?? ""),
    price: Number(data.price ?? 0),
    consumerUid: String(data.consumerUid ?? ""),
    ownerUid: String(data.ownerUid ?? ""),
    createdAt: data.createdAt,
    updatedAt: data.updatedAt,
  };
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
  onChange: (participants: Array<{ uid: string; displayName: string }>) => void,
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

  const itemRef = await addDoc(collection(db, "tables", tableId, "items"), {
    name,
    price: input.price,
    consumerUid: input.consumerUid,
    ownerUid: current.uid,
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
    consumerUid: input.consumerUid,
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

  await deleteDoc(itemRef);

  await updateDoc(doc(db, "users", current.uid), {
    ownedItemIds: arrayRemove(itemId),
    updatedAt: serverTimestamp(),
  });
}