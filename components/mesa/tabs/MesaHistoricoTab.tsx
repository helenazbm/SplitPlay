"use client";

import ComandaCard from "@/components/mesa/ComandaCard";
import LeaveTableButton from "@/components/mesa/LeaveTableButton";
import { centsToReais } from "@/lib/billing";
import {
  paidBalanceCents,
  pendingBalanceCents,
} from "@/lib/services/paymentService";
import type { Participant } from "@/lib/types/participant";
import Image from "next/image";
import { useMemo, type CSSProperties, type ReactNode } from "react";

const COMANDA_DIVIDER: CSSProperties = {
  borderBottom: "1.5px dashed #cdd5cd",
  paddingBottom: "var(--spacing-fluid-2)",
};

const brl = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

function formatCurrency(cents: number) {
  return brl.format(centsToReais(cents));
}

function CoinIcon() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src="/avatars/moeda-icon.svg"
      alt=""
      aria-hidden="true"
      className="object-contain"
      style={{ height: "1.2rem", width: "1.2rem" }}
    />
  );
}

type MesaHistoricoTabProps = {
  participants: Participant[];
  /** Gorjeta sugerida da mesa (%), definida pelo admin. */
  tipPercent: number;
  currentUserIsAdmin: boolean;
  onLeave: (newAdminUid?: string) => void | Promise<void>;
  /** Troca para a aba de Pagamento (botão "Pagar agora" do aviso de saída). */
  onPayNow: () => void;
  leaving?: boolean;
};

/**
 * Extrato da mesa inteira, para conferir com a nota do estabelecimento.
 *
 */
