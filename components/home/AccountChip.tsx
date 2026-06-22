"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import Link from "next/link";

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export default function AccountChip() {
  const { user, loading } = useAuth();

  if (loading || !user) {
    return null;
  }

  const displayName = user.displayName?.trim() || "Jogador";

  return (
    <Link
      href="/inicio"
      aria-label="Ir para minha conta"
      title="Minha conta"
      className="sp-rise font-poppins absolute left-[var(--spacing-fluid-4)] top-[var(--spacing-fluid-5)] z-20 flex items-center justify-center rounded-full border-2 border-white bg-[#cde9da] font-bold text-[#418964] shadow-sm transition hover:bg-white active:scale-95"
      style={{
        height: "2.75rem",
        width: "2.75rem",
        fontSize: "var(--text-fluid-sm)",
      }}
    >
      {getInitials(displayName)}
    </Link>
  );
}
