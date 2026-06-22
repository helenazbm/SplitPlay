"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { getMyActiveTable } from "@/lib/services/tableService";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

const ITEM_BASE =
  "font-poppins flex flex-1 flex-col items-center justify-center gap-1 rounded-[16px] transition active:scale-95";

/**
 * Navbar inferior flutuante das telas internas: Início (mesa ativa),
 * Mesa (mesa atual) e Perfil. Alinhado à largura do app shell (420px).
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [activeTableId, setActiveTableId] = useState<string | null>(null);
  const navRef = useRef<HTMLElement>(null);

  // Publica a altura real (fluida) da navbar para que as telas reservem
  // exatamente esse espaço no rodapé e nada fique por trás dela.
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

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;
    getMyActiveTable()
      .then((result) => {
        if (!cancelled) {
          setActiveTableId(result?.id ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setActiveTableId(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [user, pathname]);

  const items = [
    {
      key: "home",
      label: "Início",
      icon: "pi-home",
      href: "/inicio",
      active: pathname === "/inicio",
    },
    {
      key: "mesa",
      label: "Mesa",
      icon: "pi-receipt",
      href: activeTableId ? `/mesa/${activeTableId}/painel` : "/mesa/entrar",
      active: pathname.startsWith("/mesa"),
    },
    {
      key: "perfil",
      label: "Perfil",
      icon: "pi-user",
      href: "/perfil",
      active: pathname === "/perfil",
    },
  ];

  return (
    <nav
      ref={navRef}
      aria-label="Navegação principal"
      className="fixed inset-x-0 bottom-0 z-40 mx-auto w-full max-w-[420px]"
      style={{
        paddingInline: "var(--spacing-fluid-4)",
        paddingBottom: "calc(var(--spacing-fluid-3) + env(safe-area-inset-bottom))",
      }}
    >
      <div
        className="flex items-stretch justify-around rounded-[24px] border border-[#418964]/10 bg-white shadow-[0_10px_30px_rgba(31,43,36,0.22)]"
        style={{ padding: "var(--spacing-fluid-2)", gap: "var(--spacing-fluid-1)" }}
      >
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`${ITEM_BASE} ${
              item.active
                ? "bg-[#cde9da] text-[#418964]"
                : "text-[#9bb0a4] hover:text-[#418964]"
            }`}
            style={{ paddingBlock: "var(--spacing-fluid-2)" }}
          >
            <i
              aria-hidden="true"
              className={`pi ${item.icon}`}
              style={{ fontSize: "var(--text-fluid-lg)" }}
            />
            <span
              style={{
                fontSize: "0.7rem",
                fontWeight: item.active ? 600 : 400,
              }}
            >
              {item.label}
            </span>
          </Link>
        ))}
      </div>
    </nav>
  );
}
