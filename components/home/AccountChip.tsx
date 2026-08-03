"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { resolveAvatar } from "@/lib/avatars";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

type AccountChipProps = {
  variant?: "floating" | "inline";
};

function getInitials(name: string) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

export default function AccountChip({ variant = "floating" }: AccountChipProps) {
  const { user, loading } = useAuth();
  const [imageError, setImageError] = useState(false);

  if (loading || !user) {
    return null;
  }

  const displayName = user.displayName?.trim() || "Jogador";
  const hasPhoto = Boolean(user.photoURL && user.photoURL.trim());
  const avatarSrc = resolveAvatar(user.photoURL);

  const chipClassName =
    variant === "floating"
      ? "sp-rise font-poppins absolute right-[var(--spacing-fluid-4)] top-[var(--spacing-fluid-5)] z-20 flex items-center justify-center rounded-full border-2 border-white bg-[#cde9da] font-bold text-[#418964] shadow-sm transition hover:bg-white active:scale-95"
      : "font-poppins flex items-center justify-center rounded-full border-2 border-white bg-[#cde9da] font-bold text-[#418964] shadow-sm transition hover:bg-white active:scale-95";

  return (
    <Link
      data-cy="perfil"
      href="/perfil"
      aria-label="Ir para o meu perfil"
      title="Minha conta"
      className={chipClassName}
      style={{
        height: "2.75rem",
        width: "2.75rem",
        fontSize: "var(--text-fluid-sm)",
      }}
    >
      {!hasPhoto || imageError ? (
        getInitials(displayName)
      ) : (
        <Image
          src={avatarSrc}
          alt={`Avatar de ${displayName}`}
          width={44}
          height={44}
          className="h-full w-full rounded-full object-cover"
          onError={() => setImageError(true)}
        />
      )}
    </Link>
  );
}
