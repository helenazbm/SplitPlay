"use client";

import { useState } from "react";

import MoneyInput from "@/components/MoneyInput";

/** Converte "12,50" / "12.50" em número (>= 0). */
function parseAmount(value: string): number {
  const normalized = value.replace(/\s/g, "").replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

type FixedPricesModalProps = {
  title: string;
  confirmLabel?: string;
  /** Valores iniciais (reais e %). */
  couvert?: number;
  tipPercent?: number;
  saving?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: (values: {
    couvertSuggested: number;
    tipPercent: number;
  }) => void;
};

/**
 * Modal de preços fixos da mesa (couvert artístico + gorjeta sugerida). Usado na
 * criação da mesa e na edição pelo admin. Tudo é opcional — pode deixar em
 * branco e editar depois.
 */
export default function FixedPricesModal({
  title,
  confirmLabel = "Confirmar",
  couvert: initialCouvert = 0,
  tipPercent: initialTipPercent = 0,
  saving = false,
  error,
  onCancel,
  onConfirm,
}: FixedPricesModalProps) {
  const [couvert, setCouvert] = useState(initialCouvert);
  const [tipPercent, setTipPercent] = useState(
    initialTipPercent > 0 ? String(initialTipPercent).replace(".", ",") : "",
  );

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[420px] items-center justify-center"
      style={{ padding: "var(--spacing-fluid-5)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={() => {
          if (!saving) {
            onCancel();
          }
        }}
        className="absolute inset-0 bg-[#1f2b24]/40"
      />

      <div
        className="relative flex max-h-full w-full flex-col overflow-y-auto rounded-[10px_10px_25px_10px] bg-white shadow-[0_20px_50px_rgba(31,43,36,0.25)]"
        style={{
          padding: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-3)",
        }}
      >
        <h3
          className="font-poppins font-black text-center text-[#e5786c]"
          style={{ fontSize: "20px" }}
        >
          {title}
        </h3>

        <p
          className="font-poppins font-semibold text-[#418964]"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Valores:
        </p>

        <label
          className="grid gap-1 font-poppins text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          Couvert Artístico
          <MoneyInput
            value={couvert}
            onChange={setCouvert}
            placeholder="0,00"
            className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
          />
        </label>

        <label
          className="grid gap-1 font-poppins text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          Porcentagem do Garçom (%)
          <input
            inputMode="decimal"
            value={tipPercent}
            onChange={(event) => setTipPercent(event.target.value)}
            placeholder="10"
            className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
          />
        </label>

        <p
          className="font-poppins text-[#9bb0a4]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          Opcional — deixe em branco se não quiser cobrar. Você poderá editar
          esses valores depois.
        </p>

        {error ? (
          <p
            className="font-poppins text-center text-[#c0392b]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            {error}
          </p>
        ) : null}

        <div
          className="flex items-center justify-center"
          style={{ gap: "var(--spacing-fluid-2)" }}
        >
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="font-poppins flex items-center justify-center rounded-[30px] bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3] disabled:opacity-60"
            style={{
              width: "105px",
              height: "28px",
              fontSize: "var(--text-fluid-sm)",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() =>
              onConfirm({
                couvertSuggested: couvert,
                tipPercent: parseAmount(tipPercent),
              })
            }
            disabled={saving}
            className="font-poppins flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] disabled:opacity-60"
            style={{
              width: "105px",
              height: "28px",
              fontSize: "var(--text-fluid-sm)",
            }}
          >
            {saving ? "Salvando..." : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
