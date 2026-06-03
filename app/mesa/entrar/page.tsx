"use client";

import AuthField from "@/components/AuthField";
import EnterButton from "@/components/EnterButton";
import WaveTop from "@/components/WaveTop";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

export default function EntrarMesaPage() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = code.trim();
    if (!trimmed) return;

    setError(null);
    setLoading(true);
    try {
      router.push(`/mesa/${trimmed}`);
    } catch {
      setError("Não foi possível entrar na mesa. Tente novamente.");
      setLoading(false);
    }
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

          <button
            type="button"
            onClick={handleQrCode}
            disabled={loading}
            style={{
              height: "var(--height-control-md)",
              fontSize: "var(--text-fluid-base)",
              gap: "var(--spacing-fluid-2)",
            }}
            className="font-poppins flex w-full items-center justify-center rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span>Acessar com QR Code</span>
            <i
              aria-hidden="true"
              className="pi pi-qrcode"
              style={{ fontSize: "var(--text-fluid-lg)" }}
            />
          </button>

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
            disabled={loading || !code.trim()}
            className="self-end"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />
        </form>
      </section>
    </main>
  );
}
