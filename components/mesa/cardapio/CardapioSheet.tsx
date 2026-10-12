"use client";

import { useMemo, useState } from "react";

import Avatar from "@/components/Avatar";
import AddMenuItemModal, { type MenuParticipant } from "@/components/mesa/cardapio/AddMenuItemModal";
import MenuCamera from "@/components/mesa/cardapio/MenuCamera";
import MenuCatalog, { MenuItemIcon, PillButton, brl } from "@/components/mesa/cardapio/MenuCatalog";
import MenuItemEditCard from "@/components/mesa/cardapio/MenuItemEditCard";
import MenuReviewSheet, { MenuRow } from "@/components/mesa/cardapio/MenuReviewSheet";
import MenuSheet, { SheetDashedButton, SheetPrimaryButton } from "@/components/mesa/cardapio/MenuSheet";
import { guessMenuItemIcon, normalizeSearch } from "@/lib/menu/menuView";
import {
  MENU_MAX_PHOTOS,
  addMenuItemToComanda,
  hideMenuItem,
  menuLinePrice,
  readMenuFromPhotos,
  saveMenu,
  updateMenuItem,
} from "@/lib/services/menuService";
import type { MenuDraft, MenuItemWithId, MenuReadResult } from "@/lib/types/menu";

/** Item escolhido no cardápio, ainda não enviado para a comanda. */
type CartEntry = {
  menuItemId: string;
  quantity: number;
  /** Com quem dividir, além de quem está pedindo. */
  sharedUids: string[];
};

type CardapioSheetProps = {
  tableId: string;
  isAdmin: boolean;
  menuItems: MenuItemWithId[];
  menuName: string | null;
  currentUid: string;
  /** Quem pode dividir um item (sem quem pagou/saiu e sem o usuário atual). */
  shareableParticipants: MenuParticipant[];
  /** Todos os participantes, para mostrar avatares. */
  participantByUid: Map<string, MenuParticipant>;
  onClose: () => void;
  onAddManual: () => void;
};

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

/**
 * Tela "Cardápio" (Figma P2): pedir itens do cardápio da mesa, editar o
 * cardápio e — para o admin — fotografar o cardápio para a IA ler.
 *
 * Pedir é em dois passos, como no Figma: cada item escolhido vai para um
 * carrinho (com quantidade e quem divide) e "Adicionar N itens na comanda"
 * grava tudo de uma vez.
 */
