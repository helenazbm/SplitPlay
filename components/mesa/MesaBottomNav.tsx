"use client";

import { useEffect, useRef, type SVGProps } from "react";

export type MesaTabId = "itens" | "mesa" | "pagamento";

function ItensIcon(props: SVGProps<SVGSVGElement>) {
  // Material "local_restaurant" — garfo e colher cruzados.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 0 0 0 5.66zm6.78-1.81c1.53.71 3.68.21 5.27-1.38c1.91-1.91 2.28-4.65.81-6.12c-1.46-1.46-4.2-1.1-6.12.81c-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88l1.41-1.41l-6.88-6.88z" />
    </svg>
  );
}

function MesaIcon(props: SVGProps<SVGSVGElement>) {
  // Material "groups" — grupo de pessoas.
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M12 12.75c1.63 0 3.07.39 4.24.9c1.08.48 1.76 1.56 1.76 2.73V18H6v-1.61c0-1.18.68-2.26 1.76-2.73c1.17-.52 2.61-.91 4.24-.91M4 13c1.1 0 2-.9 2-2s-.9-2-2-2s-2 .9-2 2s.9 2 2 2m1.13 1.1c-.37-.06-.74-.1-1.13-.1c-.99 0-1.93.21-2.78.58A2.01 2.01 0 0 0 0 16.43V18h4.5v-1.61c0-.83.23-1.61.63-2.29M20 13c1.1 0 2-.9 2-2s-.9-2-2-2s-2 .9-2 2s.9 2 2 2m4 3.43c0-.81-.48-1.53-1.22-1.85A6.95 6.95 0 0 0 20 14c-.39 0-.76.04-1.13.1c.4.68.63 1.46.63 2.29V18H24zM12 6c1.66 0 3 1.34 3 3s-1.34 3-3 3s-3-1.34-3-3s1.34-3 3-3" />
    </svg>
  );
}

function PagamentoIcon(props: SVGProps<SVGSVGElement>) {
  // Recibo com cifrão.
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" {...props}>
      <path
        fill="currentColor"
        d="M5 3h14v17l-2 1.2l-2-1.2l-2 1.2l-2-1.2l-2 1.2l-2-1.2V3z"
      />
      <text
        x="12"
        y="14.5"
        textAnchor="middle"
        fontSize="10"
        fontWeight="700"
        fontFamily="sans-serif"
        fill="#fff"
      >
        $
      </text>
    </svg>
  );
}

const TABS: {
  id: MesaTabId;
  label: string;
  Icon: (props: SVGProps<SVGSVGElement>) => React.ReactElement;
}[] = [
  { id: "itens", label: "Itens", Icon: ItensIcon },
  { id: "mesa", label: "Mesa", Icon: MesaIcon },
  { id: "pagamento", label: "Pagamento", Icon: PagamentoIcon },
];

type MesaBottomNavProps = {
  activeTab: MesaTabId;
  onChange: (tab: MesaTabId) => void;
};

/**
 * Navbar inferior exibido dentro de uma mesa. Mostra três seções
 * (Itens, Mesa, Pagamento). O item ativo ganha uma linha verde no topo e
 * exibe ícone + nome em verde; os inativos mostram só o ícone em cinza.
 */
export default function MesaBottomNav({
  activeTab,
  onChange,
}: MesaBottomNavProps) {
  const navRef = useRef<HTMLElement>(null);

  // Publica a altura real para que a tela reserve exatamente esse espaço.
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;

    const updateHeight = () => {
      document.documentElement.style.setProperty(
        "--bottom-nav-height",
        `${el.offsetHeight}px`,
      );
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);

    return () => observer.disconnect();
  }, []);

  return (
    <nav
      ref={navRef}
      role="tablist"
      aria-label="Seções da mesa"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto flex w-full max-w-[420px] items-start justify-between bg-white"
      style={{
        paddingTop: "12px",
        paddingInline: "24px",
        paddingBottom: "calc(6px + env(safe-area-inset-bottom))",
        boxShadow: "0 -4px 20px rgba(31,43,36,0.08)",
      }}
    >
      {TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        const Icon = tab.Icon;

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            aria-label={tab.label}
            onClick={() => onChange(tab.id)}
            className="font-poppins flex flex-col items-center transition active:scale-95"
            style={{ gap: "8px" }}
          >
            <span
              aria-hidden="true"
              className="rounded-full"
              style={{
                height: "3px",
                width: "2.25rem",
                background: isActive ? "#519472" : "transparent",
              }}
            />
            <span
              className="flex items-center"
              style={{
                gap: "6px",
                color: isActive ? "#519472" : "#484c52",
              }}
            >
              <Icon style={{ height: "1.5rem", width: "1.5rem" }} />
              {isActive ? (
                <span
                  className="font-semibold"
                  style={{ fontSize: "0.9375rem", lineHeight: "1.25rem" }}
                >
                  {tab.label}
                </span>
              ) : null}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
