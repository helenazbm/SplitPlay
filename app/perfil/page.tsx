"use client";

import AuthField from "@/components/AuthField";
import EditProfileModal from "@/components/perfil/EditProfileModal";
import WaveTop from "@/components/WaveTop";
import { useRouter } from "next/navigation";
import { useEffect, useState, type SyntheticEvent } from "react";

import Avatar from "@/components/Avatar";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  deleteAccount,
  getAuthErrorMessage,
  signOut,
  upgradeAnonymousAccount,
} from "@/lib/services/authService";
import { getMyActiveTable } from "@/lib/services/tableService";
import { getUserDoc } from "@/lib/services/userService";

const MENU_ITEMS = [
  { key: "stats", label: "Estatísticas", icon: "pi-chart-line" },
  { key: "settings", label: "Configurações", icon: "pi-cog" },
  { key: "help", label: "Ajuda", icon: "pi-question-circle" },
] as const;

export default function PerfilPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  const [syncedUid, setSyncedUid] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [coins, setCoins] = useState<number | null>(null);
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  if (user && user.uid !== syncedUid) {
    setSyncedUid(user.uid);
    setDisplayName(user.displayName ?? "");
    setAvatar(user.photoURL ?? null);
  }

  const [editing, setEditing] = useState(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const [registering, setRegistering] = useState(false);
  const [registerEmail, setRegisterEmail] = useState("");
  const [registerPassword, setRegisterPassword] = useState("");
  const [showRegisterPassword, setShowRegisterPassword] = useState(false);
  const [savingRegister, setSavingRegister] = useState(false);

  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Ao sair (signingOut) o redirecionamento é para a home (handleSignOut);
    // não cair no guard de login.
    if (!loading && !user && !signingOut) {
      router.replace("/login");
    }
  }, [loading, user, router, signingOut]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    getUserDoc()
      .then((doc) => {
        if (!cancelled) {
          setCoins(doc?.coins ?? 0);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCoins(0);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  useEffect(() => {
    if (!user) {
      return;
    }
    let cancelled = false;
    getMyActiveTable()
      .then((result) => {
        if (!cancelled) {
          setActiveTableId(result?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveTableId(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  function handleBackToMesa() {
    if (activeTableId) {
      router.push(`/mesa/${activeTableId}/painel`);
    } else {
      router.back();
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  }

  if (loading || !user) {
    return (
      <main className="flex min-h-dvh flex-1 items-center justify-center bg-[#418964] text-white">
        <p className="font-poppins" style={{ fontSize: "var(--text-fluid-sm)" }}>
          Carregando...
        </p>
      </main>
    );
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
    <main className="splitplay-home-pattern relative flex min-h-dvh flex-1 flex-col overflow-hidden">
      {/* Topo verde com o padrão de comidas + botão fechar (volta para a mesa). */}
      <div
        className="absolute right-0 top-0 z-40"
        style={{
          paddingInline: "var(--spacing-fluid-4)",
          paddingTop: "calc(var(--spacing-fluid-4) + env(safe-area-inset-top))",
        }}
      >
        <button
          type="button"
          onClick={handleBackToMesa}
          aria-label="Voltar para a mesa"
          title="Voltar para a mesa"
          className="flex shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95"
          style={{ height: "2.25rem", width: "2.25rem" }}
        >
          <i
            aria-hidden="true"
            className="pi pi-times"
            style={{ fontSize: "var(--text-fluid-base)" }}
          />
        </button>
      </div>

      <section
        className="relative z-20 mt-[clamp(7rem,18dvh,9rem)] flex min-h-0 flex-1 flex-col bg-white"
        style={{
          paddingInline: "var(--spacing-fluid-5)",
          paddingTop: "var(--spacing-fluid-3)",
          paddingBottom: "calc(var(--spacing-fluid-6) + env(safe-area-inset-bottom))",
          gap: "var(--spacing-fluid-5)",
        }}
      >
        {/* Onda branca curva sobre o verde, como nas demais telas. */}
        <WaveTop />

        {/* Cabeçalho do perfil: avatar sobre a onda, nome, moedas e ação. */}
        <div
          className="sp-rise relative z-40 flex flex-col items-center"
          style={{
            gap: "var(--spacing-fluid-3)",
            marginTop: "calc(-1 * clamp(4.75rem, 20cqi, 6rem))",
            animationDelay: "60ms",
          }}
        >
          <Avatar
            name={displayName}
            avatarUrl={avatar}
            className="border-4 border-white shadow-[0_10px_24px_rgba(31,43,36,0.2)]"
            style={{ height: "7rem", width: "7rem" }}
            textStyle={{ fontSize: "var(--text-fluid-2xl)" }}
          />

          <h2
            className="font-poppins text-center font-bold text-[#3f4a43]"
            style={{ fontSize: "var(--text-fluid-xl)" }}
          >
            {displayName || "Sem nome"}
          </h2>

          <div className="flex items-center" style={{ gap: "var(--spacing-fluid-3)" }}>
            <span
              className="font-poppins flex items-center rounded-full border border-[#f0d199] bg-[#fdf6e7] font-semibold text-[#d98a2b]"
              style={{
                gap: "var(--spacing-fluid-2)",
                paddingInline: "var(--spacing-fluid-3)",
                paddingBlock: "var(--spacing-fluid-2)",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/avatars/moeda-icon.svg"
                alt=""
                aria-hidden="true"
                className="object-contain"
                style={{ height: "1.4rem", width: "1.4rem" }}
              />
              {coins ?? 0} moedas
            </span>

            <button
              type="button"
              onClick={() => {
                setError(null);
                setEditing(true);
              }}
              className="font-poppins flex items-center rounded-full border border-[#418964]/40 bg-white font-semibold text-[#418964] transition hover:bg-[#eaf6ef] active:scale-95"
              style={{
                gap: "var(--spacing-fluid-2)",
                paddingInline: "var(--spacing-fluid-3)",
                paddingBlock: "var(--spacing-fluid-2)",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              <i aria-hidden="true" className="pi pi-pencil" style={{ fontSize: "var(--text-fluid-sm)" }} />
              Editar Perfil
            </button>
          </div>
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

        {/* Menu (placeholders visuais por enquanto) */}
        <nav className="sp-rise flex flex-col" style={{ animationDelay: "120ms" }}>
          {MENU_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className="font-poppins flex items-center border-b border-[#eef0ec] text-left text-[#7a857c] transition hover:text-[#418964] active:scale-[0.99]"
              style={{
                gap: "var(--spacing-fluid-3)",
                paddingBlock: "var(--spacing-fluid-4)",
              }}
            >
              <i aria-hidden="true" className={`pi ${item.icon}`} style={{ fontSize: "var(--text-fluid-lg)" }} />
              <span className="flex-1" style={{ fontSize: "var(--text-fluid-sm)" }}>
                {item.label}
              </span>
              <i aria-hidden="true" className="pi pi-angle-right opacity-60" style={{ fontSize: "var(--text-fluid-base)" }} />
            </button>
          ))}

          {/* Sair: última opção do menu. */}
          <button
            type="button"
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            className="font-poppins flex items-center text-left text-[#e5786c] transition hover:text-[#c0392b] active:scale-[0.99] disabled:opacity-60"
            style={{
              gap: "var(--spacing-fluid-3)",
              paddingBlock: "var(--spacing-fluid-4)",
            }}
          >
            <i
              aria-hidden="true"
              className={`pi ${signingOut ? "pi-spin pi-spinner" : "pi-sign-out"}`}
              style={{ fontSize: "var(--text-fluid-lg)" }}
            />
            <span className="flex-1" style={{ fontSize: "var(--text-fluid-sm)" }}>
              {signingOut ? "Saindo..." : "Sair"}
            </span>
          </button>
        </nav>

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
          <div className="mt-auto flex flex-col items-center" style={{ gap: "var(--spacing-fluid-2)" }}>
            {confirmingDelete ? (
              <div
                className="grid w-full grid-cols-2"
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
                  {deleting ? "Excluindo..." : "Confirmar exclusão"}
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setConfirmingDelete(true);
                }}
                className="font-poppins flex items-center gap-2 font-semibold text-[#c0392b] transition hover:opacity-80"
                style={{ fontSize: "var(--text-fluid-sm)", paddingBlock: "var(--spacing-fluid-2)" }}
              >
                <i aria-hidden="true" className="pi pi-trash" />
                Excluir conta
              </button>
            )}
          </div>
        )}
      </section>

      {editing ? (
        <EditProfileModal
          onClose={() => setEditing(false)}
          currentName={displayName}
          currentAvatar={avatar ?? ""}
          isAnonymous={user.isAnonymous}
          onSaved={({ name, avatar: nextAvatar }) => {
            setDisplayName(name);
            setAvatar(nextAvatar);
          }}
        />
      ) : null}
    </main>
  );
}
