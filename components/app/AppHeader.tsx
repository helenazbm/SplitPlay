import LogoutButton from "@/components/app/LogoutButton";
import Image from "next/image";
import type { ReactNode } from "react";

type AppHeaderProps = {
  title: string;
  subtitle?: ReactNode;
  right?: ReactNode;
};

/**
 * Cabeçalho padrão das telas internas do app (Início, Mesa, Perfil):
 * faixa verde com logo, título em Bagel e linha de apoio opcional.
 */
export default function AppHeader({ title, subtitle, right }: AppHeaderProps) {
  return (
    <header
      className="relative z-10 shrink-0 bg-[#418964]"
      style={{
        paddingInline: "var(--spacing-fluid-5)",
        paddingTop: "calc(var(--spacing-fluid-6) + env(safe-area-inset-top))",
        paddingBottom: "var(--spacing-fluid-5)",
      }}
    >
      <div
        className="flex items-center justify-between"
        style={{ gap: "var(--spacing-fluid-3)" }}
      >
        <Image
          src="/logo.svg"
          alt="SplitPlay"
          width={207}
          height={49}
          priority
          className="h-auto w-[38%] max-w-[9rem]"
        />
        <div
          className="flex shrink-0 items-center"
          style={{ gap: "var(--spacing-fluid-2)" }}
        >
          {right}
          <LogoutButton />
        </div>
      </div>

      <div className="min-w-0" style={{ marginTop: "var(--spacing-fluid-4)" }}>
        <h1
          className="font-bagel truncate leading-tight text-white"
          style={{ fontSize: "var(--text-fluid-2xl)" }}
        >
          {title}
        </h1>
        {subtitle ? (
          <div
            className="font-poppins text-white/85"
            style={{
              marginTop: "var(--spacing-fluid-1)",
              fontSize: "var(--text-fluid-xs)",
            }}
          >
            {subtitle}
          </div>
        ) : null}
      </div>
    </header>
  );
}
