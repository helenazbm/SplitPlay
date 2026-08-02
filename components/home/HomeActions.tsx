"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import Link from "next/link";

const PRIMARY_BUTTON =
  "flex w-full max-w-[min(16.25rem,72cqi)] items-center justify-center rounded-[10px_10px_25px_10px] bg-white leading-none text-[#64835b] shadow-sm transition hover:bg-[#fffbf0] focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-2 focus:ring-offset-[#418964]";

/**
 * Ações da home. Se o usuário já está logado, "Criar uma mesa" vai direto para
 * /mesa/criar (sem passar pelo login) e o "Criar conta" some.
 */
export default function HomeActions() {
  const { user } = useAuth();
  const criarMesaHref = user ? "/mesa/criar" : "/login?redirect=/mesa/criar";

  return (
    <nav
      className="font-acme flex w-full flex-col items-center"
      style={{
        marginTop: "var(--spacing-fluid-7)",
        gap: "var(--spacing-fluid-3)",
      }}
    >
      <Link
        href="/mesa/entrar"
        className={PRIMARY_BUTTON}
        style={{
          height: "var(--height-control-lg)",
          fontSize: "var(--text-fluid-lg)",
        }}
      >
        Entrar em uma mesa
      </Link>

      <Link 
        data-cy="criarmesa" 
        href={criarMesaHref}
        className={PRIMARY_BUTTON}
        style={{
          height: "var(--height-control-lg)",
          fontSize: "var(--text-fluid-lg)",
        }}
      >
        Criar uma mesa
      </Link>

      {!user ? (
        <Link
          data-cy="criarconta"
          href="/signup"
          className="border-b border-white leading-tight text-white transition hover:text-[#fffbf0] focus:outline-none focus:ring-2 focus:ring-white/80 focus:ring-offset-4 focus:ring-offset-[#418964]"
          style={{
            marginTop: "var(--spacing-fluid-1)",
            fontSize: "var(--text-fluid-base)",
          }}
        >
          Criar conta
        </Link>
      ) : null}
    </nav>
  );
}
