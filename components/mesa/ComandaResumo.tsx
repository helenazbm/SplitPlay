"use client";

import type { CSSProperties, SVGProps } from "react";

import ComandaCard from "./ComandaCard";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const DASHED_DIVIDER: CSSProperties = {
  borderBottom: "1.5px dashed #cdd5cd",
  paddingBottom: "var(--spacing-fluid-2)",
};

function ForkKnifeIcon(props: SVGProps<SVGSVGElement>) {
  // mdi:local-restaurant — garfo e faca cruzados.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 0 0 0 5.66zm6.78-1.81c1.53.71 3.68.21 5.27-1.38c1.91-1.91 2.28-4.65.81-6.12c-1.46-1.46-4.2-1.1-6.12.81c-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88l1.41-1.41l-6.88-6.88z" />
    </svg>
  );
}

type ComandaResumoProps = {
  numero?: number;
  itemCount: number;
  totalReais: number;
  paidReais?: number;
};

/**
 * Card "Comanda #NN": resumo dos itens consumidos e total da parte do usuário,
 * no estilo recibo (ComandaCard). Layout fiel à tela "Itens - não adm".
 */
export default function ComandaResumo({
  numero = 1,
  itemCount,
  totalReais,
  paidReais = 0,
}: ComandaResumoProps) {
  return (
    <ComandaCard
      size="sm"
      className="flex flex-col justify-center"
      style={{
        borderTopLeftRadius: "10px",
        borderTopRightRadius: "10px",
        overflow: "hidden",
        paddingInline: "var(--spacing-fluid-5)",
        paddingTop: "var(--spacing-fluid-3)",
        // espaço extra embaixo: deixa os divisores acima do recorte serrilhado.
        paddingBottom: "var(--spacing-fluid-5)",
        gap: "var(--spacing-fluid-3)",
      }}
    >
      <h2
        className="font-poppins text-center font-black text-[#519472]"
        style={{ fontSize: "20px" }}
      >
        Comanda #{String(numero).padStart(2, "0")}
      </h2>

      <div className="grid grid-cols-2" style={{ columnGap: "var(--spacing-fluid-4)" }}>
        <div
          className="flex flex-col items-center"
          style={{ gap: "var(--spacing-fluid-2)", ...DASHED_DIVIDER }}
        >
          <span
            className="font-poppins font-semibold text-[#8a948c]"
            style={{ fontSize: "var(--text-fluid-sm)" }}
          >
            Itens Consumidos
          </span>
          <span
            className="font-poppins flex items-center font-semibold text-[#3f4a43]"
            style={{ gap: "var(--spacing-fluid-2)", fontSize: "var(--text-fluid-sm)" }}
          >
            <ForkKnifeIcon style={{ height: "1.1rem", width: "1.1rem" }} />
            {itemCount}
          </span>
        </div>

        <div
          className="flex flex-col items-center"
          style={{ gap: "var(--spacing-fluid-2)", ...DASHED_DIVIDER }}
        >
          <span
            className="font-poppins font-semibold text-[#8a948c]"
            style={{ fontSize: "var(--text-fluid-sm)" }}
          >
            Total Gasto
          </span>
          <span
            className="font-poppins flex items-center font-bold text-[#e5786c]"
            style={{ gap: "var(--spacing-fluid-2)", fontSize: "var(--text-fluid-sm)" }}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/avatars/moeda-icon.svg"
              alt=""
              aria-hidden="true"
              className="object-contain"
              style={{ height: "1.2rem", width: "1.2rem" }}
            />
            {brl.format(totalReais)}
          </span>
        </div>
      </div>

      {paidReais > 0 ? (
        <div
          className="flex items-center justify-center"
          style={{ gap: "var(--spacing-fluid-2)" }}
        >
          <span
            className="font-poppins font-semibold text-[#8a948c]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            Já pago nesta mesa
          </span>
          <span
            className="font-poppins font-bold text-[#5B9A7A]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            {brl.format(paidReais)}
          </span>
        </div>
      ) : null}
    </ComandaCard>
  );
}
