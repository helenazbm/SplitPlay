"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import {
  acceptItemInvite,
  addItemParticipant,
  createTableItem,
  declineItemInvite,
  leaveItem,
  removeItemParticipant,
  SETTLED_MESSAGE,
  updateItemDetails,
} from "@/lib/services/itemService";
import { reopenParticipation } from "@/lib/services/tableService";
import type { ItemLastChange, TableItemWithId } from "@/lib/types/item";
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
import { useEffect, useMemo, useRef, useState } from "react";

/**
 * Itens e participantes chegam por prop: quem assina o Firestore é a página do
 * painel, uma vez só. Cada aba assinava os próprios listeners, e trocar de aba
 * remontava as consultas.
 */
type MesaPedidosTabProps = {
  isCreateOpen: boolean;
  onOpenCreate: () => void;
  onCloseCreate: () => void;
  onPayNow: () => void;
  tableName?: string | null;
  /** Couvert artístico (por pessoa) definido pelo admin. Entra como item fixo. */
  couvert?: number;
  items: TableItemWithId[];
  participants: Participant[];
  /** Falha ao carregar os itens, vinda do listener da página. */
  loadError?: string | null;
};

type ParticipantOption = {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
  paid?: boolean;
  left?: boolean;
};

type Toast = {
  id: string;
  text: string;
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

/** Identidade estável de uma mensagem: o instante do `lastChange` que a gerou. */
function changeMillis(lastChange: ItemLastChange | null): string {
  const at = lastChange?.at;
  return at &&
    typeof at === "object" &&
    "toMillis" in at &&
    typeof (at as { toMillis: () => number }).toMillis === "function"
    ? String((at as { toMillis: () => number }).toMillis())
    : String(at ?? "");
}

/** Chave estável para um `lastChange`, usada no dedupe de toast. */
function changeKey(itemId: string, lastChange: ItemLastChange | null): string {
  return `${itemId}:${changeMillis(lastChange)}`;
}

/** Avisos dispensados ficam por aba do navegador: a mesa é uma sessão curta. */
function dismissStorageKey(tableId: string, uid: string): string {
  return `splitplay:avisos-dispensados:${tableId}:${uid}`;
}

export default function MesaPedidosTab({
  isCreateOpen,
  onOpenCreate,
  onCloseCreate,
  onPayNow,
  tableName = null,
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
  const [dismissedByItem, setDismissedByItem] = useState<Record<string, string>>(
    {},
  );
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [reopening, setReopening] = useState(false);
  const [dismissedLoadError, setDismissedLoadError] = useState<string | null>(
    null,
  );

  const previousItemsRef = useRef<TableItemWithId[]>([]);
  const toastSeenRef = useRef<Set<string>>(new Set());
  // Espelham o estado mais recente para uso dentro do callback do listener
  // de itens (que só é recriado quando `tableId` muda — ver efeito abaixo).
  const userRef = useRef(user);
  const participantByUidRef = useRef<Map<string, ParticipantOption>>(new Map());

  useEffect(() => {
    userRef.current = user;
  }, [user]);
  const storageKey = user ? dismissStorageKey(tableId, user.uid) : null;
  useEffect(() => {
    if (!storageKey) {
      return;
    }
    let stored: Record<string, string> = {};
    try {
      const raw = sessionStorage.getItem(storageKey);
      if (raw) {
        stored = JSON.parse(raw) as Record<string, string>;
      }
    } catch {
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDismissedByItem(stored);
  }, [storageKey]);

  // Aviso "fulano te removeu do item X": comparando com a rodada anterior,
  // detecta quando o usuário deixou de estar em consumerUids/pendingInvites de
  // um item por ação de outra pessoa (não por clique próprio) — gera um toast
  // efêmero, já que não há central de notificações.
  //
  // Roda a cada nova lista de itens vinda do painel; antes vivia dentro do
  // callback do onSnapshot deste componente. O setState aqui é reação a dado
  // externo (Firestore), que é exatamente o caso de uso legítimo de efeito.
  useEffect(() => {
    const currentUser = userRef.current;
    if (!currentUser) {
      previousItemsRef.current = items;
      return;
    }

    const previous = previousItemsRef.current;
    const currentById = new Map(items.map((item) => [item.id, item]));
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
      // Reação a dado externo (Firestore) chegando por prop — caso legítimo de
      // efeito, não um estado derivável durante o render.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setToasts((current) => [...current, ...newToasts]);
    }

    previousItemsRef.current = items;
  }, [items]);

  const participantOptions = useMemo<ParticipantOption[]>(() => {
    if (participants.length > 0) {
      return participants.map((participant) => ({
        uid: participant.uid,
        displayName: participant.displayName,
        avatarUrl: participant.avatarUrl ?? null,
        paid: participant.paid,
        left: participant.left,
      }));
    }

    return user
      ? [
          {
            uid: user.uid,
            displayName: user.displayName ?? "Você",
            avatarUrl: user.photoURL ?? null,
          },
        ]
      : [];
  }, [participants, user]);

  // Quem pode ser convidado para dividir um item. Quem já fechou a conta fica
  // de fora: as rules recusariam o convite (`freeOfPaid`), então oferecer a
  // opção só produziria erro. Nomes continuam vindo de `participantOptions`,
  // para que itens antigos sigam exibindo quem participou.
  const shareableParticipants = useMemo(
    () =>
      participantOptions.filter(
        (participant) => !participant.paid && !participant.left,
      ),
    [participantOptions],
  );

  const participantByUid = useMemo(() => {
    const map = new Map<string, ParticipantOption>();
    for (const participant of participantOptions) {
      map.set(participant.uid, participant);
    }
    return map;
  }, [participantOptions]);

  const currentParticipantPaid =
    participantByUid.get(user?.uid ?? "")?.paid === true;

  useEffect(() => {
    participantByUidRef.current = participantByUid;
  }, [participantByUid]);

  const bannerMessage =
    error ?? (loadError && loadError !== dismissedLoadError ? loadError : null);

  function dismissErrorBanner() {
    setError(null);
    setDismissedLoadError(loadError ?? null);
  }

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

  // Rodada atual do usuário. Quem paga e volta à mesa recomeça do zero: o consumo
  // quitado (itens criados até `settledThroughAt`, mais o couvert) é
  // cobrado outra vez. 
  const myParticipant = useMemo(
    () => participants.find((participant) => participant.uid === user?.uid) ?? null,
    [participants, user],
  );

  const settledThroughMs = myParticipant?.settledThroughAt?.getTime() ?? null;

  const round = useMemo(
    () => ({
      settledThroughMs,
      couvertSettled: myParticipant?.couvertSettled === true,
    }),
    [settledThroughMs, myParticipant],
  );

  /** Item de uma rodada já quitada: sai do total e troca as ações por "Pago". */
  function isSettledForMe(item: TableItemWithId): boolean {
    return !isItemInCurrentRound(item, settledThroughMs);
  }

  const currentRoundItemCount = useMemo(
    () =>
      acceptedItems.filter((item) =>
        isItemInCurrentRound(item, settledThroughMs),
      ).length,
    [acceptedItems, settledThroughMs],
  );

  // Couvert artístico é cobrado por pessoa: entra na conta de todos. Continua
  // listado depois de quitado (com selo "Pago"), mas `couvertSettled` já o tirou
  // do total — ninguém paga couvert duas vezes na mesma mesa.
  const hasCouvert = couvert > 0;

  // Item em edição (abre o modal pré-preenchido).
  const editingItem = items.find((it) => it.id === editingItemId) ?? null;

  // Total (sua parte) calculado em centavos + maior resto: itens já aceitos
  // + couvert artístico. Evita erro de arredondamento do ponto flutuante.
  const total = useMemo(
    () =>
      user
        ? centsToReais(userSubtotalCents(user.uid, acceptedItems, couvert, round))
        : 0,
    [acceptedItems, couvert, round, user],
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

  function isItemLocked(item: TableItemWithId): boolean {
    if (item.settled) {
      return true;
    }

    return item.consumerUids.some(
      (uid) => participantByUid.get(uid)?.paid === true,
    );
  }

  function beginEdit(item: TableItemWithId) {
    if (isItemLocked(item)) {
      setError(SETTLED_MESSAGE);
      return;
    }

    setError(null);
    setEditingItemId(item.id);
  }


  async function handleOpenCreate() {
    setError(null);

    if (currentParticipantPaid) {
      setReopening(true);
      try {
        await reopenParticipation(tableId);
      } catch (nextError) {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Não foi possível reabrir sua participação.",
        );
        return;
      } finally {
        setReopening(false);
      }
    }

    onOpenCreate();
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
    const item = items.find((entry) => entry.id === itemId);
    if (item && isItemLocked(item)) {
      setError(SETTLED_MESSAGE);
      return;
    }

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
    const next: Record<string, string> = { [itemId]: changeMillis(lastChange) };
    for (const item of items) {
      const previous = dismissedByItem[item.id];
      if (item.id !== itemId && previous) {
        next[item.id] = previous;
      }
    }

    setDismissedByItem(next);
    if (storageKey) {
      try {
        sessionStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // Storage cheio ou bloqueado: o dispensar vale só enquanto a aba viver.
      }
    }
  }

  function lastChangeBanner(item: TableItemWithId): string | null {
    const lc = item.lastChange;
    if (!user || !lc || lc.byUid === user.uid) {
      return null;
    }
    if (dismissedByItem[item.id] === changeMillis(lc)) {
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
      <ComandaResumo
        tableName={tableName}
        itemCount={currentRoundItemCount}
        totalReais={total}
        paidReais={centsToReais(myParticipant?.paidTotalCents ?? 0)}
      />

      <button
        type="button"
        onClick={onPayNow}
        className="font-poppins flex w-full items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#418964] transition hover:bg-[#bddfce] active:scale-95"
        style={{
          minHeight: "2.5rem",
          paddingInline: "var(--spacing-fluid-4)",
          fontSize: "var(--text-fluid-sm)",
          gap: "0.45rem",
        }}
      >
        <i aria-hidden="true" className="pi pi-credit-card" />
        Ver minha comanda
      </button>

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
          data-cy="additem"
          type="button"
          onClick={() => void handleOpenCreate()}
          disabled={reopening}
          aria-label="Adicionar item"
          className="font-poppins flex shrink-0 items-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] active:scale-95 disabled:opacity-50"
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

      {bannerMessage ? (
        <div
          role="status"
          className="font-poppins flex items-start rounded-[10px_10px_25px_10px] border border-[#fdebd0] bg-[#fff7e7] px-4 py-3 text-[#8a6d3b]"
          style={{
            fontSize: "var(--text-fluid-xs)",
            gap: "var(--spacing-fluid-2)",
          }}
        >
          <p className="min-w-0 flex-1">{bannerMessage}</p>

          <button
            type="button"
            onClick={dismissErrorBanner}
            aria-label="Fechar aviso"
            className="shrink-0 rounded-full text-[#8a6d3b]/60 transition hover:text-[#8a6d3b]"
            style={{ lineHeight: 1, padding: "0.1rem" }}
          >
            <i
              aria-hidden="true"
              className="pi pi-times"
              style={{ fontSize: "0.7rem" }}
            />
          </button>
        </div>
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
                    className="font-poppins flex items-baseline font-semibold text-[#418964]"
                    style={{
                      fontSize: "var(--text-fluid-sm)",
                      gap: "0.35rem",
                    }}
                  >
                    <span className="truncate">{item.name}</span>
                    {/* Preço fora do truncate: o valor do item nunca some,
                        por mais longo que seja o nome. */}
                    <span className="shrink-0">- {brl.format(item.price)}</span>
                  </h4>
                  <p
                    className="font-poppins text-[#9bb0a4]"
                    style={{ fontSize: "var(--text-fluid-xs)" }}
                  >
                    {participantByUid.get(item.ownerUid)?.displayName ?? "alguém"}{" "}
                    quer compartilhar um item
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
          const settledForMe = isSettledForMe(item);

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

                {settledForMe ? (
                  // Consumo de uma rodada já quitada: não há o que editar nem de
                  // onde sair (as rules e `isItemLocked` recusariam), então a
                  // pílula de ações vira o selo "Pago".
                  <span
                    className="font-poppins flex shrink-0 items-center justify-center rounded-full border border-[#5F9C7D] bg-[#eaf6ef] font-semibold text-[#5F9C7D]"
                    style={{
                      width: "60px",
                      height: "20px",
                      fontSize: "0.65rem",
                    }}
                  >
                    Pago
                  </span>
                ) : (
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
                )}
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

              <div
                className="flex shrink-0 flex-col items-end"
                style={{ gap: "var(--spacing-fluid-1)" }}
              >
                <strong
                  className="font-poppins text-[#e5786c]"
                  style={{ fontSize: "var(--text-fluid-sm)" }}
                >
                  {brl.format(couvert)}
                </strong>

                {round.couvertSettled ? (
                  <span
                    className="font-poppins flex items-center justify-center rounded-full border border-[#5F9C7D] bg-[#eaf6ef] font-semibold text-[#5F9C7D]"
                    style={{
                      width: "60px",
                      height: "20px",
                      fontSize: "0.65rem",
                    }}
                  >
                    Pago
                  </span>
                ) : null}
              </div>
            </div>
          </article>
        ) : null}

        {acceptedItems.length === 0 && invitedItems.length === 0 && !hasCouvert ? (
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

      {isCreateOpen ? (
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
          mode="edit"
          participants={shareableParticipants}
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
