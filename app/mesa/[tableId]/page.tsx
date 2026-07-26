"use client";

import WaveTop from "@/components/WaveTop";
import { useAuth } from "@/lib/contexts/AuthContext";
import { getTable, getTableShareUrl } from "@/lib/services/tableService";
import Image from "next/image";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import QRCode from "react-qr-code";

export default function MesaCompartilharPage() {
  const router = useRouter();
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const { user, loading: authLoading } = useAuth();

  const [tableName, setTableName] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [showQrModal, setShowQrModal] = useState(false);

  const qrValue = getTableShareUrl(tableId);

  useEffect(() => {
    if (authLoading) {
      return;
    }
    if (!user) {
      router.replace(
        `/mesa/entrar/identificacao?code=${encodeURIComponent(tableId)}`,
      );
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
          setError("Mesa não encontrada. Confira o código.");
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

  async function handleCopyCode() {
    try {
      await navigator.clipboard.writeText(tableId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Não foi possível copiar o código.");
    }
  }

  if (authLoading || loading) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-[#418964] text-white">
        <p
          className="font-poppins"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Carregando...
        </p>
      </main>
    );
  }

  if (error) {
    return (
      <main
        className="flex min-h-dvh flex-1 flex-col items-center justify-center bg-[#418964] text-white"
        style={{
          padding: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-4)",
        }}
      >
      </main>
    );
  }

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-[#fdbfc0]">
      <Image
        src="/plano_mesa.svg"
        alt=""
        width={413}
        height={413}
        priority
        className="pointer-events-none absolute left-0 top-0 h-[clamp(20rem,32dvh,20rem)] w-full object-cover object-top"
      />

      <section
        className="relative z-20 mt-[clamp(15rem,24dvh,22rem)] flex w-full flex-1 flex-col rounded-t-[30px] bg-white"
        style={{
          paddingInline: "var(--spacing-fluid-5)",
          paddingTop: "var(--spacing-fluid-6)",
          paddingBottom: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-4)",
        }}
      >
        <WaveTop />

        <h1
          className="font-bagel text-center leading-tight text-[#418964]"
          style={{ fontSize: "var(--text-fluid-2xl)" }}
        >
          {tableName}
        </h1>

        <p
          className="font-poppins text-center text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Mesa criada com sucesso! Compartilhe o código ou o QR Code com os
          participantes.
        </p>

        <div
          className="relative flex flex-col rounded-[10px_10px_25px_10px] border border-[#418964] bg-[#fffbf0]"
          style={{
            padding: "var(--spacing-fluid-4)",
            gap: "var(--spacing-fluid-2)",
          }}
        >
          <button
            type="button"
            onClick={() => void handleCopyCode()}
            aria-label={copied ? "Código copiado" : "Copiar código da mesa"}
            className="absolute right-3 top-3 flex h-9 w-9 items-center justify-center rounded-full text-[#418964] transition hover:bg-[#418964]/10 active:scale-95"
          >
            <i
              aria-hidden="true"
              className={`pi ${copied ? "pi-check" : "pi-copy"}`}
              style={{ fontSize: "var(--text-fluid-base)" }}
            />
          </button>

          <span
            className="font-poppins text-[#64835b]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            Código da mesa
          </span>
          <span
            className="font-bagel text-center tracking-[0.2em] text-[#418964]"
            style={{ fontSize: "var(--text-fluid-3xl)" }}
          >
            {tableId}
          </span>
        </div>

        <div
          className="grid grid-cols-2"
          style={{ gap: "var(--spacing-fluid-2)" }}
        >
          <button
            type="button"
            onClick={() => setShowQrModal(true)}
            className="font-poppins flex items-center justify-center rounded-[30px] border border-[#418964] bg-[#cde9da] font-semibold text-[#418964] transition hover:bg-[#bddfce]"
            style={{
              height: "var(--height-control-md)",
              fontSize: "var(--text-fluid-sm)",
              gap: "var(--spacing-fluid-2)",
              paddingInline: "var(--spacing-fluid-2)",
            }}
          >
            <i aria-hidden="true" className="pi pi-qrcode" />
            Abrir QR Code
          </button>

          <Link
            href={`/mesa/${tableId}/painel`}
            className="font-poppins flex items-center justify-center rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050]"
            style={{
              height: "var(--height-control-md)",
              fontSize: "var(--text-fluid-sm)",
              paddingInline: "var(--spacing-fluid-2)",
            }}
          >
            Ir para mesa
          </Link>
        </div>
      </section>

      {showQrModal ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
          onClick={() => setShowQrModal(false)}
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-white shadow-xl"
            style={{ padding: "var(--spacing-fluid-5)" }}
            onClick={(event) => event.stopPropagation()}
          >
            <h2
              id="qr-modal-title"
              className="font-bagel text-center text-[#418964]"
              style={{ fontSize: "var(--text-fluid-xl)" }}
            >
              QR Code da mesa
            </h2>
            <p
              className="font-poppins text-center text-[#64835b]"
              style={{
                marginTop: "var(--spacing-fluid-2)",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              Peça para os participantes escanearem para entrar na mesa.
            </p>
            <div
              className="mx-auto flex justify-center rounded-xl bg-white p-4"
              style={{ marginTop: "var(--spacing-fluid-4)" }}
            >
              <QRCode
                value={qrValue}
                size={220}
                bgColor="#ffffff"
                fgColor="#418964"
                level="M"
              />
            </div>
            <p
              className="font-bagel text-center tracking-[0.2em] text-[#418964]"
              style={{
                marginTop: "var(--spacing-fluid-3)",
                fontSize: "var(--text-fluid-lg)",
              }}
            >
              {tableId}
            </p>
            <button
              type="button"
              onClick={() => setShowQrModal(false)}
              className="font-poppins mt-4 flex w-full items-center justify-center rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050]"
              style={{
                height: "var(--height-control-md)",
                fontSize: "var(--text-fluid-base)",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}
    </main>
  );
}
