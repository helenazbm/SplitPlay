import {
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { httpsCallable } from "firebase/functions";

import { auth, db, functions } from "@/lib/firebase";
import { createTableItem } from "@/lib/services/itemService";
import type {
  MenuDraft,
  MenuImageInput,
  MenuItemWithId,
  MenuReadResult,
  UpdateMenuItemInput,
} from "@/lib/types/menu";

/**
 * Fluxo do cardápio:
 *   1. Admin fotografa/envia → `readMenuFromPhotos` (IA lê, NADA é salvo).
 *   2. Admin revisa e corrige a lista no app → `saveMenu`.
 *   3. Todos veem `subscribeToMenu`; admin e participantes corrigem com
 *      `updateMenuItem` / `updateMenuName`.
 *   4. Participante pede → `addMenuItemToComanda`.
 *
 * Mudar o preço no cardápio atualiza sozinho os itens da comanda ligados a ele
 * (Cloud Function `onMenuItemWrite`), que ganham `lastChange.type = "menu-price"`.
 */

/** Lado maior da foto enviada à IA. Mais que isso só aumenta upload e tokens. */
export const MENU_IMAGE_MAX_SIDE = 1568;
const MENU_IMAGE_QUALITY = 0.8;
/** Igual a `limits.maxImages` em functions/src/ai/config/ai.config.json. */
export const MENU_MAX_PHOTOS = 3;

function requireCurrentUser() {
  const current = auth.currentUser;
  if (!current) {
    throw new Error("Usuário não autenticado.");
  }
  return current;
}

function isPermissionDenied(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "permission-denied"
  );
}

/** Mesma conta das rules (`matchesMenuItem`) e da Cloud Function — não arredondar. */
export function menuLinePrice(unitPrice: number, quantity: number): number {
  return unitPrice * quantity;
}

function normalizeMenuItem(id: string, data: Record<string, unknown>): MenuItemWithId {
  return {
    id,
    section: data.section ? String(data.section) : null,
    name: String(data.name ?? ""),
    price: Number(data.price ?? 0),
    position: Number(data.position ?? 0),
    updatedBy: String(data.updatedBy ?? ""),
    updatedAt: data.updatedAt,
  };
}

/**
 * Reduz a foto (câmera ou arquivo) para JPEG com no máximo
 * `MENU_IMAGE_MAX_SIDE` px no lado maior e devolve em base64. Só no navegador.
 */
export async function prepareMenuImage(file: Blob): Promise<MenuImageInput> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Não consegui abrir essa foto. Use JPEG, PNG ou WebP.");
  }

  const scale = Math.min(1, MENU_IMAGE_MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Não foi possível processar a foto.");
  }
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const dataUrl = canvas.toDataURL("image/jpeg", MENU_IMAGE_QUALITY);
  return { mimeType: "image/jpeg", base64: dataUrl.slice(dataUrl.indexOf(",") + 1) };
}

/**
 * Lê o cardápio das fotos com IA (só o admin). Devolve um rascunho para
 * revisão — nada é gravado até `saveMenu`. Os erros já vêm com mensagem
 * pronta para o usuário (limite atingido, foto ilegível...).
 */
export async function readMenuFromPhotos(
  tableId: string,
  photos: Blob[],
): Promise<MenuReadResult> {
  if (photos.length === 0) {
    throw new Error("Envie pelo menos uma foto.");
  }
  if (photos.length > MENU_MAX_PHOTOS) {
    throw new Error(`Envie no máximo ${MENU_MAX_PHOTOS} fotos por vez.`);
  }

  const images = await Promise.all(photos.map(prepareMenuImage));
  const call = httpsCallable<{ tableId: string; images: MenuImageInput[] }, MenuReadResult>(
    functions,
    "readMenu",
  );
  const { data } = await call({ tableId, images });
  return data;
}

/** Grava o cardápio revisado (só o admin). Acrescenta ao cardápio que já existir. */
export async function saveMenu(tableId: string, draft: MenuDraft): Promise<number> {
  const items = draft.items.map((item) => ({
    section: item.section?.trim() || null,
    name: item.name.trim(),
    price: item.price,
  }));

  const invalid = items.find((item) => !item.name || !Number.isFinite(item.price) || item.price <= 0);
  if (invalid) {
    throw new Error(
      invalid.name ? `"${invalid.name}": informe um preço válido.` : "Todo item precisa de nome.",
    );
  }

  const call = httpsCallable<
    { tableId: string; menuName: string | null; items: typeof items },
    { saved: number }
  >(functions, "saveMenu");
  const { data } = await call({ tableId, menuName: draft.menuName?.trim() || null, items });
  return data.saved;
}

/** Cardápio da mesa na ordem em que foi lido. */
export function subscribeToMenu(
  tableId: string,
  onChange: (items: MenuItemWithId[]) => void,
  onError?: (error: Error) => void,
) {
  const menuQuery = query(collection(db, "tables", tableId, "menuItems"), orderBy("position"));

  return onSnapshot(
    menuQuery,
    (snapshot) => {
      onChange(
        snapshot.docs.map((menuSnapshot) =>
          normalizeMenuItem(menuSnapshot.id, menuSnapshot.data() as Record<string, unknown>),
        ),
      );
    },
    (error) => {
      onError?.(
        error instanceof Error ? error : new Error("Não foi possível carregar o cardápio."),
      );
    },
  );
}

/**
 * Corrige nome/seção/preço de um item do cardápio (admin ou participante).
 * Mudança de preço se espalha para a comanda e gera aviso para quem pediu.
 */
export async function updateMenuItem(
  tableId: string,
  menuItemId: string,
  input: UpdateMenuItemInput,
): Promise<void> {
  const current = requireCurrentUser();
  const name = input.name.trim();

  if (!name) {
    throw new Error("Nome do item é obrigatório.");
  }
  if (!Number.isFinite(input.price) || input.price <= 0) {
    throw new Error("Informe um valor válido.");
  }

  try {
    await updateDoc(doc(db, "tables", tableId, "menuItems", menuItemId), {
      name,
      section: input.section?.trim() || null,
      price: Math.round(input.price * 100) / 100,
      updatedBy: current.uid,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    if (isPermissionDenied(error)) {
      throw new Error("Não foi possível editar o cardápio: a mesa pode ter sido encerrada.");
    }
    throw error;
  }
}

/** Renomeia o cardápio (admin ou participante). */
export async function updateMenuName(tableId: string, menuName: string): Promise<void> {
  requireCurrentUser();
  const name = menuName.trim();

  if (!name) {
    throw new Error("Nome do cardápio é obrigatório.");
  }

  await updateDoc(doc(db, "tables", tableId), {
    menuName: name,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Pede um item do cardápio: cria o item na comanda com nome e preço do
 * cardápio. Depois disso ele não é editável na comanda (só pelo cardápio), mas
 * convidar, sair e excluir funcionam como em qualquer item.
 */
export async function addMenuItemToComanda(
  tableId: string,
  menuItem: Pick<MenuItemWithId, "id" | "name" | "price">,
  options: { quantity?: number; consumerUids?: string[]; icon?: string | null } = {},
): Promise<string> {
  const quantity = Math.max(1, Math.trunc(options.quantity ?? 1));

  return createTableItem(tableId, {
    name: menuItem.name,
    price: menuLinePrice(menuItem.price, quantity),
    quantity,
    consumerUids: options.consumerUids ?? [],
    icon: options.icon ?? null,
    menuItemId: menuItem.id,
  });
}
