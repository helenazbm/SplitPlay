"use client";

import AuthField from "@/components/AuthField";
import EnterButton from "@/components/EnterButton";
import WaveTop from "@/components/WaveTop";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type SyntheticEvent } from "react";

import { useAuth } from "@/lib/contexts/AuthContext";
import {
  getAuthErrorMessage,
  signInWithEmail,
} from "@/lib/services/authService";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirect") ?? "/inicio";
  const { user, loading: authLoading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && user) {
      router.replace(redirectTo);
    }
  }, [authLoading, user, router, redirectTo]);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail({ email: email.trim(), password });
      router.push(redirectTo);
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setLoading(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-[#fdbfc0]">
      <Image
        src="/plano_auth.svg"
        alt=""
        width={402}
        height={529}
        priority
        className="pointer-events-none absolute left-0 top-0 h-[clamp(20rem,32dvh,20rem)] w-full object-cover object-cover"
      />

      <section
        className="relative z-20 mt-[clamp(15rem,24dvh,22rem)] flex w-full flex-1 flex-col justify-center bg-white"
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
          Login
        </h1>

        <form
          className="flex flex-col"
          onSubmit={handleSubmit}
          style={{
            gap: "var(--spacing-fluid-3)",
          }}
        >
          <AuthField
            label="Email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="example@gmail.com"
            icon={<i aria-hidden="true" className="pi pi-envelope" />}
          />

          <AuthField
            label="Senha"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="************"
            trailing={
              <button
                type="button"
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                onClick={() => setShowPassword((v) => !v)}
                className="flex h-11 w-11 items-center justify-center rounded-full text-[#b1c1ad] active:bg-[#418964]/10"
              >
                <i
                  aria-hidden="true"
                  className={`pi ${showPassword ? "pi-eye-slash" : "pi-eye"}`}
                  style={{ fontSize: "var(--text-fluid-lg)" }}
                />
              </button>
            }
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
            disabled={loading}
            className="self-end"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />
        </form>

        <p
          className="font-poppins text-center text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Não tem uma conta?{" "}
          <Link
            href="/signup"
            className="font-medium text-[#418964] underline underline-offset-4 transition hover:text-[#64835b] focus:outline-none focus:ring-2 focus:ring-[#418964]/30 rounded"
          >
            Cadastre-se
          </Link>
        </p>
      </section>
    </main>
  );
}
