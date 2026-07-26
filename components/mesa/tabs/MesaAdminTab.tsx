"use client";

import { useState, type ReactNode } from "react";

import Avatar from "@/components/Avatar";
import FixedPricesModal from "@/components/mesa/FixedPricesModal";

export type EncerrarParticipante = {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
  paid: boolean;
};

type MesaAdminTabProps = {
  tableName: string;
  couvert?: number;
  tipPercent?: number;
  /** Participantes da mesa — listados no modal de encerrar com status de pagamento. */
  participants?: EncerrarParticipante[];
  onSaveSettings?: (settings: {
    couvertSuggested: number;
    tipPercent: number;
  }) => Promise<void>;
  onCloseTable?: () => void;
  closing?: boolean;
};

export default function MesaAdminTab({
  tableName,
  couvert: initialCouvert = 0,
  tipPercent: initialTipPercent = 10,
  participants = [],
  onSaveSettings,
  onCloseTable,
  closing = false,
}: MesaAdminTabProps) {
  const [showFixedPrices, setShowFixedPrices] = useState(false);
  const [showClose, setShowClose] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsError, setSettingsError] = useState<string | null>(null);

  async function handleConfirmFixedPrices(values: {
    couvertSuggested: number;
    tipPercent: number;
  }) {
    setSettingsError(null);

    if (!onSaveSettings) {
      setShowFixedPrices(false);
      return;
    }

    setSavingSettings(true);
    try {
      await onSaveSettings(values);
      setShowFixedPrices(false);
    } catch {
      setSettingsError("Não foi possível salvar as configurações.");
    } finally {
      setSavingSettings(false);
    }
  }

  return (
    <div
      className="flex flex-col"
      style={{ gap: "var(--spacing-fluid-4)" }}
      role="tabpanel"
    >
      <h2
        className="font-poppins font-black text-[#e5786c]"
        style={{ fontSize: "20px" }}
      >
        Ajustes da Mesa
      </h2>

      <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-3)" }}>
        <SettingRow
          icon="pi-tag"
          label="Modificar itens fixos"
          onClick={() => {
            setSettingsError(null);
            setShowFixedPrices(true);
          }}
        />
        <SettingRow
          icon="pi-trash"
          label="Encerrar Mesa"
          onClick={() => setShowClose(true)}
        />
      </div>

      {showFixedPrices ? (
        <FixedPricesModal
          title="Alterar Preços Fixos"
          couvert={initialCouvert}
          tipPercent={initialTipPercent}
          saving={savingSettings}
          error={settingsError}
          onCancel={() => {
            if (!savingSettings) {
              setShowFixedPrices(false);
            }
          }}
          onConfirm={(values) => void handleConfirmFixedPrices(values)}
        />
      ) : null}

      {showClose ? (
        <Modal title="Encerrar Mesa" onClose={() => setShowClose(false)}>
          <p
            className="font-poppins text-center text-[#8a3b32]"
            style={{ fontSize: "var(--text-fluid-sm)" }}
          >
            A mesa “{tableName}” será encerrada e todos os participantes
            desconectados. Esta ação não pode ser desfeita.
          </p>

          {participants.length > 0 ? (
            <div
              className="flex flex-col"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <span
                className="font-poppins font-semibold
                 text-[##5B9A7A]"
                style={{ fontSize: "var(--text-fluid-sm)" }}
              >
                Resumo da Mesa:
              </span>

              <ul
                className="flex max-h-48 flex-col overflow-y-auto"
                style={{ gap: "var(--spacing-fluid-2)" }}
              >
                {participants.map((participante) => (
                  <li
                    key={participante.uid}
                    className="flex items-center justify-between rounded-[10px] border border-[#418964]/15 bg-white"
                    style={{
                      padding: "var(--spacing-fluid-2)",
                      gap: "var(--spacing-fluid-2)",
                    }}
                  >
                    <div
                      className="flex min-w-0 items-center"
                      style={{ gap: "var(--spacing-fluid-2)" }}
                    >
                      <Avatar
                        name={participante.displayName}
                        avatarUrl={participante.avatarUrl}
                        style={{ height: "2rem", width: "2rem" }}
                        textStyle={{ fontSize: "var(--text-fluid-xs)" }}
                      />
                      <span
                        className="font-poppins truncate font-semibold text-[#418964]"
                        style={{ fontSize: "var(--text-fluid-sm)" }}
                      >
                        {participante.displayName}
                      </span>
                    </div>

                    <span
                      className={`font-poppins shrink-0 rounded-full px-2 py-1 font-semibold ${
                        participante.paid
                          ? "bg-[#cde9da] text-[#418964]"
                          : "bg-[#fdebd0] text-[#8a6d3b]"
                      }`}
                      style={{ fontSize: "0.65rem" }}
                    >
                      {participante.paid ? "Pago" : "Pendente"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}

          <div
            className="flex items-center justify-center"
            style={{
              gap: "var(--spacing-fluid-2)",
              marginTop: "var(--spacing-fluid-2)",
            }}
          >
            <button
              type="button"
              onClick={() => setShowClose(false)}
              disabled={closing}
              className="font-poppins flex items-center justify-center rounded-[30px] bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3] disabled:opacity-60"
              style={{
                width: "128px",
                height: "28px",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={onCloseTable}
              disabled={closing}
              className="font-poppins flex items-center justify-center gap-2 rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] disabled:opacity-60"
              style={{
                width: "128px",
                height: "28px",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              {closing ? "Encerrando..." : "Encerrar Mesa"}
            </button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}

type SettingRowProps = {
  icon: string;
  label: string;
  onClick: () => void;
};

function SettingRow({ icon, label, onClick }: SettingRowProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center rounded-[5px] border-[0.5px] border-[#75aa8f] bg-[#fafafa] text-left transition hover:bg-[#f0f4f1] active:scale-[0.99]"
      style={{
        padding: "var(--spacing-fluid-3)",
        gap: "var(--spacing-fluid-3)",
        minHeight: "48px",
      }}
    >
      <i
        aria-hidden="true"
        className={`pi ${icon} text-[#418964]`}
        style={{ fontSize: "var(--text-fluid-lg)" }}
      />
      <span
        className="font-poppins whitespace-nowrap font-medium text-[#484c52]"
        style={{ fontSize: "var(--text-fluid-sm)" }}
      >
        {label}
      </span>
    </button>
  );
}

type ModalProps = {
  title: string;
  onClose: () => void;
  children: ReactNode;
};

function Modal({ title, onClose, children }: ModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[420px] items-center justify-center"
      style={{ padding: "var(--spacing-fluid-5)" }}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-[#1f2b24]/40"
      />

      <div
        className="relative flex w-full flex-col rounded-[10px_10px_25px_10px] bg-white shadow-[0_20px_50px_rgba(31,43,36,0.25)]"
        style={{
          padding: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-3)",
        }}
      >
        <h3
          className="font-poppins font-black text-center text-[#e5786c]"
          style={{ fontSize: "20px" }}
        >
          {title}
        </h3>
        {children}
      </div>
    </div>
  );
}
