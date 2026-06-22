"use client";

import AppHeader from "@/components/app/AppHeader";
import BottomNav from "@/components/app/BottomNav";
import WaveTop from "@/components/WaveTop";
import { useAuth } from "@/lib/contexts/AuthContext";
import { getMyActiveTable } from "@/lib/services/tableService";
import type { Table } from "@/lib/types/table";
import Link from "next/link";
import { useEffect, useState } from "react";

type ActiveTable = { id: string; table: Table };

export default function AppHome() {
  const { user } = useAuth();

  const [active, setActive] = useState<ActiveTable | null>(null);
  const [loadingTable, setLoadingTable] = useState(true);

  const displayName = user?.displayName?.trim() || "Jogador";
  const isAdmin = Boolean(user && active && active.table.adminUid === user.uid);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    getMyActiveTable()
      .then((result) => {
        if (!cancelled) {
          setActive(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActive(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingTable(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user]);

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-[#418964]">
      <AppHeader title={displayName} />

      <section
        className="relative z-0 flex min-h-0 flex-1 flex-col rounded-t-[30px] bg-white"
        style={{
          paddingInline: "var(--spacing-fluid-5)",
          paddingTop: "var(--spacing-fluid-6)",
          paddingBottom: "var(--bottom-nav-space)",
          gap: "var(--spacing-fluid-4)",
        }}
      >
        <WaveTop />

        {loadingTable ? (
          <div
            className="sp-rise rounded-[10px_10px_25px_10px] border border-[#418964]/15 bg-[#fffbf0]"
            style={{
              padding: "var(--spacing-fluid-5)",
              animationDelay: "160ms",
            }}
          >
            <p
              className="font-poppins text-center text-[#64835b]"
              style={{ fontSize: "var(--text-fluid-sm)" }}
            >
              Carregando sua mesa...
            </p>
          </div>
        ) : active ? (
          <div
            className="sp-rise relative flex flex-col rounded-[10px_10px_25px_10px] border border-[#418964] bg-[#fffbf0]"
            style={{
              padding: "var(--spacing-fluid-5)",
              gap: "var(--spacing-fluid-3)",
              animationDelay: "160ms",
            }}
          >
            <div
              className="flex items-center justify-between"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <span
                className="font-poppins font-semibold uppercase tracking-[0.18em] text-[#64835b]"
                style={{ fontSize: "0.65rem" }}
              >
                Sua mesa ativa
              </span>
              <span
                className="font-poppins rounded-full bg-[#cde9da] px-3 py-1 font-semibold text-[#418964]"
                style={{ fontSize: "0.65rem" }}
              >
                {active.table.status === "aberta" ? "Aberta" : "Encerrada"}
              </span>
            </div>

            <h2
              className="font-bagel leading-tight text-[#418964]"
              style={{ fontSize: "var(--text-fluid-2xl)" }}
            >
              {active.table.name}
            </h2>

            <div
              className="flex flex-wrap items-center"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <span
                className="font-poppins inline-flex items-center gap-1 rounded-full border border-[#418964]/30 bg-white px-3 py-1 text-[#418964]"
                style={{ fontSize: "var(--text-fluid-xs)" }}
              >
                <i aria-hidden="true" className="pi pi-hashtag" />
                {active.id}
              </span>
              {isAdmin ? (
                <span
                  className="font-poppins inline-flex rounded-full bg-[#fdebd0] px-3 py-1 font-medium text-[#8a6d3b]"
                  style={{ fontSize: "var(--text-fluid-xs)" }}
                >
                  Você é admin
                </span>
              ) : null}
            </div>

            <Link
              href={`/mesa/${active.id}/painel`}
              className="font-poppins flex w-full items-center justify-center gap-2 rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050] active:scale-[0.98]"
              style={{
                marginTop: "var(--spacing-fluid-2)",
                height: "var(--height-control-md)",
                fontSize: "var(--text-fluid-base)",
              }}
            >
              <span>Voltar para a mesa</span>
              <i aria-hidden="true" className="pi pi-arrow-right" />
            </Link>
          </div>
        ) : (
          <div
            className="sp-rise flex flex-col"
            style={{ gap: "var(--spacing-fluid-3)", animationDelay: "160ms" }}
          >
            <div>
              <h2
                className="font-bagel leading-tight text-[#418964]"
                style={{ fontSize: "var(--text-fluid-xl)" }}
              >
                Pronto pra dividir a conta?
              </h2>
              <p
                className="font-poppins text-[#64835b]"
                style={{
                  marginTop: "var(--spacing-fluid-1)",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                Entre em uma mesa pelo código ou crie a sua.
              </p>
            </div>

            <Link
              href="/mesa/entrar"
              className="font-poppins flex w-full items-center justify-between rounded-[10px_10px_25px_10px] border border-[#418964] bg-[#cde9da] font-semibold text-[#418964] transition hover:bg-[#bddfce] active:scale-[0.98]"
              style={{
                height: "var(--height-control-lg)",
                paddingInline: "var(--spacing-fluid-5)",
                fontSize: "var(--text-fluid-lg)",
              }}
            >
              <span>Entrar em uma mesa</span>
              <i aria-hidden="true" className="pi pi-sign-in" />
            </Link>

            <Link
              href="/mesa/criar"
              className="font-poppins flex w-full items-center justify-between rounded-[10px_10px_25px_10px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050] active:scale-[0.98]"
              style={{
                height: "var(--height-control-lg)",
                paddingInline: "var(--spacing-fluid-5)",
                fontSize: "var(--text-fluid-lg)",
              }}
            >
              <span>Criar uma mesa</span>
              <i aria-hidden="true" className="pi pi-plus" />
            </Link>
          </div>
        )}

      </section>

      <BottomNav />
    </main>
  );
}
