"use client";

import AuthField from "@/components/AuthField";
import EnterButton from "@/components/EnterButton";
import WaveTop from "@/components/WaveTop";
import { useAuth } from "@/lib/contexts/AuthContext";
import { getAuthErrorMessage } from "@/lib/services/authService";
import {
  AlreadyInTableError,
  getFirestoreErrorMessage,
  joinTable,
  joinTableAnonymously,
} from "@/lib/services/tableService";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type SyntheticEvent } from "react";

function getJoinErrorMessage(error: unknown): string {
  if (error instanceof AlreadyInTableError) {
    return "Você já está em outra mesa. Saia dela antes de entrar em uma nova.";
  }

  const code =
    error && typeof error === "object" && "code" in error
      ? String((error as { code: unknown }).code)
      : "";

  if (code.startsWith("auth/")) {
    return getAuthErrorMessage(error);
  }

  return getFirestoreErrorMessage(error);
}

export default function IdentificacaoMesaPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tableId = (searchParams.get("code") ?? "").trim();
  const { user, loading: authLoading } = useAuth();

  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoJoining = useRef(false);

  const loginRedirect = `/mesa/entrar/identificacao?code=${encodeURIComponent(tableId)}`;

  // Usuário registrado (vindo do login ou já autenticado): entra direto na mesa.
  useEffect(() => {
    if (authLoading || !tableId) return;
    if (!user || user.isAnonymous) return;
    if (autoJoining.current) return;

    autoJoining.current = true;
    setLoading(true);
    joinTable(tableId)
      .then(() => router.replace(`/mesa/${tableId}/painel`))
      .catch((err) => {
        autoJoining.current = false;
        setError(getJoinErrorMessage(err));
        setLoading(false);
      });
  }, [authLoading, user, tableId, router]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!tableId) {
      setError("Código da mesa não informado.");
      return;
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Informe seu nome para entrar na mesa.");
      return;
    }

    setError(null);
    setLoading(true);
    try {
      await joinTableAnonymously(tableId, trimmedName);
      router.push(`/mesa/${tableId}/painel`);
    } catch (err) {
      setError(getJoinErrorMessage(err));
      setLoading(false);
    }
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

        <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-2)" }}>
          <h1
            className="font-bagel text-center leading-tight text-[#418964]"
            style={{ fontSize: "var(--text-fluid-2xl)" }}
          >
            Como você quer entrar?
          </h1>
          <p
            className="font-poppins text-center text-[#64835b]"
            style={{ fontSize: "var(--text-fluid-sm)" }}
          >
            Escolha um nome para entrar como convidado ou faça login na sua conta.
          </p>
        </div>

        <form
          className="flex flex-col"
          onSubmit={handleSubmit}
          style={{ gap: "var(--spacing-fluid-4)" }}
        >
          <AuthField
            label="Seu nome"
            name="name"
            type="text"
            autoComplete="name"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Como você quer aparecer na mesa"
            icon={<i aria-hidden="true" className="pi pi-user" />}
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
            label={loading ? "Entrando..." : "Entrar como convidado"}
            disabled={loading || authLoading || !name.trim()}
            className="self-end"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />
        </form>

        <p
          className="font-poppins text-center text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Já tem uma conta?{" "}
          <Link
            href={`/login?redirect=${encodeURIComponent(loginRedirect)}`}
            className="font-medium text-[#418964] underline underline-offset-4 transition hover:text-[#64835b] focus:outline-none focus:ring-2 focus:ring-[#418964]/30 rounded"
          >
            Fazer login
          </Link>
        </p>
      </section>
    </main>
  );
}
