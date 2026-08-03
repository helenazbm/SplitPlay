"use client";

import AuthField from "@/components/AuthField";
import EnterButton from "@/components/EnterButton";
import WaveTop from "@/components/WaveTop";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useState, type SyntheticEvent } from "react";

import {
  getAuthErrorMessage,
  signUpWithEmail,
} from "@/lib/services/authService";

const AVATAR_OPTIONS = [
  "/avatars/avatar-1.png",
  "/avatars/avatar-2.png",
  "/avatars/avatar-3.png",
  "/avatars/avatar-4.png",
];

export default function SignUpPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [avatar, setAvatar] = useState<string | null>(AVATAR_OPTIONS[0]);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signUpWithEmail({
        email: email.trim(),
        password,
        displayName: username.trim(),
        avatarUrl: avatar,
      });
      router.push("/");
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
          Criar conta
        </h1>

        <form
          className="flex flex-col"
          onSubmit={handleSubmit}
          style={{
            gap: "var(--spacing-fluid-3)",
          }}
        >
          <div className="flex flex-col">
            <span
              className="font-poppins text-[#64835b]"
              style={{ fontSize: "var(--text-fluid-sm)" }}
            >
              Foto de perfil
            </span>
            <div
              className="flex"
              style={{
                gap: "var(--spacing-fluid-3)",
                marginTop: "var(--spacing-fluid-2)",
              }}
            >
              {AVATAR_OPTIONS.map((src, index) => {
                const selected = src === avatar;
                return (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setAvatar(src)}
                    aria-pressed={selected}
                    aria-label={`Avatar ${index + 1}`}
                    className={`relative flex aspect-square flex-1 items-center justify-center rounded-full border-2 transition active:scale-[0.97] ${
                      selected
                        ? "border-[#418964] ring-2 ring-[#418964]/25"
                        : "border-[#418964]/20"
                    }`}
                  >
                    <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full">
                      <Image
                        src={src}
                        alt=""
                        width={72}
                        height={72}
                        className="h-full w-full object-cover"
                      />
                    </span>
                    {selected ? (
                      <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#418964] text-white">
                        <i
                          aria-hidden="true"
                          className="pi pi-check"
                          style={{ fontSize: "0.6rem" }}
                        />
                      </span>
                    ) : null}
                  </button>
                );
              })}

              <button
                type="button"
                onClick={() => setAvatar(null)}
                aria-pressed={avatar === null}
                aria-label="Sem foto de perfil"
                className={`relative flex aspect-square flex-1 items-center justify-center rounded-full border-2 bg-[#f3f6f1] text-[#64835b] transition active:scale-[0.97] ${
                  avatar === null
                    ? "border-[#418964] ring-2 ring-[#418964]/25"
                    : "border-[#418964]/20"
                }`}
              >
                <i
                  aria-hidden="true"
                  className="pi pi-ban"
                  style={{ fontSize: "var(--text-fluid-lg)" }}
                />
                {avatar === null ? (
                  <span className="absolute bottom-0 right-0 flex h-5 w-5 items-center justify-center rounded-full border-2 border-white bg-[#418964] text-white">
                    <i
                      aria-hidden="true"
                      className="pi pi-check"
                      style={{ fontSize: "0.6rem" }}
                    />
                  </span>
                ) : null}
              </button>
            </div>
          </div>

          <AuthField
            data-cy="email"
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
            data-cy="username"
            label="Seu nome"
            name="username"
            type="text"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Maria Silva"
            icon={<i aria-hidden="true" className="pi pi-user" />}
          />

          <AuthField
            data-cy="password"
            label="Senha"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            required
            minLength={6}
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
            data-cy="enter-button"
            label={loading ? "Criando..." : "Criar conta"}
            disabled={loading}
            className="self-end"
            style={{ marginTop: "var(--spacing-fluid-3)" }}
          />
        </form>
      </section>
    </main>
  );
}
