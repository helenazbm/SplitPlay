"use client";

import { signOut } from "@/lib/services/authService";
import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Botão de sair, fixo no AppHeader de todas as telas internas.
 */
export default function LogoutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await signOut();
      router.replace("/");
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignOut()}
      disabled={signingOut}
      aria-label="Sair da conta"
      title="Sair da conta"
      className="flex shrink-0 items-center justify-center rounded-full bg-white/15 text-white transition hover:bg-white/25 active:scale-95 disabled:opacity-60"
      style={{ height: "2.25rem", width: "2.25rem" }}
    >
      <i
        aria-hidden="true"
        className={`pi ${signingOut ? "pi-spin pi-spinner" : "pi-sign-out"}`}
        style={{ fontSize: "var(--text-fluid-base)" }}
      />
    </button>
  );
}
