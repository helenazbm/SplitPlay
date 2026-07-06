"use client";

import { useRef, useState, type SyntheticEvent } from "react";

import Avatar from "@/components/Avatar";
import { AVATARS } from "@/lib/avatars";
import {
  getAuthErrorMessage,
  updateUserPassword,
} from "@/lib/services/authService";
import { updateAvatar, updateDisplayName } from "@/lib/services/userService";

type EditProfileModalProps = {
  onClose: () => void;
  currentName: string;
  currentAvatar: string;
  isAnonymous: boolean;
  /** Avisa o pai dos novos valores após salvar, para refletir na tela. */
  onSaved: (next: { name: string; avatar: string }) => void;
};

type View = "form" | "avatar";

/**
 * Modal "Editar perfil". Monte-o apenas quando aberto (ex.: `{open && <Modal/>}`)
 * para que o estado inicial venha sempre dos dados atuais do usuário.
 */
export default function EditProfileModal({
  onClose,
  currentName,
  currentAvatar,
  isAnonymous,
  onSaved,
}: EditProfileModalProps) {
  const [view, setView] = useState<View>("form");
  const [name, setName] = useState(currentName);
  // "" = sem foto (renderiza iniciais). Guarda o valor cru, sem resolver.
  const [avatar, setAvatar] = useState(currentAvatar);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // Seleção temporária dentro do seletor (só vira oficial ao tocar em Salvar).
  const [pendingAvatar, setPendingAvatar] = useState(avatar);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nameInputRef = useRef<HTMLInputElement>(null);

  function openAvatarPicker() {
    setPendingAvatar(avatar);
    setError(null);
    setView("avatar");
  }

  function confirmAvatar() {
    setAvatar(pendingAvatar);
    setView("form");
  }

  async function handleSave(event: SyntheticEvent<HTMLFormElement>) {
    event.preventDefault();

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Nome não pode ficar vazio.");
      return;
    }
    if (password && password.length < 6) {
      setError("Senha muito curta (mínimo 6 caracteres).");
      return;
    }

    setSaving(true);
    setError(null);
    try {
      if (trimmed !== currentName.trim()) {
        await updateDisplayName(trimmed);
      }
      if (avatar !== currentAvatar) {
        await updateAvatar(avatar);
      }
      if (password) {
        await updateUserPassword(password);
      }

      onSaved({ name: trimmed, avatar });
      onClose();
    } catch (err) {
      setError(getAuthErrorMessage(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex max-w-[420px] items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Editar perfil"
      style={{ padding: "var(--spacing-fluid-4)" }}
    >
      {/* Backdrop */}
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-[#1f2b24]/45"
      />

      <div
        className="sp-rise relative flex w-full flex-col rounded-[28px] bg-[#f6f3ec] shadow-[0_20px_50px_rgba(31,43,36,0.3)]"
        style={{
          maxWidth: "min(22rem, 92cqi)",
          padding: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-4)",
        }}
      >
        <button
          type="button"
          aria-label="Fechar"
          onClick={onClose}
          className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-[#9bb0a4] transition hover:bg-[#418964]/10 hover:text-[#418964]"
        >
          <i aria-hidden="true" className="pi pi-times" style={{ fontSize: "var(--text-fluid-base)" }} />
        </button>

        <h2
          className="font-poppins font-black text-center text-[#e5786c]"
          style={{ fontSize: "20px" }}
        >
          Editar perfil
        </h2>

        {view === "form" ? (
          <form
            onSubmit={(event) => void handleSave(event)}
            className="flex flex-col"
            style={{ gap: "var(--spacing-fluid-4)" }}
          >
            <div
              className="flex flex-col items-center"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <button
                type="button"
                onClick={openAvatarPicker}
                aria-label="Trocar avatar"
                className="group relative rounded-full transition active:scale-95"
              >
                <Avatar
                  name={name}
                  avatarUrl={avatar}
                  className="border-4 border-white shadow-[0_8px_20px_rgba(31,43,36,0.18)]"
                  style={{ height: "6rem", width: "6rem" }}
                  textStyle={{ fontSize: "var(--text-fluid-2xl)" }}
                />
                <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[#418964] text-white shadow-sm">
                  <i aria-hidden="true" className="pi pi-pencil" style={{ fontSize: "0.8rem" }} />
                </span>
              </button>

              <button
                type="button"
                onClick={() => nameInputRef.current?.focus()}
                aria-label="Editar nome"
                className="font-poppins flex items-center font-bold text-[#3f4a43]"
                style={{ fontSize: "var(--text-fluid-lg)", gap: "var(--spacing-fluid-2)" }}
              >
                <span>{name.trim() || "Sem nome"}</span>
              </button>
            </div>

            <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-1)" }}>
              <label
                htmlFor="profile-name"
                className="font-poppins text-[#64835b]"
                style={{ fontSize: "var(--text-fluid-sm)" }}
              >
                Novo 
                Nome
              </label>
              <input
                id="profile-name"
                ref={nameInputRef}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={40}
                autoComplete="name"
                className="font-poppins rounded-[10px_10px_25px_10px] border border-[#cfd9cf] bg-white text-[#418964] outline-none placeholder:text-[#64835b]/45 focus:border-[#418964] focus:ring-2 focus:ring-[#418964]/20"
                style={{
                  height: "var(--height-control-md)",
                  paddingInline: "var(--spacing-fluid-4)",
                  fontSize: "var(--text-fluid-base)",
                }}
              />
            </div>

            {!isAnonymous ? (
              <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-1)" }}>
                <label
                  htmlFor="profile-password"
                  className="font-poppins text-[#64835b]"
                  style={{ fontSize: "var(--text-fluid-sm)" }}
                >
                  Nova Senha
                </label>
                <div
                  className="flex items-center rounded-[10px_10px_25px_10px] border border-[#cfd9cf] bg-white focus-within:border-[#418964] focus-within:ring-2 focus-within:ring-[#418964]/20"
                  style={{
                    height: "var(--height-control-md)",
                    paddingInlineStart: "var(--spacing-fluid-4)",
                    paddingInlineEnd: "var(--spacing-fluid-1)",
                  }}
                >
                  <input
                    id="profile-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="new-password"
                    minLength={6}
                    placeholder="••••••••••"
                    className="font-poppins min-w-0 flex-1 bg-transparent text-[#418964] outline-none placeholder:text-[#64835b]/45"
                    style={{ fontSize: "var(--text-fluid-base)" }}
                  />
                  <button
                    type="button"
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    onClick={() => setShowPassword((v) => !v)}
                    className="flex h-10 w-10 items-center justify-center rounded-full text-[#b1c1ad] active:bg-[#418964]/10"
                  >
                    <i
                      aria-hidden="true"
                      className={`pi ${showPassword ? "pi-eye-slash" : "pi-eye"}`}
                      style={{ fontSize: "var(--text-fluid-lg)" }}
                    />
                  </button>
                </div>
                <p className="font-poppins text-[#64835b]/70" style={{ fontSize: "var(--text-fluid-xs)" }}>
                  Deixe em branco para manter a senha atual.
                </p>
              </div>
            ) : null}

            {error ? (
              <p
                role="alert"
                className="font-poppins text-center font-medium text-[#c0392b]"
                style={{ fontSize: "var(--text-fluid-xs)" }}
              >
                {error}
              </p>
            ) : null}

            <ModalActions
              onCancel={onClose}
              saving={saving}
              saveLabel={saving ? "Salvando..." : "Salvar"}
              saveType="submit"
            />
          </form>
        ) : (
          <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-4)" }}>
            <div className="flex justify-center">
              <Avatar
                name={name}
                avatarUrl={pendingAvatar}
                className="border-4 border-white shadow-[0_8px_20px_rgba(31,43,36,0.18)]"
                style={{ height: "6rem", width: "6rem" }}
                textStyle={{ fontSize: "var(--text-fluid-2xl)" }}
              />
            </div>

            <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-2)" }}>
              <p
                className="font-poppins font-semibold text-[#64835b]"
                style={{ fontSize: "var(--text-fluid-sm)" }}
              >
                Selecionar:
              </p>
              <div className="grid grid-cols-5" style={{ gap: "var(--spacing-fluid-2)" }}>
                {AVATARS.map((option) => {
                  const selected = option === pendingAvatar;
                  return (
                    <button
                      key={option}
                      type="button"
                      onClick={() => setPendingAvatar(option)}
                      aria-label="Selecionar avatar"
                      aria-pressed={selected}
                      className={`flex items-center justify-center rounded-[16px] border-2 bg-white p-1 transition active:scale-95 ${
                        selected
                          ? "border-[#418964] ring-2 ring-[#418964]/25"
                          : "border-[#e2e6df] hover:border-[#418964]/50"
                      }`}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={option}
                        alt=""
                        className="aspect-square w-full rounded-[12px] bg-[#fdf3df] object-cover"
                      />
                    </button>
                  );
                })}

                {/* Opção "sem foto" — usa as iniciais (como no cadastro). */}
                <button
                  type="button"
                  onClick={() => setPendingAvatar("")}
                  aria-label="Sem foto de perfil"
                  aria-pressed={!pendingAvatar}
                  className={`flex aspect-square items-center justify-center rounded-[16px] border-2 bg-[#f3f6f1] text-[#64835b] transition active:scale-95 ${
                    !pendingAvatar
                      ? "border-[#418964] ring-2 ring-[#418964]/25"
                      : "border-[#e2e6df] hover:border-[#418964]/50"
                  }`}
                >
                  <i
                    aria-hidden="true"
                    className="pi pi-ban"
                    style={{ fontSize: "var(--text-fluid-lg)" }}
                  />
                </button>
              </div>
            </div>

            <ModalActions
              onCancel={() => setView("form")}
              saving={false}
              saveLabel="Salvar"
              saveType="button"
              onSave={confirmAvatar}
            />
          </div>
        )}
      </div>
    </div>
  );
}

function ModalActions({
  onCancel,
  onSave,
  saving,
  saveLabel,
  saveType,
}: {
  onCancel: () => void;
  onSave?: () => void;
  saving: boolean;
  saveLabel: string;
  saveType: "submit" | "button";
}) {
  return (
    <div
      className="flex justify-center"
      style={{ gap: "var(--spacing-fluid-3)", marginTop: "var(--spacing-fluid-1)" }}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={saving}
        className="font-poppins flex items-center justify-center rounded-[30px] bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3] disabled:opacity-60"
        style={{
          minWidth: "7rem",
          height: "var(--height-control-md)",
          fontSize: "var(--text-fluid-sm)",
        }}
      >
        Cancelar
      </button>
      <button
        type={saveType}
        onClick={onSave}
        disabled={saving}
        className="font-poppins flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] disabled:opacity-60"
        style={{
          minWidth: "7rem",
          height: "var(--height-control-md)",
          fontSize: "var(--text-fluid-sm)",
        }}
      >
        {saveLabel}
      </button>
    </div>
  );
}
