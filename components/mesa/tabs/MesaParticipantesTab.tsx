"use client";

import { centsToReais } from "@/lib/billing";
import { useState } from "react";
import ParticipantsComandaCard from "../ParticipantsCard";

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export type MesaParticipanteView = {
  uid: string;
  displayName: string;
  isAdmin: boolean;
  paid: boolean;
  subtotalCents?: number;
};

type MesaParticipantesTabProps = {
  participantes?: MesaParticipanteView[];
  currentUserIsAdmin?: boolean;
  onAssignAdmin?: (uid: string) => void | Promise<void>;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function MesaParticipantesTab({
  participantes = [],
  currentUserIsAdmin = false,
  onAssignAdmin,
}: MesaParticipantesTabProps) {
  const pagos = participantes.filter((p) => p.paid).length;

  const [selected, setSelected] = useState<MesaParticipanteView | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canManage = currentUserIsAdmin && Boolean(onAssignAdmin);

  function openModal(participante: MesaParticipanteView) {
    setError(null);
    setSelected(participante);
  }

  function closeModal() {
    if (assigning) return;
    setSelected(null);
    setError(null);
  }

  async function handleAssign() {
    if (!selected || !onAssignAdmin) return;

    setAssigning(true);
    setError(null);
    try {
      await onAssignAdmin(selected.uid);
      setSelected(null);
    } catch {
      setError("Não foi possível atribuir a administração. Tente novamente.");
    } finally {
      setAssigning(false);
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--spacing-fluid-3)" }}
      role="tabpanel"
    >
      <div
        className="flex items-center justify-between"
        style={{ gap: "var(--spacing-fluid-2)" }}
      >
        <h2
          className="font-poppins font-black text-[#E58A85]"
          style={{ fontSize: "20px" }}
        >
          Participantes
        </h2>
        {participantes.length > 0 ? (
          <span
            className="font-poppins rounded-full bg-[#cde9da] px-3 py-1 font-semibold text-[#418964]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            {pagos} de {participantes.length} pagaram
          </span>
        ) : null}
      </div>

      {participantes.length === 0 ? (
        <p
          className="font-poppins text-center text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          Nenhum participante na mesa ainda.
        </p>
      ) : (
        <ul
          className="flex list-none flex-col"
          style={{ gap: "var(--spacing-fluid-2)" }}
        >
          {participantes.map((participante) => {
            const clickable = canManage && !participante.isAdmin;

            return (
              <li key={participante.uid}>
                <ParticipanteRow
                  participante={participante}
                  clickable={clickable}
                  onClick={() => openModal(participante)}
                />
              </li>
            );
          })}
        </ul>
      )}

      {selected ? (
        <div
          className="fixed inset-0 z-50 mx-auto flex w-full max-w-[420px] items-center justify-center"
          style={{ padding: "var(--spacing-fluid-5)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Modificar participante"
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={closeModal}
            className="absolute inset-0 bg-[#1f2b24]/40"
          />

          <div
            className="relative flex w-full flex-col rounded-[10px_10px_25px_10px] bg-white shadow-[0_20px_50px_rgba(31,43,36,0.25)]"
            style={{
              padding: "var(--spacing-fluid-5)",
              gap: "var(--spacing-fluid-4)",
            }}
          >
            <h3
              className="font-poppins font-black text-center text-[#e5786c]"
              style={{ fontSize: "20px" }}
            >
              Modificar Participante
            </h3>

            <p
              className="font-poppins font-semibold text-[#418964]"
              style={{ fontSize: "var(--text-fluid-sm)" }}
            >
              Participante Selecionado:
            </p>

            <div
              className="flex items-center rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-[#fffbf0]"
              style={{
                padding: "var(--spacing-fluid-3)",
                gap: "var(--spacing-fluid-3)",
              }}
            >
              <span
                className="font-poppins flex shrink-0 items-center justify-center rounded-full bg-[#418964] font-semibold text-white"
                style={{
                  height: "2.5rem",
                  width: "2.5rem",
                  fontSize: "var(--text-fluid-xs)",
                }}
              >
                {getInitials(selected.displayName)}
              </span>
              <div className="min-w-0">
                <p
                  className="font-poppins truncate font-semibold text-[#5B9A7A]"
                  style={{ fontSize: "var(--text-fluid-sm)" }}
                >
                  {selected.displayName}
                </p>
                <p
                  className="font-poppins text-[#64835b]"
                  style={{ fontSize: "var(--text-fluid-xs)" }}
                >
                  {selected.isAdmin ? "Administrador" : "Participante"}
                </p>
              </div>
            </div>

            {error ? (
              <p
                className="font-poppins text-center text-[#c0392b]"
                style={{ fontSize: "var(--text-fluid-xs)" }}
              >
                {error}
              </p>
            ) : null}

            <div
              className="grid grid-cols-2"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <button
                type="button"
                onClick={closeModal}
                disabled={assigning}
                className="font-poppins flex items-center justify-center rounded-[30px] bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3] disabled:opacity-60"
                style={{
                  height: "var(--height-control-md)",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleAssign()}
                disabled={assigning}
                className="font-poppins flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] disabled:opacity-60"
                style={{
                  height: "var(--height-control-md)",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                {assigning ? "Atribuindo..." : "Atribuir administração"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

type ParticipanteRowProps = {
  participante: MesaParticipanteView;
  clickable: boolean;
  onClick: () => void;
};

function ParticipanteRow({
  participante,
  clickable,
  onClick,
}: ParticipanteRowProps) {
  const content = (
    <ParticipantsComandaCard size="sm">
      <div className="flex flex-col h-full">
        {/* Parte de cima */}
        <div className="flex items-center justify-between px-4 py-3">
          <div
            className="flex min-w-0 items-center"
            style={{ gap: "17px" }}
          >
            <span
              className="flex shrink-0 items-center justify-center rounded-full bg-[#5B9A7A] font-poppins font-semibold text-white"
              style={{
                height: "2.5rem",
                width: "2.5rem",
                fontSize: "var(--text-fluid-xs)",
              }}
            >
              {getInitials(participante.displayName)}
            </span>

            <div className="min-w-0 flex flex-col" style={{ gap: "6.09px" }}>
              <p
                className="font-poppins font-medium leading-none tracking-normal text-[#5B9A7A] truncate"
                style={{ fontSize: "18px" }}
              >
                {participante.displayName}
              </p>

              <p
                className="font-poppins font-normal leading-none tracking-normal text-[#8B8B8B]"
                style={{ fontSize: "12px" }}
              >
                {participante.isAdmin ? "Administrador" : "Participante"}
              </p>
            </div>
          </div>

          {typeof participante.subtotalCents === "number" && (
            <strong
              className="font-poppins font-bold text-[#E58A85]"
              style={{ fontSize: "1.5rem" }}
            >
              {brl.format(centsToReais(participante.subtotalCents))}
            </strong>
          )}
        </div>

        {/* Divisor */}
        <div className="h-px bg-[#BCD0C3]" />

        {/* Parte de baixo */}
        <div className="flex items-center gap-2 px-4 py-2">
          <span
            className="font-poppins text-[#7B7B7B]"
            style={{ fontSize: "12px" }}
          >
            Status da Conta:
          </span>

          <span
            className={`font-poppins ${
              participante.paid
                ? " text-[#5B9A7A]"
                : " text-[#E58A85]"
            }`}
            style={{ fontSize: "12px" }}
          >
            {participante.paid ? "Pago" : "Pendente de pagamento"}
          </span>
        </div>
      </div>
    </ParticipantsComandaCard>
  );

  if (!clickable) {
    return <div>{content}</div>;
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Modificar ${participante.displayName}`}
      className="transition active:scale-[0.99]"
    >
      {content}
    </button>
  );
}