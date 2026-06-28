"use client";

import type { CSSProperties, ReactNode } from "react";

export type ComandaCardSize = "sm" | "lg";

const COMANDA_BG: Record<ComandaCardSize, string> = {
  sm: "/comanda-sm.svg", // 370×161 — resumos curtos (ex.: Comanda #NN)
  lg: "/comanda-lg.svg", // 370×580 — comandas/recibos maiores
};

// Proporção nativa de cada SVG: usar isso evita esticar o serrilhado.
const COMANDA_ASPECT: Record<ComandaCardSize, string> = {
  sm: "370 / 161",
  lg: "370 / 580",
};

type ComandaCardProps = {
  /** "sm" para resumos curtos, "lg" para recibos maiores. */
  size?: ComandaCardSize;
  className?: string;
  style?: CSSProperties;
  children?: ReactNode;
};

/**
 * Cartão estilo comanda (recibo) com a borda inferior serrilhada — usa os SVGs
 * de fundo creme. O cartão mantém a PROPORÇÃO nativa do SVG (aspect-ratio) para
 * o recorte não distorcer. Reutilizável em todo o sistema.
 */
export default function ComandaCard({
  size = "sm",
  className = "",
  style,
  children,
}: ComandaCardProps) {
  return (
    <div
      className={`relative ${className}`}
      style={{
        aspectRatio: COMANDA_ASPECT[size],
        backgroundImage: `url("${COMANDA_BG[size]}")`,
        backgroundSize: "100% 100%",
        backgroundRepeat: "no-repeat",
        ...style,
      }}
    >
      {children}
    </div>
  );
}
