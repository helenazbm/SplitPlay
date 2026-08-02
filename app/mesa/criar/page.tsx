"use client";

import AuthField from "@/components/AuthField";
import EnterButton from "@/components/EnterButton";
import AlreadyInTableModal from "@/components/mesa/AlreadyInTableModal";
import FixedPricesModal from "@/components/mesa/FixedPricesModal";
import WaveTop from "@/components/WaveTop";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  AlreadyInTableError,
  createTable,
  getFirestoreErrorMessage,
} from "@/lib/services/tableService";
import { getUserDoc } from "@/lib/services/userService";
import Image from "next/image";
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
  const [showPrices, setShowPrices] = useState(false);

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

  function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) {
      return;
    }
    // Antes de criar, o admin define (opcionalmente) os preços fixos.
    setError(null);
    setShowPrices(true);
  }

  async function handleCreate(values: {
    couvertSuggested: number;
    tipPercent: number;
  }) {
    setError(null);
    setLoading(true);

    try {
      const tableId = await createTable({
        name,
        couvertSuggested: values.couvertSuggested,
        tipPercent: values.tipPercent,
      });
      router.push(`/mesa/${tableId}`);
    } catch (err) {
      setLoading(false);
      setShowPrices(false);
      if (err instanceof AlreadyInTableError) {
        setActiveTableId(err.tableId);
      } else {
        setError(getFirestoreErrorMessage(err));
      }
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
            data-cy="nomemesa"
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
            data-cy="criarmesabutton"
            label={loading ? "Criando..." : "Criar mesa"}
            disabled={loading || !name.trim()}
            className="self-end"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />
        </form>
      </section>

      {showPrices ? (
        <FixedPricesModal
          title="Definir Preços Fixos"
          confirmLabel={loading ? "Criando..." : "Criar mesa"}
          tipPercent={10}
          saving={loading}
          error={error}
          onCancel={() => {
            if (!loading) {
              setShowPrices(false);
            }
          }}
          onConfirm={(values) => void handleCreate(values)}
        />
      ) : null}

      {activeTableId ? (
        <AlreadyInTableModal
          activeTableId={activeTableId}
          description="Você precisa sair da mesa atual primeiro para criar uma nova."
          secondaryLabel="Voltar para home"
          onSecondary={() => router.push("/")}
        />
      ) : null}
    </main>
  );
}
