"use client";

import Link from "next/link";

type AlreadyInTableModalProps = {
  activeTableId: string;
  description: string;
  secondaryLabel: string;
  onSecondary: () => void;
};

export default function AlreadyInTableModal({
  activeTableId,
  description,
  secondaryLabel,
  onSecondary,
}: AlreadyInTableModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="active-table-title"
    >
      <div
        className="w-full max-w-sm rounded-[20px] bg-white shadow-xl"
        style={{
          padding: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-4)",
        }}
      >
        <h2
          id="active-table-title"
          className="font-bagel text-center text-[#418964]"
          style={{ fontSize: "var(--text-fluid-xl)" }}
        >
          Você já está em uma mesa
        </h2>
        <p
          className="font-poppins text-center text-[#64835b]"
          style={{
            marginTop: "var(--spacing-fluid-3)",
            fontSize: "var(--text-fluid-sm)",
          }}
        >
          {description}
        </p>
        <div
          className="flex flex-col"
          style={{
            marginTop: "var(--spacing-fluid-4)",
            gap: "var(--spacing-fluid-2)",
          }}
        >
          <Link
            href={`/mesa/${activeTableId}/painel`}
            className="font-poppins flex items-center justify-center rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050]"
            style={{
              height: "var(--height-control-md)",
              fontSize: "var(--text-fluid-base)",
            }}
          >
            Ir para mesa atual
          </Link>
          <button
            type="button"
            onClick={onSecondary}
            className="font-poppins text-[#64835b] underline underline-offset-4"
            style={{ fontSize: "var(--text-fluid-sm)" }}
          >
            {secondaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
