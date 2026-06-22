"use client";

import AppHeader from "@/components/app/AppHeader";
import BottomNav from "@/components/app/BottomNav";
import AuthField from "@/components/AuthField";
import WaveTop from "@/components/WaveTop";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState, type SyntheticEvent } from "react";

import { useAuth } from "@/lib/contexts/AuthContext";
import {
  deleteAccount,
  getAuthErrorMessage,
  upgradeAnonymousAccount,
} from "@/lib/services/authService";
import { updateDisplayName } from "@/lib/services/userService";

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export default function PerfilPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [syncedUid, setSyncedUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");

  if (user && user.uid !== syncedUid) {
    setSyncedUid(user.uid);
    setDisplayName(user.displayName ?? "");
  }

  const [editingName, setEditingName] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [savingName, setSavingName] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [registering, setRegistering] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [savingRegister, setSavingRegister] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-[#418964] text-white">
        <p className="font-poppins" style={{ fontSize: "var(--text-fluid-sm)" }}>
          Carregando...
        </p>
      </main>
    );
  }

  function startEditName() {
    setError(null);
    setNameDraft(displayName);
    setEditingName(true);
  }

  function cancelEditName() {
    setEditingName(false);
    setNameDraft("");
  }

  async function saveName() {
    const next = nameDraft.trim();
    if (!next) {
      setError("Nome não pode ficar vazio.");
      return;
    }
    if (next === displayName) {
      cancelEditName();
      return;
    }

    setSavingName(true);
    setError(null);
    try {
      await updateDisplayName(next);
      setDisplayName(next);
      setEditingName(false);
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSavingName(false);
    }
  }

  async function handleRegister(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingRegister(true);
    setError(null);
    try {
      await upgradeAnonymousAccount({
        email: registerEmail.trim(),
        password: registerPassword,
      });
      // A conta deixa de ser anônima; o card sai de cena automaticamente.
      setRegistering(false);
      setRegisterEmail("");
      setRegisterPassword("");
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSavingRegister(false);
    }
  }

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      await deleteAccount();
      router.replace("/");
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  return (
    <main className="relative flex min-h-dvh flex-1 flex-col overflow-hidden bg-[#418964]">
      <AppHeader title="Meu perfil" />

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

        <div
          className="sp-rise flex flex-col items-center"
          style={{ gap: "var(--spacing-fluid-3)", animationDelay: "60ms" }}
        >
          {user.photoURL ? (
            <Image
              src={user.photoURL}
              alt=""
              width={80}
              height={80}
              className="rounded-full border-2 border-[#418964]/15 object-cover"
              style={{ height: "5rem", width: "5rem" }}
            />
          ) : (
            <span
              className="font-poppins flex items-center justify-center rounded-full border-2 border-[#418964]/15 bg-[#cde9da] font-bold text-[#418964]"
              style={{
                height: "5rem",
                width: "5rem",
                fontSize: "var(--text-fluid-2xl)",
              }}
            >
              {getInitials(displayName)}
            </span>
          )}

          {editingName ? (
            <div
              className="flex w-full max-w-[min(18rem,80cqi)] flex-col"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <input
                type="text"
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                autoFocus
                maxLength={40}
                style={{
                  fontSize: "var(--text-fluid-base)",
                  paddingInline: "var(--spacing-fluid-3)",
                  paddingBlock: "var(--spacing-fluid-2)",
                }}
                className="font-poppins rounded-lg border border-[#418964]/40 bg-[#fffbf0] text-center text-[#418964] outline-none focus:border-[#418964]"
              />
              <div className="flex" style={{ gap: "var(--spacing-fluid-2)" }}>
                <button
                  type="button"
                  onClick={cancelEditName}
                  disabled={savingName}
                  style={{
                    fontSize: "var(--text-fluid-sm)",
                    paddingBlock: "var(--spacing-fluid-2)",
                  }}
                  className="font-poppins flex-1 rounded-[30px] border border-[#418964]/40 bg-white font-semibold text-[#418964] disabled:opacity-60"
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={savingName}
                  style={{
                    fontSize: "var(--text-fluid-sm)",
                    paddingBlock: "var(--spacing-fluid-2)",
                  }}
                  className="font-poppins flex-1 rounded-[30px] bg-[#418964] font-semibold text-white disabled:opacity-60"
                >
                  {savingName ? "Salvando..." : "Salvar"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={startEditName}
              aria-label="Editar nome"
              className="font-poppins flex items-center font-semibold text-[#418964]"
              style={{
                fontSize: "var(--text-fluid-lg)",
                gap: "var(--spacing-fluid-2)",
              }}
            >
              <span>{displayName || "Sem nome"}</span>
              <i
                aria-hidden="true"
                className="pi pi-pencil opacity-70"
                style={{ fontSize: "var(--text-fluid-sm)" }}
              />
            </button>
          )}

          <p
            className="font-poppins text-[#64835b]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            {user.email ?? "Conta de convidado"}
          </p>
        </div>

        {error ? (
          <p
            role="alert"
            className="font-poppins text-center font-medium text-[#c0392b]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            {error}
          </p>
        ) : null}

        {user.isAnonymous ? (
          <div
            className="sp-rise mt-auto flex flex-col rounded-[10px_10px_25px_10px] border border-[#418964]/30 bg-[#eaf6ef]"
            style={{
              padding: "var(--spacing-fluid-4)",
              gap: "var(--spacing-fluid-3)",
              animationDelay: "160ms",
            }}
          >
            <div>
              <h3
                className="font-bagel text-[#418964]"
                style={{ fontSize: "var(--text-fluid-base)" }}
              >
                Criar uma conta
              </h3>
              <p
                className="font-poppins text-[#64835b]"
                style={{
                  marginTop: "var(--spacing-fluid-1)",
                  fontSize: "var(--text-fluid-xs)",
                }}
              >
                Você está como convidado. Registre um e-mail e senha para salvar
                seu progresso e acessar de qualquer lugar.
              </p>
            </div>

            {registering ? (
              <form
                onSubmit={(event) => void handleRegister(event)}
                className="flex flex-col"
                style={{ gap: "var(--spacing-fluid-3)" }}
              >
                <AuthField
                  label="Email"
                  name="register-email"
                  type="email"
                  autoComplete="email"
                  required
                  value={registerEmail}
                  onChange={(e) => setRegisterEmail(e.target.value)}
                  placeholder="example@gmail.com"
                  icon={<i aria-hidden="true" className="pi pi-envelope" />}
                />

                <AuthField
                  label="Senha"
                  name="register-password"
                  type={showRegisterPassword ? "text" : "password"}
                  autoComplete="new-password"
                  required
                  minLength={6}
                  value={registerPassword}
                  onChange={(e) => setRegisterPassword(e.target.value)}
                  placeholder="************"
                  trailing={
                    <button
                      type="button"
                      aria-label={
                        showRegisterPassword ? "Ocultar senha" : "Mostrar senha"
                      }
                      onClick={() => setShowRegisterPassword((v) => !v)}
                      className="flex h-11 w-11 items-center justify-center rounded-full text-[#b1c1ad] active:bg-[#418964]/10"
                    >
                      <i
                        aria-hidden="true"
                        className={`pi ${showRegisterPassword ? "pi-eye-slash" : "pi-eye"}`}
                        style={{ fontSize: "var(--text-fluid-lg)" }}
                      />
                    </button>
                  }
                />

                <div
                  className="grid grid-cols-2"
                  style={{ gap: "var(--spacing-fluid-2)" }}
                >
                  <button
                    type="button"
                    onClick={() => setRegistering(false)}
                    disabled={savingRegister}
                    className="font-poppins flex items-center justify-center rounded-[30px] border border-[#418964] bg-white font-semibold text-[#418964] disabled:opacity-60"
                    style={{
                      height: "var(--height-control-md)",
                      fontSize: "var(--text-fluid-sm)",
                    }}
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={savingRegister}
                    className="font-poppins flex items-center justify-center rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050] disabled:opacity-60"
                    style={{
                      height: "var(--height-control-md)",
                      fontSize: "var(--text-fluid-sm)",
                    }}
                  >
                    {savingRegister ? "Criando..." : "Criar conta"}
                  </button>
                </div>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setRegistering(true);
                }}
                className="font-poppins flex items-center justify-center gap-2 rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050]"
                style={{
                  height: "var(--height-control-md)",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                <i aria-hidden="true" className="pi pi-user-plus" />
                Criar conta
              </button>
            )}
          </div>
        ) : (
          <div
            className="sp-rise mt-auto flex flex-col rounded-[10px_10px_25px_10px] border border-[#c0392b]/40 bg-[#fdecea]"
            style={{
              padding: "var(--spacing-fluid-4)",
              gap: "var(--spacing-fluid-3)",
              animationDelay: "160ms",
            }}
          >
            <div>
              <h3
                className="font-bagel text-[#c0392b]"
                style={{ fontSize: "var(--text-fluid-base)" }}
              >
                Excluir conta
              </h3>
            <p
              className="font-poppins text-[#8a3b32]"
              style={{
                marginTop: "var(--spacing-fluid-1)",
                fontSize: "var(--text-fluid-xs)",
              }}
            >
              Essa ação é permanente e remove seus dados.
            </p>
          </div>

          {confirmingDelete ? (
            <div
              className="grid grid-cols-2"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                className="font-poppins flex items-center justify-center rounded-[30px] border border-[#418964] bg-white font-semibold text-[#418964] disabled:opacity-60"
                style={{
                  height: "var(--height-control-md)",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleDelete()}
                disabled={deleting}
                className="font-poppins flex items-center justify-center rounded-[30px] bg-[#c0392b] font-semibold text-white transition hover:bg-[#a93226] disabled:opacity-60"
                style={{
                  height: "var(--height-control-md)",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                {deleting ? "Excluindo..." : "Confirmar"}
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setError(null);
                setConfirmingDelete(true);
              }}
              className="font-poppins flex items-center justify-center gap-2 rounded-[30px] border border-[#c0392b] bg-white font-semibold text-[#c0392b] transition hover:bg-[#fdecea]"
              style={{
                height: "var(--height-control-md)",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              <i aria-hidden="true" className="pi pi-trash" />
              Excluir conta
            </button>
          )}
          </div>
        )}
      </section>

      <BottomNav />
    </main>
  );
}
