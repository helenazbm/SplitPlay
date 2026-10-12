"use client";

import { useEffect, type ReactNode } from "react";

type MenuSheetProps = {
  title: string;
  /** Linha abaixo do título (ex.: nome do cardápio lido da foto). */
  subtitle?: string | null;
  /** Botão à direita do título (ex.: "Editar"). */
  headerAction?: ReactNode;
  /** Ações fixas no rodapé (botões "Adicionar na comanda" etc.). */
  footer?: ReactNode;
  onClose: () => void;
  children: ReactNode;
};

/**
 * Bottom sheet das telas de cardápio (Figma "P2 - Cardápio"): fundo escurecido
 * sobre a mesa, folha #F2F1F1 com cantos de 30px e alça cinza no topo. O
 * conteúdo rola; o rodapé fica preso embaixo.
 */
export default function MenuSheet({
  title,
  subtitle = null,
  headerAction = null,
  footer = null,
  onClose,
  children,
}: MenuSheetProps) {
  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[420px] flex-col justify-end"
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="sp-fade-in absolute inset-0 bg-[rgba(27,31,34,0.8)]"
      />

      <div
        className="sp-sheet-up relative flex w-full flex-col rounded-t-[30px] bg-[#f2f1f1]"
        style={{
          height: "min(75dvh, 656px)",
          paddingBottom: "calc(var(--spacing-fluid-4) + env(safe-area-inset-bottom))",
        }}
      >
        <span
          aria-hidden="true"
          className="mx-auto block shrink-0 rounded-full bg-[#c5bebe]"
          style={{ width: "70px", height: "6px", marginTop: "16px" }}
        />

        <header
          className="flex shrink-0 items-center justify-between"
          style={{
            paddingInline: "36px",
            paddingTop: "var(--spacing-fluid-4)",
            paddingBottom: "10px",
            gap: "var(--spacing-fluid-2)",
          }}
        >
          <div className="min-w-0">
            <h2
              className="font-poppins truncate font-black text-[#da8280]"
              style={{ fontSize: "24px", lineHeight: 1.25 }}
            >
              {title}
            </h2>
            {subtitle ? (
              <p
                className="font-poppins truncate font-medium text-[#8f8f8f]"
                style={{ fontSize: "var(--text-fluid-xs)" }}
              >
                {subtitle}
              </p>
            ) : null}
          </div>
          {headerAction}
        </header>

        <div
          className="min-h-0 flex-1 overflow-y-auto"
          style={{ paddingInline: "36px", paddingTop: "6px", paddingBottom: "4px" }}
        >
          {children}
        </div>

        {footer ? (
          <div
            className="flex shrink-0 flex-col"
            style={{
              paddingInline: "39px",
              paddingTop: "var(--spacing-fluid-3)",
              gap: "var(--spacing-fluid-3)",
            }}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Botão principal do rodapé (verde cheio, 50px). */
export function SheetPrimaryButton({
  children,
  disabled = false,
  onClick,
  dataCy,
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  dataCy?: string;
}) {
  return (
    <button
      type="button"
      data-cy={dataCy}
      onClick={onClick}
      disabled={disabled}
      className="font-poppins flex w-full items-center justify-center rounded-full bg-[#519472] font-semibold text-[#f2f1f1] transition hover:bg-[#478464] active:scale-[0.98] disabled:opacity-50"
      style={{ minHeight: "50px", fontSize: "13px", gap: "0.5rem" }}
    >
      {children}
    </button>
  );
}

/** Botão secundário tracejado ("Não achou? Adicionar item manual"). */
export function SheetDashedButton({
  children,
  onClick,
  disabled = false,
  dataCy,
}: {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
  dataCy?: string;
}) {
  return (
    <button
      type="button"
      data-cy={dataCy}
      onClick={onClick}
      disabled={disabled}
      className="font-poppins flex w-full items-center justify-center rounded-[10px] border border-dashed border-[#418964] font-semibold text-[#418964] transition hover:bg-[#418964]/5 disabled:opacity-50"
      style={{ minHeight: "50px", fontSize: "13px", gap: "0.5rem" }}
    >
      {children}
    </button>
  );
}
