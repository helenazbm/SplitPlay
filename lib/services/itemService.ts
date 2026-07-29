import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";

import { auth, db } from "@/lib/firebase";
import type {
  CreateTableItemInput,
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
    settled: data.settled === true,
    createdAt: data.createdAt,
    createdAtMs:
      (data.createdAt as { toMillis?: () => number } | null | undefined)
        ?.toMillis?.() ?? null,
    updatedAt: data.updatedAt,
  };
}

/** Normaliza/valida o conjunto de quem divide o item: dono sempre incluído, sem repetições. */
export function buildConsumerUids(ownerUid: string, consumerUids: string[]): string[] {
  const unique = new Set(consumerUids.filter(Boolean));
  unique.add(ownerUid);
  return Array.from(unique);
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "permission-denied"
  );
}

function toItemWriteError(error: unknown, fallback: string): Error {
  if (isPermissionDenied(error)) {
    return new Error(fallback);
  }
  return error instanceof Error ? error : new Error(fallback);
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

  try {
    const itemRef = await addDoc(collection(db, "tables", tableId, "items"), {
      name,
      price: input.price,
      quantity: input.quantity ?? 1,
      icon: input.icon ?? null,
      consumerUids,
      ownerUid: current.uid,
      settled: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return itemRef.id;
  } catch (error) {
    throw toItemWriteError(
      error,
      "Não foi possível lançar o item. Se você já fechou a conta, saia da mesa e entre novamente para consumir mais.",
    );
  }
}

export async function updateTableItem(
  tableId: string,
  itemId: string,
  input: UpdateTableItemInput,
) {
  const current = requireCurrentUser();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Nome do item é obrigatório.");
  }

  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Informe um valor válido.");
  }

  try {
    await updateDoc(doc(db, "tables", tableId, "items", itemId), {
      name,
      price: input.price,
      quantity: input.quantity ?? 1,
      icon: input.icon ?? null,
      consumerUids: buildConsumerUids(current.uid, input.consumerUids),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    throw toItemWriteError(
      error,
      "Não foi possível editar este item. Ele pode já ter sido pago ou pertencer a outra pessoa.",
    );
  }
}

export async function deleteTableItem(tableId: string, itemId: string) {
  requireCurrentUser();

  try {
    await deleteDoc(doc(db, "tables", tableId, "items", itemId));
  } catch (error) {
    throw toItemWriteError(
      error,
      "Não foi possível excluir este item. Ele pode já ter sido pago ou pertencer a outra pessoa.",
    );
  }
}