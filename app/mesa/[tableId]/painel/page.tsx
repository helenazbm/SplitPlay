"use client";

import MesaTabBar, { type MesaTabId } from "@/components/mesa/MesaTabBar";
import MesaAdminTab from "@/components/mesa/tabs/MesaAdminTab";
import MesaParticipantesTab from "@/components/mesa/tabs/MesaParticipantesTab";
import MesaPedidosTab from "@/components/mesa/tabs/MesaPedidosTab";
import { useAuth } from "@/lib/contexts/AuthContext";
import { getTable } from "@/lib/services/tableService";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function MesaPainelPage() {
  const router = useRouter();
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const { user, loading: authLoading } = useAuth();

  const [tableName, setTableName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<MesaTabId>("pedidos");
  const [showCreateItem, setShowCreateItem] = useState(false);

  const isAdmin = true;

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace(`/login?redirect=/mesa/${tableId}/painel`);
      return;
    }

    let cancelled = false;

    async function loadTable() {
      try {
        const table = await getTable(tableId);
        if (cancelled) {
          return;
        }

        if (!table) {
          setError("Mesa não encontrada.");
          return;
        }

        if (table.status === "encerrada") {
          setError("Essa mesa foi encerrada.");
          return;
        }

        setTableName(table.name);
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar a mesa.");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }

    void loadTable();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router, tableId]);

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
        <Link
          href="/"
          className="font-poppins rounded-[30px] bg-[#418964] px-6 py-3 font-semibold text-white"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Voltar para home
        </Link>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh flex-1 flex-col bg-[#fffbf0]">
      <header
        className="shrink-0 bg-[#418964]"
        style={{
          paddingInline: "var(--spacing-fluid-5)",
          paddingTop: "var(--spacing-fluid-5)",
          paddingBottom: "var(--spacing-fluid-4)",
        }}
      >
        <div
          className="flex items-start justify-between"
          style={{ gap: "var(--spacing-fluid-3)" }}
        >
          <div className="min-w-0">
            <h1
              className="font-bagel truncate leading-tight text-white"
              style={{ fontSize: "var(--text-fluid-2xl)" }}
            >
              {tableName}
            </h1>
            <p
              className="font-poppins text-white/90"
              style={{
                marginTop: "var(--spacing-fluid-1)",
                fontSize: "var(--text-fluid-xs)",
              }}
            >
              Código {tableId}
              {isAdmin ? " · Admin" : ""}
            </p>
          </div>

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
        </div>
      </header>

      <section
        className="flex min-h-0 flex-1 flex-col bg-[#fffbf0]"
        style={{
          paddingInline: "var(--spacing-fluid-4)",
          paddingTop: "var(--spacing-fluid-4)",
          paddingBottom: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-3)",
        }}
      >
        <div
          className="flex items-center"
          style={{ gap: "var(--spacing-fluid-2)" }}
        >
          <div className="min-w-0 flex-1">
            <MesaTabBar
              activeTab={activeTab}
              onChange={setActiveTab}
              showAdmin={isAdmin}
            />
          </div>

          {activeTab === "pedidos" ? (
            <button
              type="button"
              aria-label="Adicionar item"
              onClick={() => setShowCreateItem(true)}
              className="font-poppins flex shrink-0 items-center rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050]"
              style={{
                height: "2rem",
                paddingInline: "var(--spacing-fluid-3)",
                fontSize: "var(--text-fluid-xs)",
                gap: "0.25rem",
              }}
            >
              <i aria-hidden="true" className="pi pi-plus" />
              Adicionar item
            </button>
          ) : null}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto">
          {activeTab === "pedidos" ? (
            <MesaPedidosTab
              isCreateOpen={showCreateItem}
              onCloseCreate={() => setShowCreateItem(false)}
            />
          ) : null}
          {activeTab === "participantes" ? <MesaParticipantesTab /> : null}
          {activeTab === "admin" && isAdmin ? (
            <MesaAdminTab tableName={tableName} />
          ) : null}
        </div>

        <Link
          href="/"
          className="font-poppins shrink-0 text-center text-[#64835b] underline underline-offset-4"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Voltar para home
        </Link>
      </section>
    </main>
  );
}
