"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import { useState } from "react";

export type LeaveTableParticipant = {
  uid: string;
  displayName: string;
  paid: boolean;
};

type LeaveTableButtonProps = {
  participants: LeaveTableParticipant[];
  currentUserIsAdmin: boolean;
  onLeave: (newAdminUid?: string) => void | Promise<void>;
  onPayNow: () => void;
  leaving?: boolean;
};

function getInitials(name: string) {
  return name
    .split(" ")
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export default function LeaveTableButton({
  participants,
  currentUserIsAdmin,
  onLeave,
  onPayNow,
  leaving = false,
}: LeaveTableButtonProps) {
  const { user } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [unpaidOpen, setUnpaidOpen] = useState(false);
  const [newAdminUid, setNewAdminUid] = useState<string | null>(null);

  const currentUserPaid =
    participants.find((participant) => participant.uid === user?.uid)?.paid ===
    true;

  const adminCandidates = participants.filter(
    (participant) => participant.uid !== user?.uid && !participant.paid,
  );

  async function proceedToLeave() {
    setError(null);

    if (currentUserIsAdmin && adminCandidates.length > 0) {
      setNewAdminUid(null);
      setLeaveOpen(true);
      return;
    }

    try {
      await onLeave();
    } catch {
      setError("Não foi possível sair da mesa. Tente novamente.");
    }
  }

  function handleLeaveClick() {
    setError(null);

    if (!currentUserPaid) {
      setUnpaidOpen(true);
      return;
    }

    void proceedToLeave();
  }

  async function handleConfirmLeave() {
    if (!newAdminUid) return;

    setError(null);
    try {
      await onLeave(newAdminUid);
      setLeaveOpen(false);
    } catch {
      setError("Não foi possível transferir a administração. Tente novamente.");
    }
  }

  return (
    <>
      {error && !leaveOpen ? (
        <p
          className="font-poppins text-center text-[#c0392b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          {error}
        </p>
      ) : null}

      <button
        type="button"
        onClick={() => void handleLeaveClick()}
        disabled={leaving}
        className="font-poppins mx-auto flex items-center justify-center rounded-[30px] bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3] disabled:opacity-60"
        style={{
          minHeight: "var(--height-control-sm)",
          paddingInline: "var(--spacing-fluid-5)",
          fontSize: "var(--text-fluid-sm)",
          width: "min(100%, 16rem)",
        }}
      >
        {leaving ? "Saindo..." : "Sair da mesa"}
      </button>

      <p
        className="font-poppins text-center text-[#7a8a80]"
        style={{
          fontSize: "var(--text-fluid-xs)",
          paddingInline: "var(--spacing-fluid-3)",
          lineHeight: 1.5,
        }}
      >
        <i
          aria-hidden="true"
          className="pi pi-info-circle"
          style={{ marginRight: "0.35rem", fontSize: "0.8em" }}
        />
        Depois de confirmar seu pagamento, saia da mesa para encerrar sua
        participação.
      </p>

      {unpaidOpen ? (
        <div
          className="fixed inset-0 z-50 mx-auto flex w-full max-w-[420px] items-center justify-center"
          style={{ padding: "var(--spacing-fluid-5)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Você ainda não pagou"
        >
          <button
            type="button"
            aria-label="Fechar"
            disabled={leaving}
            onClick={() => setUnpaidOpen(false)}
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
              className="font-poppins text-center font-black text-[#e5786c]"
              style={{ fontSize: "20px" }}
            >
              Você ainda não pagou
            </h3>

            <p
              className="font-poppins text-center text-[#64835b]"
              style={{ fontSize: "var(--text-fluid-sm)" }}
            >
              Sua parte da conta ainda está pendente. Para sair da mesa, é
              preciso pagar antes.
            </p>

            {error ? (
              <p
                className="font-poppins text-center text-[#c0392b]"
                style={{ fontSize: "var(--text-fluid-xs)" }}
              >
                {error}
              </p>
            ) : null}

            <div
              className="flex flex-col"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <button
                type="button"
                onClick={() => {
                  setUnpaidOpen(false);
                  onPayNow();
                }}
                disabled={leaving}
                className="font-poppins flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] disabled:opacity-60"
                style={{
                  height: "var(--height-control-md)",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                Pagar agora
              </button>
              <button
                type="button"
                onClick={() => setUnpaidOpen(false)}
                disabled={leaving}
                className="font-poppins text-[#64835b] underline underline-offset-4 disabled:opacity-60"
                style={{ fontSize: "var(--text-fluid-sm)" }}
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {leaveOpen ? (
        <div
          className="fixed inset-0 z-50 mx-auto flex w-full max-w-[420px] items-center justify-center"
          style={{ padding: "var(--spacing-fluid-5)" }}
          role="dialog"
          aria-modal="true"
          aria-label="Transferir administração antes de sair"
        >
          <button
            type="button"
            aria-label="Fechar"
            disabled={leaving}
            onClick={() => setLeaveOpen(false)}
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
              className="font-poppins text-center font-black text-[#e5786c]"
              style={{ fontSize: "20px" }}
            >
              Passe a administração
            </h3>

            <p
              className="font-poppins text-[#64835b]"
              style={{ fontSize: "var(--text-fluid-sm)" }}
            >
              Você é o administrador desta mesa. Antes de sair, escolha outra
              pessoa para assumir essa função.
            </p>

            <ul
              className="flex list-none flex-col"
              style={{
                gap: "var(--spacing-fluid-2)",
                maxHeight: "14rem",
                overflowY: "auto",
              }}
            >
              {adminCandidates.map((participant) => {
                const selected = participant.uid === newAdminUid;

                return (
                  <li key={participant.uid}>
                    <button
                      type="button"
                      onClick={() => setNewAdminUid(participant.uid)}
                      disabled={leaving}
                      aria-pressed={selected}
                      className="flex w-full items-center rounded-[10px_10px_25px_10px] border bg-[#fffbf0] text-left transition disabled:opacity-60"
                      style={{
                        padding: "var(--spacing-fluid-3)",
                        gap: "var(--spacing-fluid-3)",
                        borderColor: selected
                          ? "#418964"
                          : "rgba(65,137,100,0.25)",
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
                        {getInitials(participant.displayName)}
                      </span>

                      <span className="min-w-0 flex-1">
                        <span
                          className="font-poppins block truncate font-semibold text-[#5B9A7A]"
                          style={{ fontSize: "var(--text-fluid-sm)" }}
                        >
                          {participant.displayName}
                        </span>
                        <span
                          className="font-poppins block text-[#64835b]"
                          style={{ fontSize: "var(--text-fluid-xs)" }}
                        >
                          Ainda não pagou
                        </span>
                      </span>

                      {selected ? (
                        <i
                          aria-hidden="true"
                          className="pi pi-check shrink-0 text-[#418964]"
                        />
                      ) : null}
                    </button>
                  </li>
                );
              })}
            </ul>

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
                onClick={() => setLeaveOpen(false)}
                disabled={leaving}
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
                onClick={() => void handleConfirmLeave()}
                disabled={leaving || !newAdminUid}
                className="font-poppins flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] disabled:opacity-60"
                style={{
                  height: "var(--height-control-md)",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                {leaving ? "Saindo..." : "Transferir e sair"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