export default function MesaHistoricoTab({
  participants,
  tipPercent,
  currentUserIsAdmin,
  onLeave,
  onPayNow,
  leaving = false,
}: MesaHistoricoTabProps) {
  const {
    consumoCents,
    gorjetaCents,
    totalComGorjetaCents,
    pagoCents,
    faltaCents,
  } = useMemo(() => {
    const consumo = participants.reduce(
      (sum, participant) =>
        sum +
        Math.max(0, participant.subtotalCents) +
        Math.max(0, participant.settledSubtotalCents),
      0,
    );

    const gorjeta = Math.round((consumo * tipPercent) / 100);
    const pago = paidBalanceCents(participants);

    return {
      consumoCents: consumo,
      gorjetaCents: gorjeta,
      totalComGorjetaCents: consumo + gorjeta,
      pagoCents: pago,
      faltaCents: pendingBalanceCents(participants),
    };
  }, [participants, tipPercent]);

  const quitada = participants.length > 0 && faltaCents === 0;

  return (
    <div
      className="flex flex-col"
      role="tabpanel"
      aria-label="Histórico"
      style={{ gap: "var(--spacing-fluid-4)" }}
    >

      <div className="flex flex-col items-center">
        <ComandaCard
          size="lg"
          className="w-full max-w-[370px]"
          style={{
            borderTopLeftRadius: "10px",
            borderTopRightRadius: "10px",
            paddingInline: "var(--spacing-fluid-5)",
            paddingTop: "var(--spacing-fluid-3)",
            paddingBottom: "var(--spacing-fluid-5)",
            gap: "var(--spacing-fluid-3)",
          }}
        >
          <div
            className="flex flex-col items-center"
            style={{ gap: "var(--spacing-fluid-2)", marginTop: "15px" }}
          >
            <Image
              src="/home.svg"
              alt=""
              width={147}
              height={69.854}
              priority={false}
              className="h-auto w-[147px]"
              style={{
                filter:
                  "brightness(0) saturate(100%) invert(49%) sepia(17%) saturate(748%) hue-rotate(96deg) brightness(91%) contrast(87%)",
              }}
            />
          </div>

          <div className="h-0.5 w-[86%] self-center rounded-full bg-[#fffbf0]" />

          <h2
            className="font-poppins text-center font-black text-[#519472]"
            style={{ marginTop: "var(--spacing-fluid-1)", fontSize: "20px" }}
          >
            Conta da Mesa
          </h2>

          <div
            className="flex flex-col"
            style={{
              marginTop: "var(--spacing-fluid-4)",
              gap: "var(--spacing-fluid-3)",
            }}
          >
            <div className="flex flex-col items-center" style={COMANDA_DIVIDER}>
              <span
                className="font-poppins text-[#7C7D7D]"
                style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em" }}
              >
                Total sem %
              </span>
              <span
                className="font-poppins flex items-center font-semibold text-[#519472]"
                style={{
                  gap: "var(--spacing-fluid-2)",
                  fontSize: "24px",
                  marginTop: "var(--spacing-fluid-1)",
                }}
              >
                <CoinIcon />
                {formatCurrency(consumoCents)}
              </span>
            </div>

            <div className="flex items-center justify-between">
              <span
                className="font-poppins text-[#7C7D7D]"
                style={{ fontSize: "15px", fontWeight: 500 }}
              >
                Garçom ({tipPercent}%)
              </span>
              <span
                className="font-poppins font-bold text-[#7C7D7D]"
                style={{ fontSize: "15px" }}
              >
                + {formatCurrency(gorjetaCents)}
              </span>
            </div>

            <div className="w-full" style={COMANDA_DIVIDER} />

            <div className="flex flex-col items-center" style={COMANDA_DIVIDER}>
              <span
                className="font-poppins text-[#7C7D7D]"
                style={{ fontSize: "13px", fontWeight: 700, letterSpacing: "0.02em" }}
              >
                Total com %
              </span>
              <span
                className="font-poppins flex items-center font-semibold text-[#519472]"
                style={{
                  gap: "var(--spacing-fluid-2)",
                  fontSize: "24px",
                  marginTop: "var(--spacing-fluid-1)",
                }}
              >
                <CoinIcon />
                {formatCurrency(totalComGorjetaCents)}
              </span>
            </div>

            <div
              className="grid grid-cols-2"
              style={{ columnGap: "var(--spacing-fluid-4)" }}
            >
              <HistoricoStat
                label="Já Pago"
                value={formatCurrency(pagoCents)}
                valueColor="#519472"
                icon={<CoinIcon />}
              />
              <HistoricoStat
                label="Falta Pagar"
                value={formatCurrency(faltaCents)}
                valueColor={quitada ? "#519472" : "#DB8583"}
                icon={<CoinIcon />}
              />
            </div>

            <div
              className="flex flex-col"
              style={{
                marginTop: "var(--spacing-fluid-2)",
                gap: "var(--spacing-fluid-2)",
              }}
            >
              <LeaveTableButton
                participants={participants.filter(
                  (participant) => !participant.left,
                )}
                currentUserIsAdmin={currentUserIsAdmin}
                onLeave={onLeave}
                onPayNow={onPayNow}
                leaving={leaving}
              />
            </div>
          </div>
        </ComandaCard>
      </div>
    </div>
  );
}


type HistoricoStatProps = {
  label: string;
  value: string;
  valueColor: string;
  icon: ReactNode;
};

function HistoricoStat({ label, value, valueColor, icon }: HistoricoStatProps) {
  return (
    <div
      className="flex flex-col items-center"
      style={{ gap: "var(--spacing-fluid-1)", paddingTop: "8px" }}
    >
      <span
        className="font-poppins text-[#7C7D7D]"
        style={{ fontSize: "15px", fontWeight: 600, lineHeight: "normal" }}
      >
        {label}
      </span>

      <span
        className="font-poppins flex items-center font-bold"
        style={{
          gap: "var(--spacing-fluid-2)",
          fontSize: "15px",
          lineHeight: "normal",
          color: valueColor,
        }}
      >
        <span className="flex items-center justify-center">{icon}</span>
        {value}
      </span>
    </div>
  );
}