export default function CardapioSheet({
  tableId,
  isAdmin,
  menuItems,
  menuName,
  currentUid,
  shareableParticipants,
  participantByUid,
  onClose,
  onAddManual,
}: CardapioSheetProps) {
  const [mode, setMode] = useState<"browse" | "edit">("browse");
  const [cart, setCart] = useState<CartEntry[]>([]);
  const [picking, setPicking] = useState<MenuItemWithId | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const [cameraOpen, setCameraOpen] = useState(false);
  const [reading, setReading] = useState(false);
  const [readError, setReadError] = useState<string | null>(null);
  const [review, setReview] = useState<MenuReadResult | null>(null);
  const [alreadyInMenu, setAlreadyInMenu] = useState(0);
  const [reviewSaving, setReviewSaving] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);

  const menuById = useMemo(() => new Map(menuItems.map((item) => [item.id, item])), [menuItems]);
  // Item excluído do cardápio enquanto estava no carrinho some do pedido.
  const activeCart = useMemo(() => cart.filter((entry) => menuById.has(entry.menuItemId)), [cart, menuById]);
  const cartCount = activeCart.reduce((sum, entry) => sum + entry.quantity, 0);
  const pickingEntry = picking ? activeCart.find((entry) => entry.menuItemId === picking.id) : undefined;

  function upsertEntry(menuItemId: string, data: { quantity: number; sharedUids: string[] }) {
    setCart((current) => {
      const rest = current.filter((entry) => entry.menuItemId !== menuItemId);
      return [...rest, { menuItemId, ...data }];
    });
  }

  function changeQuantity(menuItemId: string, delta: number) {
    setCart((current) =>
      current
        .map((entry) =>
          entry.menuItemId === menuItemId
            ? { ...entry, quantity: Math.min(99, entry.quantity + delta) }
            : entry,
        )
        .filter((entry) => entry.quantity > 0),
    );
  }

  async function commitCart() {
    setCommitting(true);
    setCommitError(null);

    const pending = [...activeCart];
    try {
      while (pending.length > 0) {
        const entry = pending[0];
        const menuItem = menuById.get(entry.menuItemId);
        if (menuItem) {
          await addMenuItemToComanda(tableId, menuItem, {
            quantity: entry.quantity,
            consumerUids: [currentUid, ...entry.sharedUids],
            icon: guessMenuItemIcon(menuItem),
          });
        }
        pending.shift();
        // Tira do carrinho o que já foi: se o próximo falhar, não duplica.
        setCart((current) => current.filter((item) => item.menuItemId !== entry.menuItemId));
      }
      onClose();
    } catch (error) {
      setCommitError(errorMessage(error, "Não foi possível adicionar os itens. Tente de novo."));
    } finally {
      setCommitting(false);
    }
  }

  async function saveEdit(item: MenuItemWithId, data: { name: string; price: number }) {
    setEditSaving(true);
    setEditError(null);
    try {
      await updateMenuItem(tableId, item.id, { ...data, section: item.section });
      setEditingId(null);
    } catch (error) {
      setEditError(errorMessage(error, "Não foi possível salvar o item."));
    } finally {
      setEditSaving(false);
    }
  }

  async function deleteItem(item: MenuItemWithId) {
    setEditSaving(true);
    setEditError(null);
    try {
      await hideMenuItem(tableId, item.id);
      setEditingId(null);
    } catch (error) {
      setEditError(errorMessage(error, "Não foi possível excluir o item."));
    } finally {
      setEditSaving(false);
    }
  }

  async function readPhotos(photos: Blob[]) {
    setReading(true);
    setReadError(null);
    try {
      const result = await readMenuFromPhotos(tableId, photos);
      if (result.items.length === 0) {
        setReadError("Não encontrei itens com preço nessas fotos. Tente mais perto, com boa luz e o cardápio inteiro na moldura.");
        return;
      }
      // saveMenu só acrescenta: reler uma página já salva duplicaria os itens.
      const existing = new Set(menuItems.map((item) => normalizeSearch(item.name)));
      const fresh = result.items.filter((item) => !existing.has(normalizeSearch(item.name)));
      if (fresh.length === 0) {
        setReadError("Todos os itens dessas fotos já estão no cardápio.");
        return;
      }
      setAlreadyInMenu(result.items.length - fresh.length);
      setReviewError(null);
      setReview({ ...result, items: fresh });
      setCameraOpen(false);
    } catch (error) {
      setReadError(errorMessage(error, "Não consegui ler o cardápio. Tente de novo."));
    } finally {
      setReading(false);
    }
  }

  async function saveReview(draft: MenuDraft) {
    setReviewSaving(true);
    setReviewError(null);
    try {
      // Já há cardápio salvo: não sobrescreve o nome que a mesa escolheu.
      await saveMenu(tableId, { ...draft, menuName: menuItems.length > 0 ? null : draft.menuName });
      setReview(null);
      setMode("browse");
    } catch (error) {
      setReviewError(errorMessage(error, "Não foi possível salvar o cardápio."));
    } finally {
      setReviewSaving(false);
    }
  }

  function openCamera() {
    setReadError(null);
    setCameraOpen(true);
  }

  if (cameraOpen) {
    return (
      <MenuCamera
        maxPhotos={MENU_MAX_PHOTOS}
        reading={reading}
        error={readError}
        onCancel={() => setCameraOpen(false)}
        onSubmit={(photos) => void readPhotos(photos)}
      />
    );
  }

  if (review) {
    return (
      <MenuReviewSheet
        result={review}
        alreadyInMenu={alreadyInMenu}
        saving={reviewSaving}
        error={reviewError}
        onSave={(draft) => void saveReview(draft)}
        onRetake={() => {
          setReview(null);
          openCamera();
        }}
        onClose={() => setReview(null)}
      />
    );
  }

  const emptyMenu = (
    <div
      className="flex flex-col items-center rounded-[10px_10px_25px_10px] border border-dashed border-[#418964]/30 bg-[#f9f9f9] text-center"
      style={{ padding: "28px 20px", gap: "12px" }}
    >
      <i aria-hidden="true" className="pi pi-book text-[#da8280]" style={{ fontSize: "28px" }} />
      <p className="font-poppins font-semibold text-[#418964]" style={{ fontSize: "var(--text-fluid-base)" }}>
        Esta mesa ainda não tem cardápio
      </p>
      <p className="font-poppins text-[#8f8f8f]" style={{ fontSize: "var(--text-fluid-xs)" }}>
        {isAdmin
          ? "Tire uma foto do cardápio do restaurante ou envie imagens dele, e os itens aparecem aqui para todo mundo pedir."
          : "Quem criou a mesa pode fotografar ou enviar o cardápio. Enquanto isso, adicione o item à mão."}
      </p>
      {isAdmin ? (
        <button
          type="button"
          data-cy="cardapio-fotografar"
          onClick={openCamera}
          className="font-poppins flex items-center justify-center rounded-full bg-[#519472] font-semibold text-[#f2f1f1] transition hover:bg-[#478464]"
          style={{ height: "40px", paddingInline: "22px", fontSize: "13px", gap: "8px", marginTop: "4px" }}
        >
          <i aria-hidden="true" className="pi pi-camera" />
          Fotografar ou enviar cardápio
        </button>
      ) : null}
    </div>
  );

  if (mode === "edit") {
    return (
      <MenuSheet
        title="Editar Cardápio"
        subtitle={menuName}
        onClose={onClose}
        footer={
          <>
            {isAdmin ? (
              <SheetDashedButton onClick={openCamera} disabled={editSaving}>
                <i aria-hidden="true" className="pi pi-camera" />
                Fotografar ou enviar mais páginas
              </SheetDashedButton>
            ) : null}
            <SheetPrimaryButton
              onClick={() => {
                setEditingId(null);
                setEditError(null);
                setMode("browse");
              }}
              disabled={editSaving}
            >
              Finalizar Edição
            </SheetPrimaryButton>
          </>
        }
      >
        <MenuCatalog
          items={menuItems}
          empty={emptyMenu}
          renderItem={(item) =>
            editingId === item.id ? (
              <MenuItemEditCard
                item={item}
                saving={editSaving}
                error={editError}
                onSave={(data) => void saveEdit(item, data)}
                onDelete={() => void deleteItem(item)}
                onClose={() => {
                  setEditingId(null);
                  setEditError(null);
                }}
              />
            ) : (
              <MenuRow
                item={item}
                onEdit={() => {
                  setEditError(null);
                  setEditingId(item.id);
                }}
              />
            )
          }
        />
      </MenuSheet>
    );
  }

  return (
    <>
      <MenuSheet
        title="Cardápio"
        subtitle={menuName}
        onClose={onClose}
        headerAction={
          menuItems.length > 0 ? (
            <button
              type="button"
              onClick={() => setMode("edit")}
              className="font-poppins flex shrink-0 items-center justify-center rounded-[30px] bg-[#cde9da] font-semibold text-[#418964] transition hover:bg-[#bbe0cc]"
              style={{ width: "80px", height: "30px", fontSize: "13px" }}
            >
              Editar
            </button>
          ) : null
        }
        footer={
          <>
            {commitError ? (
              <p role="alert" className="font-poppins text-center text-[#c0392b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
                {commitError}
              </p>
            ) : null}
            <SheetDashedButton dataCy="cardapio-item-manual" onClick={onAddManual} disabled={committing}>
              Não achou? Adicionar item manual
            </SheetDashedButton>
            {menuItems.length > 0 ? (
              <SheetPrimaryButton
                dataCy="cardapio-adicionar-comanda"
                onClick={() => void commitCart()}
                disabled={committing || cartCount === 0}
              >
                {committing
                  ? "Adicionando..."
                  : cartCount === 0
                    ? "Escolha itens do cardápio"
                    : `Adicionar ${cartCount} ${cartCount === 1 ? "item" : "itens"} na comanda`}
              </SheetPrimaryButton>
            ) : null}
          </>
        }
      >
        <MenuCatalog
          items={menuItems}
          empty={emptyMenu}
          renderItem={(item) => {
            const entry = activeCart.find((candidate) => candidate.menuItemId === item.id);
            return entry ? (
              <SelectedMenuCard
                item={item}
                entry={entry}
                currentUid={currentUid}
                participantByUid={participantByUid}
                disabled={committing}
                onOpen={() => setPicking(item)}
                onChangeQuantity={(delta) => changeQuantity(item.id, delta)}
              />
            ) : (
              <div
                className="flex items-center rounded-[8px] border-[0.5px] border-[#5f9c7d] bg-[#f9f9f9]"
                style={{ minHeight: "60px", padding: "8px 16px 8px 10px", gap: "12px" }}
              >
                <MenuItemIcon item={item} size={38} />
                <div className="min-w-0 flex-1">
                  <p className="font-poppins truncate font-medium text-[#5b9a7a]" style={{ fontSize: "15px" }}>
                    {item.name}
                  </p>
                  <p className="font-poppins font-bold text-[#db8684]" style={{ fontSize: "15px" }}>
                    {brl.format(item.price)}
                  </p>
                </div>
                <PillButton label={`Pedir ${item.name}`} onClick={() => setPicking(item)} disabled={committing}>
                  <i aria-hidden="true" className="pi pi-plus" style={{ fontSize: "10px" }} />
                </PillButton>
              </div>
            );
          }}
        />
      </MenuSheet>

      {picking ? (
        <AddMenuItemModal
          key={picking.id}
          item={picking}
          participants={shareableParticipants}
          initialQuantity={pickingEntry?.quantity ?? 1}
          initialSharedUids={pickingEntry?.sharedUids ?? []}
          submitLabel={pickingEntry ? "Salvar" : "Adicionar"}
          onClose={() => setPicking(null)}
          onSubmit={(data) => {
            upsertEntry(picking.id, data);
            setPicking(null);
          }}
        />
      ) : null}
    </>
  );
}

