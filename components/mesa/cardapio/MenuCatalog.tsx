"use client";

import { useMemo, useState, type ReactNode } from "react";

import { foodIconSrc } from "@/lib/foodIcons";
import { groupMenu, guessMenuItemIcon, menuSectionTitles } from "@/lib/menu/menuView";
import type { MenuItemWithId } from "@/lib/types/menu";

export const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

type MenuCatalogProps = {
  items: MenuItemWithId[];
  renderItem: (item: MenuItemWithId) => ReactNode;
  /** Mostrado quando o cardápio não tem item nenhum (antes de buscar). */
  empty?: ReactNode;
};

/**
 * Busca + chips de seção + lista agrupada por seção. A mesma estrutura serve
 * para pedir, editar e revisar o cardápio — só o card de cada item muda.
 */
export default function MenuCatalog({ items, renderItem, empty = null }: MenuCatalogProps) {
  const [search, setSearch] = useState("");
  const [section, setSection] = useState<string | null>(null);

  const sectionTitles = useMemo(() => menuSectionTitles(items), [items]);
  // Seção escolhida pode sumir (último item dela excluído): volta para "Todos".
  const activeSection = section && sectionTitles.includes(section) ? section : null;
  const groups = useMemo(
    () => groupMenu(items, { search, section: activeSection }),
    [items, search, activeSection],
  );

  if (items.length === 0) {
    return <>{empty}</>;
  }

  return (
    <div className="flex flex-col" style={{ gap: "10px" }}>
      <label className="relative block">
        <span className="sr-only">Buscar no cardápio</span>
        <i
          aria-hidden="true"
          className="pi pi-search pointer-events-none absolute top-1/2 -translate-y-1/2 text-[#519472]"
          style={{ left: "16px", fontSize: "1.05rem" }}
        />
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar no cardápio"
          className="font-poppins w-full rounded-full border-[0.5px] border-[#519472] bg-[#f9f9f9] font-medium text-[#418964] outline-none placeholder:text-[#5b9a7a] focus:border-[#418964] focus:ring-2 focus:ring-[#519472]/25"
          style={{ height: "40px", paddingLeft: "44px", paddingRight: "16px", fontSize: "12px" }}
        />
      </label>

      {sectionTitles.length > 1 ? (
        <div
          className="-mx-1 flex overflow-x-auto px-1"
          style={{ gap: "8px", paddingBottom: "2px", scrollbarWidth: "none" }}
          role="group"
          aria-label="Filtrar por seção"
        >
          {[null, ...sectionTitles].map((title) => {
            const active = activeSection === title;
            return (
              <button
                key={title ?? "__todos"}
                type="button"
                aria-pressed={active}
                onClick={() => setSection(title)}
                className={`font-poppins shrink-0 rounded-full border-[0.5px] border-[#519472] font-medium transition ${
                  active ? "bg-[#519472] text-[#f2f1f1]" : "text-[#519472] hover:bg-[#519472]/10"
                }`}
                style={{ height: "25px", paddingInline: "12px", fontSize: "12px" }}
              >
                {title ?? "Todos"}
              </button>
            );
          })}
        </div>
      ) : null}

      {groups.length === 0 ? (
        <p
          className="font-poppins text-center text-[#8f8f8f]"
          style={{ fontSize: "var(--text-fluid-sm)", paddingBlock: "var(--spacing-fluid-5)" }}
        >
          Nada encontrado para “{search.trim()}”.
        </p>
      ) : (
        groups.map((group) => (
          <section key={group.title} className="flex flex-col" style={{ gap: "8px" }}>
            <h3
              className="font-poppins font-black text-[#da8280]"
              style={{ fontSize: "20px", marginTop: "14px" }}
            >
              {group.title}
            </h3>
            {group.items.map((item) => (
              <div key={item.id}>{renderItem(item)}</div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}

/** Ícone de comida adivinhado pelo nome/seção do item (Icons8, como na comanda). */
export function MenuItemIcon({
  item,
  size = 31,
}: {
  item: Pick<MenuItemWithId, "name" | "section">;
  size?: number;
}) {
  const src = foodIconSrc(guessMenuItemIcon(item));

  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center"
      style={{ height: `${size}px`, width: `${size}px` }}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-contain" />
      ) : (
        <i className="pi pi-shopping-bag text-[#e5786c]" style={{ fontSize: `${size * 0.6}px` }} />
      )}
    </span>
  );
}

/** Pílula branca de contorno verde usada nas ações dos cards ("+", lápis, stepper). */
export function PillButton({
  children,
  label,
  onClick,
  disabled = false,
  filled = false,
}: {
  children: ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  filled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className={`font-poppins flex shrink-0 items-center justify-center rounded-[30px] border-[0.5px] border-[#67a184] transition disabled:opacity-50 ${
        filled
          ? "bg-[#5f9c7d] text-[#f2f1f1] hover:bg-[#518b6e]"
          : "bg-white text-[#5f9c7d] hover:bg-[#eaf6ef]"
      }`}
      style={{ minWidth: "40px", height: "22px", paddingInline: "10px", gap: "4px" }}
    >
      {children}
    </button>
  );
}
