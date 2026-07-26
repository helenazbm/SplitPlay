"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import {
  createTableItem,
  deleteTableItem,
  updateTableItem,
} from "@/lib/services/itemService";
import type { TableItemWithId } from "@/lib/types/item";
import type { Participant } from "@/lib/types/participant";
import ComandaResumo from "@/components/mesa/ComandaResumo";
import CreateItemModal from "@/components/mesa/CreateItemModal";
import {
  centsToReais,
  isItemInCurrentRound,
  userItemShareCents,
  userSubtotalCents,
} from "@/lib/billing";
import { foodIconSrc } from "@/lib/foodIcons";
import Avatar from "@/components/Avatar";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MesaPedidosTabProps = {
  isCreateOpen: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  couvert?: number;
  items: TableItemWithId[];
  participants: Participant[];
  loadError?: string | null;
};

type ParticipantOption = {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
  paid?: boolean;
  left?: boolean;
  settledThroughAt?: Date | null;
  couvertSettled?: boolean;
  paidTotalCents?: number;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function MesaPedidosTab({
  isCreateOpen,
  onOpenCreate,
  onCloseCreate,
  couvert = 0,
  items,
  participants,
  loadError = null,
}: MesaPedidosTabProps) {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const { user } = useAuth();

  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);

  const participantOptions = useMemo<ParticipantOption[]>(() => {
    if (participants.length > 0) {
      return participants.map((participant) => ({
        uid: participant.uid,
        displayName: participant.displayName,
        avatarUrl: participant.avatarUrl ?? null,
        paid: participant.paid,
        left: participant.left,
        settledThroughAt: participant.settledThroughAt,
        couvertSettled: participant.couvertSettled,
        paidTotalCents: participant.paidTotalCents,
      }));
    }

    return user
      ? [
          {
            uid: user.uid,
            displayName: user.displayName ?? "Você",
            avatarUrl: user.photoURL ?? null,
            paid: false,
          },
        ]
      : [];
  }, [participants, user]);

  const participantByUid = useMemo(() => {
    const map = new Map<string, ParticipantOption>();
    for (const participant of participantOptions) {
      map.set(participant.uid, participant);
    }
    return map;
  }, [participantOptions]);

  const shareableParticipants = useMemo(
    () =>
      participantOptions.filter(
        (participant) => !participant.paid && !participant.left,
      ),
    [participantOptions],
  );

  const currentParticipant = useMemo(
    () => participantOptions.find((participant) => participant.uid === user?.uid) ?? null,
    [participantOptions, user?.uid],
  );

  const currentParticipantPaid = currentParticipant?.paid === true;
  const participantStatusResolved = user ? currentParticipant !== null : false;
  const disableAddItem = !participantStatusResolved || saving;

  // A aba mostra apenas os itens que o usuário logado consome (sozinho ou compartilhado).
  const myItems = useMemo(
    () => items.filter((item) => user && item.consumerUids.includes(user.uid)),
    [items, user],
  );

  const settledThroughMs =
    currentParticipant?.settledThroughAt?.getTime() ?? null;

  const isPaidByMe = useMemo(
    () => (item: TableItemWithId) =>
      !isItemInCurrentRound(
        {
          price: item.price,
          consumerUids: item.consumerUids,
          createdAtMs: item.createdAtMs,
        },
        settledThroughMs,
      ),
    [settledThroughMs],
  );

  const currentRoundItems = useMemo(
    () => myItems.filter((item) => !isPaidByMe(item)),
    [myItems, isPaidByMe],
  );

  const hasCouvert = couvert > 0 && currentParticipant?.couvertSettled !== true;

  // Item em edição (abre o modal pré-preenchido).
  const editingItem = items.find((it) => it.id === editingItemId) ?? null;

  // Total (sua parte) calculado em centavos + maior resto: itens que você
  // divide + couvert artístico. Evita erro de arredondamento do ponto flutuante.
  // Só a rodada ATUAL — o que já foi pago não volta para o total a pagar.
  const total = useMemo(
    () =>
      user
        ? centsToReais(
            userSubtotalCents(user.uid, currentRoundItems, couvert, {
              couvertSettled: currentParticipant?.couvertSettled === true,
            }),
          )
        : 0,
    [currentRoundItems, couvert, user, currentParticipant?.couvertSettled],
  );

  async function handleCreateItem(data: {
    name: string;
    price: number;
    quantity: number;
    consumerUids: string[];
    icon: string | null;
  }) {
    if (!user) {
      return;
    }

    if (currentParticipantPaid) {
      setError(
        "Sua conta já foi paga. Para consumir mais, saia da mesa e entre novamente.",
      );
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createTableItem(tableId, data);
      onCloseCreate();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível adicionar o item.",
      );
    } finally {
      setSaving(false);
    }
  }

  function handleOpenCreate() {
    if (currentParticipantPaid) {
      setError(
        "Sua conta já foi paga. Para consumir mais, saia da mesa e entre novamente.",
      );
      return;
    }

    if (!participantStatusResolved) {
      setError("Aguarde um instante enquanto validamos seu status de pagamento.");
      return;
    }

    onOpenCreate();
  }

  function beginEdit(item: TableItemWithId) {
    if (item.ownerUid !== user?.uid) {
      return;
    }
    setEditingItemId(item.id);
  }

  async function handleUpdateItem(data: {
    name: string;
    price: number;
    quantity: number;
    consumerUids: string[];
    icon: string | null;
  }) {
    if (!editingItemId || !user) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateTableItem(tableId, editingItemId, data);
      setEditingItemId(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível editar o item.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    setSaving(true);
    setError(null);

    try {
      await deleteTableItem(tableId, itemId);
      if (editingItemId === itemId) {
        setEditingItemId(null);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível excluir o item.",
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex flex-1 flex-col"
      role="tabpanel"
      aria-label="Pedidos"
      style={{ gap: "var(--spacing-fluid-4)" }}
    >
      <ComandaResumo
        itemCount={currentRoundItems.length}
        totalReais={total}
        paidReais={centsToReais(currentParticipant?.paidTotalCents ?? 0)}
      />

      <div
        className="flex items-center justify-between"
        style={{ gap: "var(--spacing-fluid-2)" }}
      >
        <h2
          className="font-poppins font-black text-[#e5786c]"
          style={{ fontSize: "20px" }}
        >
          Itens Pedidos
        </h2>

        <button
          type="button"
          onClick={handleOpenCreate}
          aria-label="Adicionar item"
          className="font-poppins flex shrink-0 items-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] active:scale-95 disabled:cursor-not-allowed disabled:bg-[#d8dfda] disabled:text-[#8a9a90] disabled:active:scale-100"
          disabled={disableAddItem}
          style={{
            height: "2rem",
            paddingInline: "var(--spacing-fluid-3)",
            fontSize: "var(--text-fluid-xs)",
            gap: "0.35rem",
          }}
        >
          Item
          <i aria-hidden="true" className="pi pi-plus" />
        </button>
      </div>

      {error ?? loadError ? (
        <p
          className="font-poppins rounded-[10px_10px_25px_10px] border border-[#fdebd0] bg-[#fff7e7] px-4 py-3 text-[#8a6d3b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          {error ?? loadError}
        </p>
      ) : null}

      <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-2)" }}>
        {myItems.map((item) => {
          const isOwner = item.ownerUid === user?.uid && !item.settled;
          const isShared = item.consumerUids.length > 1;
          const paidByMe = isPaidByMe(item);

          return (
            <article
              key={item.id}
              className="w-full border"
              style={{
                minHeight: "120px",
                borderColor: "#5F9C7D",
                borderWidth: "0.1px",
                borderRadius: "8px",
                backgroundColor: paidByMe ? "#F3F6F3" : "#FBFAF7",
                padding: "var(--spacing-fluid-3)",
              }}
            >
              <div
                className="flex items-center"
                style={{ gap: "var(--spacing-fluid-3)" }}
              >
                <span
                  aria-hidden="true"
                  className="flex shrink-0 items-center justify-center rounded-full bg-[#fdf3df]"
                  style={{ height: "2.75rem", width: "2.75rem" }}
                >
                  {foodIconSrc(item.icon) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={foodIconSrc(item.icon) as string}
                      alt=""
                      className="object-contain"
                      style={{ height: "1.75rem", width: "1.75rem" }}
                    />
                  ) : (
                    <i
                      className="pi pi-shopping-bag text-[#e5786c]"
                      style={{ fontSize: "var(--text-fluid-base)" }}
                    />
                  )}
                </span>

                <div className="min-w-0 flex-1">
                  <div
                    className="flex min-w-0 items-center"
                    style={{ gap: "var(--spacing-fluid-2)" }}
                  >
                    <h3
                      className="font-poppins truncate font-semibold text-[#418964]"
                      style={{ fontSize: "var(--text-fluid-sm)" }}
                    >
                      {item.name}
                    </h3>

                    {paidByMe ? (
                      <span
                        className="font-poppins shrink-0 rounded-full bg-[#CDE9DA] font-semibold text-[#5B9A7A]"
                        style={{
                          fontSize: "var(--text-fluid-xs)",
                          paddingInline: "0.5rem",
                          paddingBlock: "0.1rem",
                        }}
                      >
                        Pago
                      </span>
                    ) : null}
                  </div>
                  <p
                    className="font-poppins text-[#9bb0a4]"
                    style={{
                      marginTop: "var(--spacing-fluid-1)",
                      fontSize: "var(--text-fluid-xs)",
                    }}
                  >
                    ({item.quantity} {item.quantity === 1 ? "Item" : "Itens"}:{" "}
                    {brl.format(item.price)})
                  </p>
                </div>

                <strong
                  className="font-poppins shrink-0 font-bold text-[#e5786c]"
                  style={{ fontSize: "var(--text-fluid-base)" }}
                >
                  {brl.format(
                    centsToReais(userItemShareCents(user?.uid ?? "", item)),
                  )}
                </strong>
              </div>

              {isShared || isOwner || paidByMe ? (
                <div
                  className="flex items-center justify-between"
                  style={{
                    marginTop: "var(--spacing-fluid-3)",
                    paddingTop: "var(--spacing-fluid-2)",
                    gap: "var(--spacing-fluid-2)",
                    // linha ocupando toda a largura do card (anula o padding lateral)
                    marginInline: "calc(-1 * var(--spacing-fluid-3))",
                    paddingInline: "var(--spacing-fluid-3)",
                    borderTop: "0.1px solid #5F9C7D",
                  }}
                >
                  {isShared ? (
                    <div
                      className="flex min-w-0 items-center"
                      style={{ gap: "var(--spacing-fluid-2)" }}
                    >
                      <div className="flex -space-x-2">
                        {item.consumerUids.slice(0, 3).map((uid) => {
                          const p = participantByUid.get(uid);
                          return (
                            <Avatar
                              key={uid}
                              name={
                                uid === user?.uid
                                  ? (p?.displayName ?? "Você")
                                  : (p?.displayName ?? "?")
                              }
                              avatarUrl={p?.avatarUrl}
                              className="border-2 border-white"
                              style={{ height: "1.5rem", width: "1.5rem" }}
                              textStyle={{ fontSize: "0.55rem" }}
                            />
                          );
                        })}
                      </div>
                      <span
                        className="font-poppins truncate text-[#64835b]"
                        style={{ fontSize: "var(--text-fluid-xs)" }}
                      >
                        {item.consumerUids.length} participantes
                      </span>
                    </div>
                  ) : (
                    <span
                      className="font-poppins text-[#9bb0a4]"
                      style={{ fontSize: "var(--text-fluid-xs)" }}
                    >
                      
                    </span>
                  )}

                  {isOwner ? (
                    <div
                      className="flex shrink-0 items-stretch overflow-hidden rounded-full border border-[#5F9C7D]"
                      style={{ width: "60px", height: "20px" }}
                    >
                      <button
                        type="button"
                        aria-label="Excluir item"
                        disabled={saving}
                        onClick={() => void handleDelete(item.id)}
                        className="flex flex-1 items-center justify-center text-[#5F9C7D] transition hover:bg-[#eaf6ef] disabled:opacity-50"
                      >
                        <i
                          aria-hidden="true"
                          className="pi pi-trash"
                          style={{ fontSize: "0.7rem" }}
                        />
                      </button>
                      <span
                        aria-hidden="true"
                        className="w-px self-stretch bg-[#5F9C7D]/70"
                      />
                      <button
                        type="button"
                        aria-label="Editar item"
                        disabled={saving}
                        onClick={() => beginEdit(item)}
                        className="flex flex-1 items-center justify-center text-[#5F9C7D] transition hover:bg-[#eaf6ef] disabled:opacity-50"
                      >
                        <i
                          aria-hidden="true"
                          className="pi pi-pencil"
                          style={{ fontSize: "0.7rem" }}
                        />
                      </button>
                    </div>
                  ) : paidByMe ? (
                    <span
                      className="font-poppins flex shrink-0 items-center font-semibold text-[#5B9A7A]"
                      style={{
                        fontSize: "var(--text-fluid-xs)",
                        gap: "0.25rem",
                      }}
                    >
                      <i
                        aria-hidden="true"
                        className="pi pi-check-circle"
                        style={{ fontSize: "0.7rem" }}
                      />
                      Pago
                    </span>
                  ) : null}
                </div>
              ) : null}

            </article>
          );
        })}

        {hasCouvert ? (
          <article
            className="w-full border"
            style={{
              minHeight: "88px",
              borderColor: "#B0B0B0",
              borderWidth: "0.5px",
              borderRadius: "8px",
              backgroundColor: "#F8F8F8",
              padding: "var(--spacing-fluid-3)",
            }}
          >
            <div
              className="flex items-start justify-between"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <div className="min-w-0">
                <h3
                  className="font-poppins truncate font-semibold text-[#747474]"
                  style={{ fontSize: "var(--text-fluid-sm)" }}
                >
                  Couvert artístico
                </h3>
                <p
                  className="font-poppins text-[#8F8F8F]"
                  style={{
                    marginTop: "var(--spacing-fluid-1)",
                    fontSize: "var(--text-fluid-xs)",
                  }}
                >
                  Fixo do estabelecimento · por pessoa
                </p>
              </div>

              <strong
                className="font-poppins shrink-0 text-[#e5786c]"
                style={{ fontSize: "var(--text-fluid-sm)" }}
              >
                {brl.format(couvert)}
              </strong>
            </div>
          </article>
        ) : null}

        {myItems.length === 0 && !hasCouvert ? (
          <div className="rounded-[10px_10px_25px_10px] border border-dashed border-[#418964]/25 bg-white p-6 text-center">
            <p
              className="font-poppins text-[#64835b]"
              style={{ fontSize: "var(--text-fluid-sm)" }}
            >
              Você ainda não tem itens. Toque em “Item +”.
            </p>
          </div>
        ) : null}
      </div>

      {isCreateOpen && !disableAddItem ? (
        <CreateItemModal
          participants={shareableParticipants}
          currentUid={user?.uid ?? ""}
          saving={saving}
          error={error}
          onClose={onCloseCreate}
          onSubmit={handleCreateItem}
        />
      ) : null}

      {editingItem ? (
        <CreateItemModal
          participants={shareableParticipants}
          currentUid={user?.uid ?? ""}
          saving={saving}
          error={error}
          onClose={() => setEditingItemId(null)}
          onSubmit={handleUpdateItem}
          title="Editar Item"
          submitLabel="Salvar"
          initialName={editingItem.name}
          initialPrice={
            editingItem.quantity > 0
              ? editingItem.price / editingItem.quantity
              : editingItem.price
          }
          initialQuantity={editingItem.quantity}
          initialIcon={editingItem.icon}
          initialSharedUids={editingItem.consumerUids.filter(
            (uid) => uid !== user?.uid,
          )}
        />
      ) : null}
    </div>
  );
}
