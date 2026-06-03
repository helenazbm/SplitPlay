"use client";

import AuthField from "@/components/AuthField";
import EnterButton from "@/components/EnterButton";
import WaveTop from "@/components/WaveTop";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  AlreadyInTableError,
  createTable,
  getFirestoreErrorMessage,
} from "@/lib/services/tableService";
import { getUserDoc } from "@/lib/services/userService";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type SyntheticEvent } from "react";

export default function CriarMesaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [checkingUser, setCheckingUser] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!user) {
      router.replace("/login?redirect=/mesa/criar");
      return;
    }

    let cancelled = false;

    async function checkCurrentTable() {
      try {
        const profile = await getUserDoc();
        if (cancelled) {
          return;
        }

        if (profile?.currentTableId) {
          setActiveTableId(profile.currentTableId);
        }
      } catch {
        if (!cancelled) {
          setError("Não foi possível carregar seu perfil.");
        }
      } finally {
        if (!cancelled) {
          setCheckingUser(false);
        }
      }
    }

    void checkCurrentTable();

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, router]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const tableId = await createTable({ name });
      router.push(`/mesa/${tableId}`);
    } catch (err) {
      if (err instanceof AlreadyInTableError) {
        setActiveTableId(err.tableId);
      } else {
        setError(getFirestoreErrorMessage(err));
      }
      setLoading(false);
    }
  }

  if (authLoading || checkingUser || !user) {
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
        className="relative z-20 mt-[clamp(15rem,24dvh,22rem)] flex w-full flex-1 flex-col justify-center rounded-t-[30px] bg-white"
        style={{
          paddingInline: "var(--spacing-fluid-5)",
          paddingTop: "var(--spacing-fluid-6)",
          paddingBottom: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-5)",
        }}
      >
        <WaveTop />

        <h1
          className="font-bagel text-center leading-tight text-[#418964]"
          style={{ fontSize: "var(--text-fluid-2xl)" }}
        >
          Criar uma mesa
        </h1>

        <form
          className="flex flex-col"
          onSubmit={handleSubmit}
          style={{ gap: "var(--spacing-fluid-4)" }}
        >
          <AuthField
            label="Nome da mesa"
            name="name"
            type="text"
            autoComplete="off"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Aniversário da Maria"
            icon={<i aria-hidden="true" className="pi pi-users" />}
          />

          {error ? (
            <p
              role="alert"
              className="font-poppins text-center font-medium text-[#c0392b]"
              style={{ fontSize: "var(--text-fluid-xs)" }}
            >
              {error}
            </p>
          ) : null}

          <EnterButton
            label={loading ? "Criando..." : "Criar mesa"}
            disabled={loading || !name.trim()}
            className="self-end"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />
        </form>
      </section>

      {activeTableId ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="active-table-title"
        >
          <div
            className="w-full max-w-sm rounded-[20px] bg-white shadow-xl"
            style={{
              padding: "var(--spacing-fluid-5)",
              gap: "var(--spacing-fluid-4)",
            }}
          >
            <h2
              id="active-table-title"
              className="font-bagel text-center text-[#418964]"
              style={{ fontSize: "var(--text-fluid-xl)" }}
            >
              Você já está em uma mesa
            </h2>
            <p
              className="font-poppins text-center text-[#64835b]"
              style={{
                marginTop: "var(--spacing-fluid-3)",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              Você precisa sair da mesa atual primeiro para criar uma nova.
            </p>
            <div
              className="flex flex-col"
              style={{
                marginTop: "var(--spacing-fluid-4)",
                gap: "var(--spacing-fluid-2)",
              }}
            >
              <Link
                href={`/mesa/${activeTableId}/painel`}
                className="font-poppins flex items-center justify-center rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050]"
                style={{
                  height: "var(--height-control-md)",
                  fontSize: "var(--text-fluid-base)",
                }}
              >
                Ir para mesa atual
              </Link>
              <button
                type="button"
                onClick={() => router.push("/")}
                className="font-poppins text-[#64835b] underline underline-offset-4"
                style={{ fontSize: "var(--text-fluid-sm)" }}
              >
                Voltar para home
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
