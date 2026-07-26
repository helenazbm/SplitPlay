"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import {
  acceptItemInvite,
  addItemParticipant,
  createTableItem,
  declineItemInvite,
  leaveItem,
  removeItemParticipant,
  subscribeToTableItems,
  subscribeToTableParticipants,
  updateItemDetails,
} from "@/lib/services/itemService";
import type { ItemLastChange, TableItemWithId } from "@/lib/types/item";
import ComandaResumo from "@/components/mesa/ComandaResumo";
import CreateItemModal from "@/components/mesa/CreateItemModal";
import {
  centsToReais,
  userItemShareCents,
  userSubtotalCents,
} from "@/lib/billing";
import { foodIconSrc } from "@/lib/foodIcons";
import Avatar from "@/components/Avatar";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

type MesaPedidosTabProps = {
  isCreateOpen: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  /** Couvert artístico (por pessoa) definido pelo admin. Entra como item fixo. */
  couvert?: number;
};

type ParticipantOption = {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
};

type Toast = {
  id: string;
  text: string;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Chave estável para um `lastChange`, usada tanto pra dedupe de toast quanto pra "dispensar" um banner. */
function changeKey(itemId: string, lastChange: ItemLastChange | null): string {
  const at = lastChange?.at;
  const millis =
    at && typeof at === "object" && "toMillis" in at && typeof (at as { toMillis: () => number }).toMillis === "function"
      ? (at as { toMillis: () => number }).toMillis()
      : String(at ?? "");
  return `${itemId}:${millis}`;
}

export default function MesaPedidosTab({
  isCreateOpen,
  onOpenCreate,
  onCloseCreate,
  couvert = 0,
}: MesaPedidosTabProps) {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const { user } = useAuth();

  const [items, setItems] = useState<TableItemWithId[]>([]);
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(new Set());
  const [toasts, setToasts] = useState<Toast[]>([]);

  const previousItemsRef = useRef<TableItemWithId[]>([]);
  const toastSeenRef = useRef<Set<string>>(new Set());
  // Espelham o estado mais recente para uso dentro do callback do listener
  // de itens (que só é recriado quando `tableId` muda — ver efeito abaixo).
  const userRef = useRef(user);
  const participantByUidRef = useRef<Map<string, ParticipantOption>>(new Map());

  useEffect(() => {
    userRef.current = user;
  }, [user]);

  useEffect(() => {
    // loading inicia em true; as subscriptions ajustam loading/error nos
    // callbacks (evita setState síncrono no corpo do effect — cascading renders).
    const stopItems = subscribeToTableItems(
      tableId,
      (nextItems) => {
        // Aviso "fulano te removeu do item X": comparando com a rodada
        // anterior, detecta quando o usuário deixou de estar em
        // consumerUids/pendingInvites de um item por ação de outra pessoa
        // (não por clique próprio) — gera um toast efêmero, já que não há
        // central de notificações.
        const currentUser = userRef.current;
        if (currentUser) {
          const previous = previousItemsRef.current;
          const currentById = new Map(nextItems.map((item) => [item.id, item]));
          const newToasts: Toast[] = [];

          for (const prevItem of previous) {
            const wasIn =
              prevItem.consumerUids.includes(currentUser.uid) ||
              prevItem.pendingInvites.includes(currentUser.uid);
            if (!wasIn) {
              continue;
            }

            const current = currentById.get(prevItem.id);
            const isInNow = current
              ? current.consumerUids.includes(currentUser.uid) ||
                current.pendingInvites.includes(currentUser.uid)
              : false;

            if (isInNow) {
              continue;
            }

            const lastChange = current?.lastChange ?? prevItem.lastChange;
            if (!lastChange || lastChange.byUid === currentUser.uid) {
              // Ação do próprio usuário (saiu/recusou) — não precisa de toast.
              continue;
            }

            const key = changeKey(prevItem.id, lastChange);
            if (toastSeenRef.current.has(key)) {
              continue;
            }
            toastSeenRef.current.add(key);

            const byName =
              participantByUidRef.current.get(lastChange.byUid)?.displayName ?? "Alguém";
            const toastId = `${key}-${Date.now()}`;
            newToasts.push({
              id: toastId,
              text: `${byName} removeu você do item "${prevItem.name}".`,
            });

            setTimeout(() => {
              setToasts((current) => current.filter((toast) => toast.id !== toastId));
            }, 8000);
          }

          if (newToasts.length > 0) {
            setToasts((current) => [...current, ...newToasts]);
          }
        }

        previousItemsRef.current = nextItems;
        setItems(nextItems);
        setLoading(false);
        setError(null);
      },
      (nextError) => {
        setError(nextError.message);
        setLoading(false);
      },
    );

    const stopParticipants = subscribeToTableParticipants(
      tableId,
      setParticipants,
      (nextError) => setError(nextError.message),
    );

    return () => {
      stopItems();
      stopParticipants();
    };
  }, [tableId]);

  const participantOptions = useMemo(
    () =>
      participants.length > 0
        ? participants
        : user
          ? [
              {
                uid: user.uid,
                displayName: user.displayName ?? "Você",
                avatarUrl: user.photoURL ?? null,
              },
            ]
          : [],
    [participants, user],
  );

  const participantByUid = useMemo(() => {
    const map = new Map<string, ParticipantOption>();
    for (const participant of participantOptions) {
      map.set(participant.uid, participant);
    }
    return map;
  }, [participantOptions]);

  useEffect(() => {
    participantByUidRef.current = participantByUid;
  }, [participantByUid]);

  // Itens que o usuário já aceitou de fato (alimentam o rateio e o total).
  const acceptedItems = useMemo(
    () => items.filter((item) => user && item.consumerUids.includes(user.uid)),
    [items, user],
  );

  // Itens onde o usuário foi convidado e ainda não respondeu.
  const invitedItems = useMemo(
    () => items.filter((item) => user && item.pendingInvites.includes(user.uid)),
    [items, user],
  );

  // Couvert artístico é cobrado por pessoa: entra na conta de todos.
  const hasCouvert = couvert > 0;

  // Item em edição (abre o modal pré-preenchido).
  const editingItem = items.find((it) => it.id === editingItemId) ?? null;

  // Total (sua parte) calculado em centavos + maior resto: itens já aceitos
  // + couvert artístico. Evita erro de arredondamento do ponto flutuante.
  const total = useMemo(
    () =>
      user ? centsToReais(userSubtotalCents(user.uid, acceptedItems, couvert)) : 0,
    [acceptedItems, couvert, user],
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

  function beginEdit(item: TableItemWithId) {
    setEditingItemId(item.id);
  }

  async function handleUpdateItem(data: {
    name: string;
    price: number;
    quantity: number;
    icon: string | null;
  }) {
    if (!editingItemId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateItemDetails(tableId, editingItemId, {
        name: data.name,
        price: data.price,
        quantity: data.quantity,
        icon: data.icon,
      });
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

  async function handleInviteParticipant(itemId: string, targetUid: string) {
    setSaving(true);
    setError(null);

    try {
      await addItemParticipant(tableId, itemId, targetUid);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível convidar o participante.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleRemoveParticipant(itemId: string, targetUid: string) {
    setSaving(true);
    setError(null);

    try {
      await removeItemParticipant(tableId, itemId, targetUid);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível remover o participante.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleLeave(itemId: string) {
    setSaving(true);
    setError(null);

    try {
      await leaveItem(tableId, itemId);
      if (editingItemId === itemId) {
        setEditingItemId(null);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível sair do item.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function handleInviteResponse(itemId: string, accept: boolean) {
    setSaving(true);
    setError(null);

    try {
      if (accept) {
        await acceptItemInvite(tableId, itemId);
      } else {
        await declineItemInvite(tableId, itemId);
      }
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível responder ao convite.",
      );
    } finally {
      setSaving(false);
    }
  }

  function dismissBanner(itemId: string, lastChange: ItemLastChange | null) {
    setDismissedKeys((current) => {
      const next = new Set(current);
      next.add(changeKey(itemId, lastChange));
      return next;
    });
  }

  function lastChangeBanner(item: TableItemWithId): string | null {
    const lc = item.lastChange;
    if (!user || !lc || lc.byUid === user.uid) {
      return null;
    }
    if (dismissedKeys.has(changeKey(item.id, lc))) {
      return null;
    }

    const byName = participantByUid.get(lc.byUid)?.displayName ?? "Alguém";
    const perPerson = brl.format(
      centsToReais(userItemShareCents(user.uid, item)),
    );

    switch (lc.type) {
      case "update":
        return `${byName} alterou o item. Novo valor: ${perPerson} por pessoa.`;
      case "remove": {
        const targetName =
          participantByUid.get(lc.targetUid ?? "")?.displayName ?? "um participante";
        return `${byName} removeu ${targetName} do item. Valor atualizado: ${perPerson} por pessoa.`;
      }
      case "leave":
        return `${byName} saiu do item. Valor atualizado: ${perPerson} por pessoa.`;
      default:
        return null;
    }
  }

  return (
    <div
      className="flex flex-1 flex-col"
      role="tabpanel"
      aria-label="Pedidos"
      style={{ gap: "var(--spacing-fluid-4)" }}
    >
      {toasts.length > 0 ? (
        <div
          className="flex flex-col"
          style={{ gap: "var(--spacing-fluid-2)" }}
          aria-live="polite"
        >
          {toasts.map((toast) => (
            <p
              key={toast.id}
              className="font-poppins rounded-[10px_10px_25px_10px] border border-[#fdebd0] bg-[#fff7e7] px-4 py-3 text-[#8a6d3b]"
              style={{ fontSize: "var(--text-fluid-xs)" }}
            >
              {toast.text}
            </p>
          ))}
        </div>
      ) : null}

      <ComandaResumo itemCount={acceptedItems.length} totalReais={total} />

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
          onClick={onOpenCreate}
          aria-label="Adicionar item"
          className="font-poppins flex shrink-0 items-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] active:scale-95"
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

      {error ? (
        <p
          className="font-poppins rounded-[10px_10px_25px_10px] border border-[#fdebd0] bg-[#fff7e7] px-4 py-3 text-[#8a6d3b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          {error}
        </p>
      ) : null}

      {loading ? (
        <p
          className="font-poppins text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          Carregando itens...
        </p>
      ) : null}

      {invitedItems.length > 0 ? (
        <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-2)" }}>
          <h3
            className="font-poppins font-black text-[#e5786c]"
            style={{ fontSize: "var(--text-fluid-sm)" }}
          >
            Convites pendentes
          </h3>

          {invitedItems.map((item) => (
            <article
              key={item.id}
              className="w-full border"
              style={{
                borderColor: "#5F9C7D",
                borderWidth: "0.1px",
                borderRadius: "8px",
                backgroundColor: "#FBFAF7",
                padding: "var(--spacing-fluid-3)",
              }}
            >
              <div
                className="flex items-center justify-between"
                style={{ gap: "var(--spacing-fluid-2)" }}
              >
                <div className="min-w-0">
                  <h4
                    className="font-poppins truncate font-semibold text-[#418964]"
                    style={{ fontSize: "var(--text-fluid-sm)" }}
                  >
                    {item.name}
                  </h4>
                  <p
                    className="font-poppins text-[#9bb0a4]"
                    style={{ fontSize: "var(--text-fluid-xs)" }}
                  >
                    Convidado por{" "}
                    {participantByUid.get(item.ownerUid)?.displayName ?? "alguém"} ·{" "}
                    {brl.format(
                      centsToReais(
                        userItemShareCents(user?.uid ?? "", {
                          price: item.price,
                          consumerUids: [...item.consumerUids, user?.uid ?? ""],
                        }),
                      ),
                    )}{" "}
                    por pessoa (estimativa)
                  </p>
                </div>

                <div className="flex shrink-0 items-center" style={{ gap: "var(--spacing-fluid-2)" }}>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleInviteResponse(item.id, false)}
                    className="font-poppins flex items-center justify-center rounded-full bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3] disabled:opacity-50"
                    style={{
                      height: "1.75rem",
                      paddingInline: "var(--spacing-fluid-3)",
                      fontSize: "var(--text-fluid-xs)",
                    }}
                  >
                    Recusar
                  </button>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleInviteResponse(item.id, true)}
                    className="font-poppins flex items-center justify-center rounded-full bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] disabled:opacity-50"
                    style={{
                      height: "1.75rem",
                      paddingInline: "var(--spacing-fluid-3)",
                      fontSize: "var(--text-fluid-xs)",
                    }}
                  >
                    Aceitar
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : null}

      <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-2)" }}>
        {acceptedItems.map((item) => {
          const isShared = item.consumerUids.length > 1 || item.pendingInvites.length > 0;
          const canDeleteOutright =
            item.consumerUids.length === 1 && item.pendingInvites.length === 0;
          const banner = lastChangeBanner(item);

          return (
            <article
              key={item.id}
              className="w-full border"
              style={{
                minHeight: "120px",
                borderColor: "#5F9C7D",
                borderWidth: "0.1px",
                borderRadius: "8px",
                backgroundColor: "#FBFAF7",
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
                  <h3
                    className="font-poppins truncate font-semibold text-[#418964]"
                    style={{ fontSize: "var(--text-fluid-sm)" }}
                  >
                    {item.name}
                  </h3>
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
                      {item.consumerUids.length}{" "}
                      {item.consumerUids.length === 1 ? "participante" : "participantes"}
                      {item.pendingInvites.length > 0
                        ? ` · ${item.pendingInvites.length} convite(s) pendente(s)`
                        : ""}
                    </span>
                  </div>
                ) : (
                  <span
                    className="font-poppins text-[#9bb0a4]"
                    style={{ fontSize: "var(--text-fluid-xs)" }}
                  >

                  </span>
                )}

                <div
                  className="flex shrink-0 items-stretch overflow-hidden rounded-full border border-[#5F9C7D]"
                  style={{ width: "60px", height: "20px" }}
                >
                  <button
                    type="button"
                    aria-label={canDeleteOutright ? "Excluir item" : "Sair do item"}
                    title={canDeleteOutright ? "Excluir item" : "Sair do item"}
                    disabled={saving}
                    onClick={() => void handleLeave(item.id)}
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
              </div>

              {banner ? (
                <div
                  className="flex items-center justify-between"
                  style={{
                    marginTop: "var(--spacing-fluid-2)",
                    gap: "var(--spacing-fluid-2)",
                  }}
                >
                  <p
                    className="font-poppins text-[#8a6d3b]"
                    style={{ fontSize: "var(--text-fluid-xs)" }}
                  >
                    {banner}
                  </p>
                  <button
                    type="button"
                    aria-label="Dispensar aviso"
                    onClick={() => dismissBanner(item.id, item.lastChange)}
                    className="font-poppins shrink-0 text-[#8a6d3b] transition hover:opacity-70"
                    style={{ fontSize: "var(--text-fluid-xs)" }}
                  >
                    <i aria-hidden="true" className="pi pi-times" />
                  </button>
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

        {!loading && acceptedItems.length === 0 && invitedItems.length === 0 && !hasCouvert ? (
          <div className="rounded-[10px_10px_25px_10px] border border-dashed border-[#418964]/25 bg-white p-6 text-center">
            <p
              className="font-poppins text-[#64835b]"
              style={{ fontSize: "var(--text-fluid-sm)" }}
            >
              Você ainda não tem itens. Toque em “Adicionar item”.
            </p>
          </div>
        ) : null}
      </div>

      {isCreateOpen ? (
        <CreateItemModal
          participants={participantOptions}
          currentUid={user?.uid ?? ""}
          saving={saving}
          error={error}
          onClose={onCloseCreate}
          onSubmit={handleCreateItem}
        />
      ) : null}

      {editingItem ? (
        <CreateItemModal
          mode="edit"
          participants={participantOptions}
          currentUid={user?.uid ?? ""}
          saving={saving}
          error={error}
          onClose={() => setEditingItemId(null)}
          onSubmit={handleUpdateItem}
          onInviteParticipant={(uid) => void handleInviteParticipant(editingItem.id, uid)}
          onRemoveParticipant={(uid) => void handleRemoveParticipant(editingItem.id, uid)}
          title="Editar Item"
          submitLabel="Salvar"
          noticeText="Convidar ou remover participantes vale na hora. Nome e valor só mudam ao Salvar."
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
          initialPendingUids={editingItem.pendingInvites}
        />
      ) : null}
    </div>
  );
}
