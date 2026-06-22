"use client";

import MesaBottomNav, { type MesaTabId } from "@/components/mesa/MesaBottomNav";
import MesaHeader from "@/components/mesa/MesaHeader";
import MesaAdminTab from "@/components/mesa/tabs/MesaAdminTab";
import MesaPagamentoTab from "@/components/mesa/tabs/MesaPagamentoTab";
import MesaParticipantesTab from "@/components/mesa/tabs/MesaParticipantesTab";
import MesaPedidosTab from "@/components/mesa/tabs/MesaPedidosTab";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  closeTable,
  leaveTable,
  releaseCurrentTable,
  subscribeToParticipants,
  subscribeToTable,
} from "@/lib/services/tableService";
import type { Participant } from "@/lib/types/participant";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

export default function MesaPainelPage() {
  const router = useRouter();
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const { user, loading: authLoading } = useAuth();

  const [tableName, setTableName] = useState<string | null>(null);
  const [adminUid, setAdminUid] = useState<string | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [leaving, setLeaving] = useState(false);
  const [closing, setClosing] = useState(false);
  const [closed, setClosed] = useState(false);
  const [activeTab, setActiveTab] = useState<MesaTabId>("itens");

  const isAdmin = Boolean(user && adminUid && user.uid === adminUid);

  const participantesView = useMemo(
    () =>
      participants.map((participante) => ({
        uid: participante.uid,
        displayName: participante.displayName,
        isAdmin: participante.uid === adminUid,
        paid: participante.paid,
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

    return () => {
      cancelled = true;
      unsubscribeTable();
      unsubscribeParticipants();
    };
  }, [authLoading, user, router, tableId]);

  // Mesa encerrada: libera o usuário (zera o currentTableId, cada um o seu).
  useEffect(() => {
    if (closed) {
      void releaseCurrentTable().catch(() => {});
    }
  }, [closed]);

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
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-[#fffbf0] text-[#418964]">
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
        className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-[#fffbf0]"
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
        className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-[#fffbf0]"
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
    <main className="flex min-h-dvh flex-1 flex-col bg-[#fffbf0]">
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
        className="flex min-h-0 flex-1 flex-col bg-[#fffbf0]"
        style={{
          paddingInline: "var(--spacing-fluid-4)",
          paddingTop: "var(--spacing-fluid-4)",
          paddingBottom: "var(--bottom-nav-space)",
          gap: "var(--spacing-fluid-3)",
        }}
      >
        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "itens" ? <MesaPedidosTab /> : null}
          {activeTab === "mesa" ? (
            <div
              className="flex flex-col"
              style={{ gap: "var(--spacing-fluid-4)" }}
            >
              <MesaParticipantesTab participantes={participantesView} />
              {isAdmin ? (
                <MesaAdminTab
                  tableName={tableName}
                  onCloseTable={() => void handleCloseTable()}
                  closing={closing}
                />
              ) : null}
            </div>
          ) : null}
          {activeTab === "pagamento" ? <MesaPagamentoTab /> : null}
        </div>
      </section>

      <MesaBottomNav activeTab={activeTab} onChange={setActiveTab} />
    </main>
  );
}
