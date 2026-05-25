"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { useAuth } from "@/lib/contexts/AuthContext";
import {
  deleteAccount,
  getAuthErrorMessage,
  signOut,
  updateDisplayName,
} from "@/lib/services/auth";

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

  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && !user) {
      router.replace("/login");
    }
  }, [loading, user, router]);

  if (loading || !user) {
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

  async function handleSignOut() {
    setError(null);
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch (err) {
      setError(getAuthErrorMessage(err));
      setSigningOut(false);
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

  const busy = signingOut || deleting;

  return (
    <main
      className="flex min-h-dvh flex-1 flex-col bg-[#418964] text-white"
      style={{
        paddingInline: "var(--spacing-fluid-5)",
        paddingTop: "var(--spacing-fluid-8)",
        paddingBottom: "var(--spacing-fluid-5)",
      }}
    >
      <h1
        className="font-bagel text-center leading-tight"
        style={{ fontSize: "var(--text-fluid-3xl)" }}
      >
        Meu perfil
      </h1>

      <section
        className="flex flex-col items-center"
        style={{
          marginTop: "var(--spacing-fluid-6)",
          gap: "var(--spacing-fluid-2)",
        }}
      >
        {editingName ? (
          <div
            className="flex w-full max-w-[min(17.5rem,75cqi)] flex-col items-stretch"
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
              className="font-poppins rounded-lg border border-white/40 bg-white/10 text-center text-white outline-none focus:border-white"
            />
            <div className="flex" style={{ gap: "var(--spacing-fluid-2)" }}>
              <button
                type="button"
                onClick={cancelEditName}
                disabled={savingName}
                style={{
                  fontSize: "var(--text-fluid-sm)",
                  paddingInline: "var(--spacing-fluid-3)",
                  paddingBlock: "var(--spacing-fluid-2)",
                }}
                className="font-poppins flex-1 rounded-lg border border-white/40 bg-transparent text-white disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={saveName}
                disabled={savingName}
                style={{
                  fontSize: "var(--text-fluid-sm)",
                  paddingInline: "var(--spacing-fluid-3)",
                  paddingBlock: "var(--spacing-fluid-2)",
                }}
                className="font-poppins flex-1 rounded-lg bg-white font-semibold text-[#418964] disabled:opacity-60"
              >
                {savingName ? "Salvando..." : "Salvar"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={startEditName}
            className="font-poppins flex items-center font-semibold text-white"
            style={{
              fontSize: "var(--text-fluid-base)",
              gap: "var(--spacing-fluid-2)",
            }}
            aria-label="Editar nome"
          >
            <span>{displayName || "Sem nome"}</span>
            <i
              aria-hidden="true"
              className="pi pi-pencil opacity-80"
              style={{ fontSize: "var(--text-fluid-sm)" }}
            />
          </button>
        )}

        <p
          className="font-poppins text-white/80"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          {user.email}
        </p>
      </section>

      {error ? (
        <p
          role="alert"
          className="font-poppins text-center font-medium text-[#ffd0d0]"
          style={{
            marginTop: "var(--spacing-fluid-4)",
            fontSize: "var(--text-fluid-xs)",
          }}
        >
          {error}
        </p>
      ) : null}

      <div
        className="mt-auto flex flex-col"
        style={{ gap: "var(--spacing-fluid-3)" }}
      >
        <button
          type="button"
          onClick={handleSignOut}
          disabled={busy}
          style={{
            height: "var(--height-control-md)",
            fontSize: "var(--text-fluid-base)",
            gap: "var(--spacing-fluid-2)",
          }}
          className="font-poppins flex w-full items-center justify-center rounded-[30px] border border-white/40 bg-transparent font-semibold text-white transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
        >
          <i
            aria-hidden="true"
            className="pi pi-sign-out"
            style={{ fontSize: "var(--text-fluid-lg)" }}
          />
          <span>{signingOut ? "Saindo..." : "Sair"}</span>
        </button>

        {confirmingDelete ? (
          <div
            className="rounded-2xl border border-[#ffd0d0]/40 bg-black/20"
            style={{ padding: "var(--spacing-fluid-4)" }}
          >
            <p
              className="font-poppins text-center text-white"
              style={{
                marginBottom: "var(--spacing-fluid-3)",
                fontSize: "var(--text-fluid-xs)",
              }}
            >
              Tem certeza? Essa ação é permanente.
            </p>
            <div className="flex" style={{ gap: "var(--spacing-fluid-2)" }}>
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                disabled={deleting}
                style={{
                  fontSize: "var(--text-fluid-sm)",
                  paddingInline: "var(--spacing-fluid-3)",
                  paddingBlock: "var(--spacing-fluid-2)",
                }}
                className="font-poppins flex-1 rounded-[30px] border border-white/40 bg-transparent text-white disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                style={{
                  fontSize: "var(--text-fluid-sm)",
                  paddingInline: "var(--spacing-fluid-3)",
                  paddingBlock: "var(--spacing-fluid-2)",
                }}
                className="font-poppins flex-1 rounded-[30px] bg-[#c44a4a] font-semibold text-white disabled:opacity-60"
              >
                {deleting ? "Excluindo..." : "Excluir"}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => {
              setError(null);
              setConfirmingDelete(true);
            }}
            disabled={busy}
            style={{
              height: "var(--height-control-sm)",
              fontSize: "var(--text-fluid-sm)",
              gap: "var(--spacing-fluid-2)",
            }}
            className="font-poppins flex w-full items-center justify-center rounded-[30px] bg-transparent font-semibold text-[#ffd0d0] transition hover:bg-white/10 active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <i
              aria-hidden="true"
              className="pi pi-trash"
              style={{ fontSize: "var(--text-fluid-base)" }}
            />
            <span>Excluir conta</span>
          </button>
        )}
      </div>
    </main>
  );
}
