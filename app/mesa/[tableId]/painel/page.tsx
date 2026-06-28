"use client";

import MesaBottomNav, { type MesaTabId } from "@/components/mesa/MesaBottomNav";
import MesaHeader from "@/components/mesa/MesaHeader";
import MesaAdminTab from "@/components/mesa/tabs/MesaAdminTab";
import MesaPagamentoTab from "@/components/mesa/tabs/MesaPagamentoTab";
import MesaParticipantesTab from "@/components/mesa/tabs/MesaParticipantesTab";
import MesaPedidosTab from "@/components/mesa/tabs/MesaPedidosTab";
import { useAuth } from "@/lib/contexts/AuthContext";
import { userSubtotalCents, userTotalCents } from "@/lib/billing";
import { subscribeToTableItems } from "@/lib/services/itemService";
import {
  closeTable,
  leaveTable,
  releaseCurrentTable,
  subscribeToParticipants,
  subscribeToTable,
  transferAdmin,
  updateMySubtotal,
  updateTableSettings,
} from "@/lib/services/tableService";
import type { Participant } from "@/lib/types/participant";
import type { TableItemWithId } from "@/lib/types/item";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";

export default function MesaPainelPage() {
  const router = useRouter();
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const { user, loading: authLoading } = useAuth();

  const [tableName, setTableName] = useState<string | null>(null);
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const [couvert, setCouvert] = useState(0);
  const [tipPercent, setTipPercent] = useState(10);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [items, setItems] = useState<TableItemWithId[]>([]);
  const [itemsLoaded, setItemsLoaded] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [activeTab, setActiveTab] = useState<MesaTabId>("itens");
  const [showCreateItem, setShowCreateItem] = useState(false);

  const isAdmin = Boolean(user && adminUid && user.uid === adminUid);

  // Último subtotal persistido, para não regravar o mesmo valor a cada render.
  const lastSubtotalRef = useRef<string | null>(null);

  const participantesView = useMemo(
    () =>
      participants.map((participante) => ({
        uid: participante.uid,
        displayName: participante.displayName,
        isAdmin: participante.uid === adminUid,
        paid: participante.paid,
        subtotalCents: participante.subtotalCents,
      })),
    [participants, adminUid],
  );

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace(`/login?redirect=/mesa/${tableId}/painel`);
      return;
    }

    let cancelled = false;

    const unsubscribeTable = subscribeToTable(
      tableId,
      (table) => {
        if (cancelled) {
          return;
        }

        if (!table) {
          setError("Mesa não encontrada.");
          setLoading(false);
          return;
        }

        setTableName(table.name);
        setAdminUid(table.adminUid);
        setCouvert(table.couvertSuggested ?? 0);
        setTipPercent(table.tipPercent ?? 10);
        setLoading(false);

        if (table.status === "encerrada") {
          setClosed(true);
        }
      },
      () => {
        if (!cancelled) {
          setError("Não foi possível carregar a mesa.");
          setLoading(false);
        }
      },
    );

    const unsubscribeParticipants = subscribeToParticipants(
      tableId,
      (list) => {
        if (!cancelled) {
          setParticipants(list);
        }
      },
      () => {
        if (!cancelled) {
          setError("Não foi possível carregar os participantes.");
        }
      },
    );

    // Itens da mesa: usados para calcular e persistir o subtotal do participante.
    const unsubscribeItems = subscribeToTableItems(
      tableId,
      (list) => {
        if (!cancelled) {
          setItems(list);
          setItemsLoaded(true);
        }
      },
      () => {},
    );

    return () => {
      cancelled = true;
      unsubscribeTable();
      unsubscribeParticipants();
      unsubscribeItems();
    };
  }, [authLoading, user, router, tableId]);

  // Mesa encerrada: libera o usuário (zera o currentTableId) e leva para a home.
  useEffect(() => {
    if (closed) {
      void releaseCurrentTable()
        .catch(() => {})
        .finally(() => router.replace("/"));
    }
  }, [closed, router]);

  // Persiste o subtotal (centavos) do usuário no doc dele sempre que itens ou
  // couvert mudam. Cada cliente grava o seu (cálculo interino; ver lib/billing).
  useEffect(() => {
    if (!user || !itemsLoaded || closed) {
      return;
    }
    if (!participants.some((participante) => participante.uid === user.uid)) {
      return;
    }

    const subtotal = userSubtotalCents(user.uid, items, couvert);
    // Gorjeta opt-in do próprio usuário (decisão b: total já com a gorjeta).
    const myTipEnabled =
      participants.find((p) => p.uid === user.uid)?.tipEnabled ?? false;
    const total = userTotalCents(subtotal, tipPercent, myTipEnabled);

    const key = `${subtotal}:${total}`;
    if (lastSubtotalRef.current === key) {
      return;
    }
    lastSubtotalRef.current = key;

    void updateMySubtotal(tableId, subtotal, total).catch(() => {
      lastSubtotalRef.current = null; // permite nova tentativa
    });
  }, [
    user,
    items,
    couvert,
    tipPercent,
    participants,
    itemsLoaded,
    closed,
    tableId,
  ]);

  async function handleLeave() {
    setLeaving(true);
    try {
      await leaveTable(tableId);
      router.push("/");
    } catch {
      setError("Não foi possível sair da mesa.");
      setLeaving(false);
    }
  }

  async function handleSaveSettings(settings: {
    couvertSuggested: number;
    tipPercent: number;
  }) {
    // A subscription da mesa reflete o novo couvert na aba de itens.
    await updateTableSettings(tableId, settings);
  }

  async function handleAssignAdmin(newAdminUid: string) {
    // A subscription da mesa detecta o novo adminUid e atualiza a UI (o usuário
    // atual deixa de ser admin). Deixa o erro propagar para o modal tratar.
    await transferAdmin(tableId, newAdminUid);
  }

  async function handleCloseTable() {
    setClosing(true);
    try {
      await closeTable(tableId);
      // A subscription detecta o status "encerrada" e mostra a tela de encerrada.
    } catch {
      setError("Não foi possível encerrar a mesa.");
      setClosing(false);
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-white text-[#418964]">
        <p
          className="font-poppins"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Carregando...
        </p>
      </main>
    );
  }

  if (closed) {
    return (
      <main
        className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-white"
        style={{
          padding: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-4)",
        }}
      >
        <i
          aria-hidden="true"
          className="pi pi-flag-fill text-[#418964]"
          style={{ fontSize: "var(--text-fluid-3xl)" }}
        />
        <p
          className="font-poppins text-center text-[#418964]"
          style={{ fontSize: "var(--text-fluid-base)" }}
        >
          A mesa foi encerrada pelo administrador.
        </p>
      </main>
    );
  }

  if (error || !tableName) {
    return (
      <main
        className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-white"
        style={{
          padding: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-4)",
        }}
      >
        <p
          className="font-poppins text-center text-[#418964]"
          style={{ fontSize: "var(--text-fluid-base)" }}
        >
          {error ?? "Mesa não encontrada."}
        </p>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-white">
      <MesaHeader
        userName={user?.displayName?.trim() || "Jogador"}
        code={tableId}
        right={
          <Link
            href={`/mesa/${tableId}`}
            aria-label="Ver código e QR Code"
            className="flex shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25"
            style={{
              height: "2.25rem",
              width: "2.25rem",
            }}
          >
            <i
              aria-hidden="true"
              className="pi pi-qrcode"
              style={{ fontSize: "var(--text-fluid-base)" }}
            />
          </Link>
        }
      />

      <section
        className="flex min-h-0 flex-1 flex-col bg-white"
        style={{
          paddingInline: "var(--spacing-fluid-4)",
          paddingTop: "var(--spacing-fluid-4)",
          paddingBottom: "var(--bottom-nav-space)",
          gap: "var(--spacing-fluid-3)",
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "itens" ? (
            <MesaPedidosTab
              isCreateOpen={showCreateItem}
              onOpenCreate={() => setShowCreateItem(true)}
              onCloseCreate={() => setShowCreateItem(false)}
              couvert={couvert}
            />
          ) : null}
          {activeTab === "mesa" ? (
            <MesaParticipantesTab
              participantes={participantesView}
              currentUserIsAdmin={isAdmin}
              onAssignAdmin={handleAssignAdmin}
            />
          ) : null}
          {activeTab === "historico" ? (
            <p
              className="font-poppins text-center text-[#9bb0a4]"
              style={{
                paddingTop: "var(--spacing-fluid-6)",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              Histórico em breve.
            </p>
          ) : null}
          {activeTab === "pagamento" ? <MesaPagamentoTab /> : null}
          {activeTab === "ajustes" && isAdmin ? (
            <MesaAdminTab
              tableName={tableName}
              couvert={couvert}
              tipPercent={tipPercent}
              participants={participants.map((p) => ({
                uid: p.uid,
                displayName: p.displayName,
                avatarUrl: p.avatarUrl,
                paid: p.paid,
              }))}
              onSaveSettings={handleSaveSettings}
              onCloseTable={() => void handleCloseTable()}
              closing={closing}
            />
          ) : null}
        </div>
      </section>

      <MesaBottomNav
        activeTab={activeTab}
        onChange={setActiveTab}
        isAdmin={isAdmin}
      />
    </main>
  );
}