/** Card do item escolhido (Figma): fundo verde-claro, quem divide e o stepper. */
function SelectedMenuCard({
  item,
  entry,
  currentUid,
  participantByUid,
  disabled,
  onOpen,
  onChangeQuantity,
}: {
  item: MenuItemWithId;
  entry: CartEntry;
  currentUid: string;
  participantByUid: Map<string, MenuParticipant>;
  disabled: boolean;
  onOpen: () => void;
  onChangeQuantity: (delta: number) => void;
}) {
  const uids = [currentUid, ...entry.sharedUids];

  return (
    <div className="overflow-hidden rounded-[8px] border-[1.5px] border-[#5f9c7d] bg-[rgba(81,148,114,0.1)]">
      <button
        type="button"
        onClick={onOpen}
        disabled={disabled}
        aria-label={`Ajustar ${item.name}`}
        className="flex w-full items-center text-left transition hover:bg-[rgba(81,148,114,0.06)]"
        style={{ minHeight: "50px", padding: "6px 12px 6px 6px", gap: "10px" }}
      >
        <MenuItemIcon item={item} size={40} />
        <span className="font-poppins min-w-0 flex-1 truncate font-medium text-[#5b9a7a]" style={{ fontSize: "15px" }}>
          {item.name}
        </span>
        <strong className="font-poppins shrink-0 font-bold text-[#db8684]" style={{ fontSize: "20px" }}>
          {brl.format(menuLinePrice(item.price, entry.quantity))}
        </strong>
      </button>

      <div
        className="flex items-center justify-between border-t-[0.5px] border-[#5f9c7d]"
        style={{ padding: "5px 12px 6px 10px", gap: "8px" }}
      >
        <div className="flex min-w-0 items-center" style={{ gap: "6px" }}>
          <div className="flex -space-x-1.5">
            {uids.slice(0, 3).map((uid) => {
              const participant = participantByUid.get(uid);
              return (
                <Avatar
                  key={uid}
                  name={participant?.displayName ?? "Você"}
                  avatarUrl={participant?.avatarUrl}
                  className="border border-white"
                  style={{ height: "20px", width: "20px" }}
                  textStyle={{ fontSize: "0.5rem" }}
                />
              );
            })}
          </div>
          <span className="font-poppins truncate text-[#8f8f8f]" style={{ fontSize: "10px" }}>
            {uids.length === 1 ? "Só você" : `${uids.length} participantes`}
          </span>
        </div>

        <div
          className="flex shrink-0 items-center overflow-hidden rounded-[30px] border-[0.5px] border-[#67a184] bg-white"
          style={{ height: "22px" }}
        >
          <button
            type="button"
            onClick={() => onChangeQuantity(-1)}
            disabled={disabled}
            aria-label={entry.quantity === 1 ? `Tirar ${item.name}` : "Diminuir quantidade"}
            className="font-poppins flex h-full items-center justify-center font-medium text-[#5b9a7a] transition hover:bg-[#eaf6ef] disabled:opacity-50"
            style={{ width: "24px", fontSize: "15px" }}
          >
            {entry.quantity === 1 ? (
              <i aria-hidden="true" className="pi pi-trash" style={{ fontSize: "10px" }} />
            ) : (
              "-"
            )}
          </button>
          <span
            aria-live="polite"
            className="font-poppins flex h-full items-center justify-center font-medium text-[#5b9a7a]"
            style={{ minWidth: "18px", fontSize: "15px" }}
          >
            {entry.quantity}
          </span>
          <button
            type="button"
            onClick={() => onChangeQuantity(1)}
            disabled={disabled}
            aria-label="Aumentar quantidade"
            className="font-poppins flex h-full items-center justify-center font-medium text-[#5b9a7a] transition hover:bg-[#eaf6ef] disabled:opacity-50"
            style={{ width: "24px", fontSize: "15px" }}
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
