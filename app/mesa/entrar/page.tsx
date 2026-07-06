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
} from "@/lib/services/tableService";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

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

export default function EntrarMesaPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmedCode = code.trim();
    if (!trimmedCode) return;

    setError(null);

    // Usuário registrado (não anônimo): entra direto na mesa.
    if (user && !user.isAnonymous) {
      setLoading(true);
      try {
        await joinTable(trimmedCode);
        router.push(`/mesa/${trimmedCode}/painel`);
      } catch (err) {
        setError(getJoinErrorMessage(err));
        setLoading(false);
      }
      return;
    }

    // Visitante: segue para a etapa de identificação (nome anônimo ou login).
    router.push(`/mesa/entrar/identificacao?code=${encodeURIComponent(trimmedCode)}`);
  }

  function handleQrCode() {
    router.push("/mesa/qrcode");
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
          Entrar em uma mesa
        </h1>

        <form
          className="flex flex-col"
          onSubmit={handleSubmit}
          style={{ gap: "var(--spacing-fluid-4)" }}
        >
          <AuthField
            label="Código"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="off"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="501334"
            icon={<i aria-hidden="true" className="pi pi-hashtag" />}
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
            label={loading ? "Entrando..." : "Entrar"}
            disabled={loading || authLoading || !code.trim()}
            className="self-end"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />
        </form>
      </section>
    </main>
  );
}
