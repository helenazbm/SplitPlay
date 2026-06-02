"use client";

import AuthField from "@/components/AuthField";
import { useState } from "react";

type MesaAdminTabProps = {
  tableName: string;
};

export default function MesaAdminTab({ tableName }: MesaAdminTabProps) {
  const [couvert, setCouvert] = useState("");
  const [tipSuggested, setTipSuggested] = useState(true);
  const [saved, setSaved] = useState(false);

  function handleSave() {
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--spacing-fluid-4)" }}
      role="tabpanel"
    >
      <div>
        <h2
          className="font-bagel text-[#418964]"
          style={{ fontSize: "var(--text-fluid-lg)" }}
        >
          Configurações
        </h2>
        <p
          className="font-poppins text-[#64835b]"
          style={{
            marginTop: "var(--spacing-fluid-1)",
            fontSize: "var(--text-fluid-xs)",
          }}
        >
          Ajustes da mesa &quot;{tableName}&quot; visíveis para novos
          participantes.
        </p>
      </div>

      <AuthField
        label="Couvert artístico sugerido"
        name="couvert"
        type="text"
        inputMode="decimal"
        autoComplete="off"
        value={couvert}
        onChange={(event) => setCouvert(event.target.value)}
        placeholder="0,00"
        icon={<i aria-hidden="true" className="pi pi-ticket" />}
      />

      <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-2)" }}>
        <span
          className="font-poppins text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          10% do garçom
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={tipSuggested}
          onClick={() => setTipSuggested((value) => !value)}
          style={{
            height: "var(--height-control-md)",
            paddingInline: "var(--spacing-fluid-4)",
            fontSize: "var(--text-fluid-sm)",
          }}
          className={`font-poppins flex w-full items-center justify-between rounded-[10px_10px_25px_10px] border border-[#418964] transition ${
            tipSuggested ? "bg-[#cde9da]" : "bg-white"
          }`}
        >
          <span className="text-[#64835b]">Sugerir gorjeta de 10%</span>
          <span
            className={`inline-flex items-center justify-center rounded-full font-semibold ${
              tipSuggested
                ? "bg-[#418964] text-white"
                : "bg-[#b1c1ad]/30 text-[#64835b]"
            }`}
            style={{
              height: "1.75rem",
              width: "3.25rem",
            }}
          >
            {tipSuggested ? "Sim" : "Não"}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={handleSave}
        className="font-poppins flex items-center justify-center rounded-[30px] bg-[#418964] font-semibold text-white transition hover:bg-[#367050]"
        style={{
          height: "var(--height-control-md)",
          fontSize: "var(--text-fluid-base)",
          gap: "var(--spacing-fluid-2)",
        }}
      >
        <i aria-hidden="true" className={`pi ${saved ? "pi-check" : "pi-save"}`} />
        {saved ? "Salvo!" : "Salvar configurações"}
      </button>
    </div>
  );
}
