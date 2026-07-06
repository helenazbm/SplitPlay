"use client";

import type { CSSProperties } from "react";

import { resolveAvatar } from "@/lib/avatars";

function getInitials(name: string) {
  const initials = (name ?? "")
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
  return initials || "?";
}

type AvatarProps = {
  name?: string | null;
  /** URL/caminho do avatar. Vazio/null → renderiza as iniciais do nome. */
  avatarUrl?: string | null;
  /** Classes do círculo (tamanho, borda, sombra). */
  className?: string;
  style?: CSSProperties;
  /** Estilo das iniciais (ex.: fontSize). */
  textStyle?: CSSProperties;
};

/**
 * Avatar do usuário: mostra a foto quando há `avatarUrl`; caso contrário,
 * um círculo verde com as iniciais do nome. Centraliza a regra para todo o app.
 */
export default function Avatar({
  name,
  avatarUrl,
  className = "",
  style,
  textStyle,
}: AvatarProps) {
  const hasPhoto = Boolean(avatarUrl && avatarUrl.trim());

  return (
    <span
      aria-hidden="true"
      className={`relative flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#418964] font-poppins font-semibold text-white ${className}`}
      style={style}
    >
      {hasPhoto ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolveAvatar(avatarUrl)}
          alt=""
          className="h-full w-full object-cover"
        />
      ) : (
        <span style={textStyle}>{getInitials(name ?? "")}</span>
      )}
    </span>
  );
}
