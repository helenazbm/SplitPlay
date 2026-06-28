import AccountChip from "@/components/home/AccountChip";
import LogoutButton from "@/components/app/LogoutButton";
import type { ReactNode } from "react";

type MesaHeaderProps = {
  userName: string;
  code: string;
  right?: ReactNode;
};

/**
 * Cabeçalho da mesa: faixa verde com saudação ao usuário e o código da mesa.
 * Traz um brilho difuso no canto e uma camada sutil para dar profundidade,
 * seguindo o layout do design.
 */
export default function MesaHeader({ userName, code, right }: MesaHeaderProps) {
  return (
    <header
      className="relative z-10 shrink-0 overflow-hidden bg-[#519472]"
      style={{
        paddingInline: "var(--spacing-fluid-5)",
        paddingTop: "calc(var(--spacing-fluid-5) + env(safe-area-inset-top))",
        paddingBottom: "var(--spacing-fluid-6)",
      }}
    >
      {/* Brilho difuso (Ellipse 28) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          top: "-60%",
          right: "-25%",
          height: "16rem",
          width: "16rem",
          background: "#FEFFFF",
          filter: "blur(80px)",
          opacity: 0.22,
        }}
      />
      {/* Camada sutil (Vector) */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute rounded-full"
        style={{
          bottom: "-70%",
          left: "-20%",
          height: "14rem",
          width: "14rem",
          background: "rgba(52, 120, 85, 0.15)",
        }}
      />

      <div className="relative z-10 flex flex-col">

        <div className="min-w-0" style={{ marginTop: "var(--spacing-fluid-4)" }}>
          <div
            className="flex items-center justify-between"
            style={{ gap: "var(--spacing-fluid-2)" }}
          >
            <h1
              className="font-bagel truncate leading-tight text-white"
              style={{ fontSize: "var(--text-fluid-2xl)" }}
            >
              Olá, {userName}!
            </h1>

            <div
              className="shrink-0 flex items-center"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              {right}
              <AccountChip variant="inline" />
            </div>
          </div>

          <p
            className="font-poppins text-white"
            style={{
              marginTop: "var(--spacing-fluid-1)",
              fontSize: "0.7rem",
              lineHeight: "1.1rem",
            }}
          >
            Código da mesa: {code}
          </p>
        </div>
      </div>
    </header>
  );
}
