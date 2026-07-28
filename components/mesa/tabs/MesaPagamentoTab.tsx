"use client";

import ComandaCard from "@/components/mesa/ComandaCard";
import { useAuth } from "@/lib/contexts/AuthContext";
import {
  centsToReais,
  isItemInCurrentRound,
  tipCents,
  userItemShareCents,
} from "@/lib/billing";
import { foodIconSrc } from "@/lib/foodIcons";
import { registerPayment } from "@/lib/services/paymentService";
import type { TableItemWithId } from "@/lib/types/item";
import type { Participant } from "@/lib/types/participant";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useMemo, useState, type ReactNode, type SVGProps } from "react";

const COMANDA_DIVIDER: React.CSSProperties = {
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

function ForkKnifeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" {...props}>
      <path d="M8.1 13.34l2.83-2.83L3.91 3.5a4.008 4.008 0 0 0 0 5.66zm6.78-1.81c1.53.71 3.68.21 5.27-1.38c1.91-1.91 2.28-4.65.81-6.12c-1.46-1.46-4.2-1.1-6.12.81c-1.59 1.59-2.09 3.74-1.38 5.27L3.7 19.87l1.41 1.41L12 14.41l6.88 6.88l1.41-1.41l-6.88-6.88z" />
    </svg>
  );
}

function ItemsConsumedStat({ count }: { count: number }) {
  return (
    <div
      className="flex flex-col items-center"
      style={{
        gap: "var(--spacing-fluid-2)",
        paddingTop: "20px",
        paddingBottom: "20px",
        ...COMANDA_DIVIDER,
      }}
    >
      <span
        className="font-poppins text-[#7C7D7D]"
        style={{
          fontSize: "15px",
          fontStyle: "normal",
          fontWeight: 800,
          lineHeight: "normal",
        }}
      >
        Itens Consumidos
      </span>
      <span
        className="font-poppins flex items-center text-[#667085]"
        style={{
          gap: "var(--spacing-fluid-2)",
          fontSize: "15px",
          fontStyle: "normal",
          fontWeight: 700,
          lineHeight: "normal",
        }}
      >
        <ForkKnifeIcon style={{ height: "1.1rem", width: "1.1rem" }} />
        {count}
      </span>
    </div>
  );
}

function NoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M7 7l10 10M17 7L7 17"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  );
}

type ReceiptLine = {
  id: string;
  label: string;
  priceCents: number;
  iconSrc: string | null;
};

type MesaPagamentoTabProps = {
  tableId?: string;
  participants: Participant[];
  couvert: number;
  items: TableItemWithId[];
  tipPercent: number;
};

export default function MesaPagamentoTab({
  tableId: tableIdProp,
  participants,
  couvert,
  items,
  tipPercent,
}: MesaPagamentoTabProps) {
  const params = useParams<{ tableId: string }>();
  const tableId = tableIdProp ?? params.tableId;
  const { user } = useAuth();

  const [registeringPayment, setRegisteringPayment] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const currentParticipant = useMemo(
    () => participants.find((p) => p.uid === user?.uid) ?? null,
    [participants, user?.uid],
  );

  const myItems = useMemo(() => {
    if (!user) return [];
    const settledThroughMs =
      currentParticipant?.settledThroughAt?.getTime() ?? null;

    return items.filter(
      (item) =>
        item.consumerUids.includes(user.uid) &&
        isItemInCurrentRound(
          { price: item.price, consumerUids: item.consumerUids, createdAtMs: item.createdAtMs },
          settledThroughMs,
        ),
    );
  }, [items, user, currentParticipant?.settledThroughAt]);

  // Total do consumo do usuário (itens + couvert artístico + gorjeta)
  const itemsTotalCents = useMemo(() => {
    if (!user) return 0;
    return myItems.reduce((sum, item) => {
      return sum + userItemShareCents(user.uid, item);
    }, 0);
  }, [myItems, user]);

  // Couvert é uma vez por pessoa: quem já pagou uma rodada não paga de novo.
  const couvertCents =
    couvert > 0 && currentParticipant?.couvertSettled !== true
      ? Math.round(couvert * 100)
      : 0;
  const subtotalCents = itemsTotalCents + couvertCents;
  // Gorjeta obrigatória: definida pelo admin, entra na conta de todo mundo.
  const tipValueCents = tipCents(subtotalCents, tipPercent);

  const totalConsumptionCents = subtotalCents + tipValueCents;

  const receiptNumber = useMemo(() => {
    const participantIndex = participants.findIndex((participant) => participant.uid === user?.uid);
    if (participantIndex >= 0) {
      return String(participantIndex + 1).padStart(2, "0");
    }

    return "01";
  }, [participants, user?.uid]);

  const receiptLines = useMemo<ReceiptLine[]>(() => {
    const lines: ReceiptLine[] = user
      ? myItems.map((item) => ({
          id: item.id,
          label: item.name,
          priceCents: userItemShareCents(user.uid, item),
          iconSrc: foodIconSrc(item.icon),
        }))
      : [];

    if (couvertCents > 0) {
      lines.push({
        id: "couvert",
        label: "Couvert",
        priceCents: couvertCents,
        iconSrc: null,
      });
    }

    if (tipValueCents > 0) {
      lines.push({
        id: "tip",
        label: `${tipPercent}% do Garçom`,
        priceCents: tipValueCents,
        iconSrc: null,
      });
    }

    return lines;
  }, [couvertCents, myItems, tipPercent, tipValueCents, user]);

  async function handleRegisterPayment() {
    if (!currentParticipant || currentParticipant.paid) return;
    if (!tableId) return;

    setRegisteringPayment(true);
    setError(null);

    try {
      await registerPayment(tableId);
      setError(null);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "Não foi possível registrar o pagamento.",
      );
    } finally {
      setRegisteringPayment(false);
    }
  }

  return (
    <div
      className="flex flex-col"
      role="tabpanel"
      aria-label="Pagamento"
      style={{ gap: "var(--spacing-fluid-4)" }}
    >
      <h2 className="font-poppins font-black text-[#da8280]" style={{ fontSize: "20px" }}>
        Pagamento
      </h2>

      <div className="flex justify-center">
        <ComandaCard
          size="lg"
          className="w-full max-w-[370px]"
          style={{
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            borderTopLeftRadius: "10px",
            borderTopRightRadius: "10px",
            paddingInline: "var(--spacing-fluid-5)",
            paddingTop: "var(--spacing-fluid-3)",
            paddingBottom: "var(--spacing-fluid-5)",
            gap: 0,
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
            Comanda #{receiptNumber}
          </h2>

          <div className="flex justify-center" style={{ marginTop: "8px" }}>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="147"
              height="3"
              viewBox="0 0 147 3"
              fill="none"
              style={{ transform: "rotate(-0.398deg)" }}
              aria-hidden="true"
            >
              <path
                d="M82.3366 0.443063C85.5821 0.553512 88.1322 -0.0519767 92.0874 0.00363572C96.0427 0.0592498 96.6372 0.366907 101.166 0.265307C105.694 0.163722 110.227 0.345494 112.243 0.203398C114.258 0.0612654 114.474 0.447169 117.337 0.341244C120.2 0.235332 121.936 0.273844 124.441 0.382368C126.946 0.490892 134.641 0.544958 137.438 0.370848C140.234 0.196738 143.427 0.442969 145.347 0.493296C145.945 0.508972 146.415 0.53284 146.776 0.558567C146.929 0.569476 147 0.594028 147 0.618745C147 0.618761 147 0.618778 147 0.618794C147 0.649571 146.891 0.680593 146.695 0.685845C145.742 0.711341 144.318 0.771036 142.635 0.894337C139.499 1.12425 139.155 0.896647 134.918 1.03301C130.682 1.16938 128.138 1.40086 123.151 1.29723C118.165 1.19361 117.024 1.7801 109.984 1.5011C102.944 1.22212 102.208 1.83231 95.1955 1.96147C88.1831 2.09062 79.3283 1.81826 75.101 1.8753C70.8737 1.93234 65.1963 2.04225 59.2027 2.00402C53.2091 1.96579 45.8123 2.21873 39.196 2.1222C32.5797 2.02567 23.2259 1.91068 18.9042 1.82011C14.5828 1.72954 13.5295 1.70966 9.3712 1.81221C6.98097 1.87117 3.6875 1.85412 0.904753 1.71769C-0.495707 1.64902 -0.179243 1.53768 1.22946 1.47568C3.28943 1.38501 4.98124 1.42428 6.04198 1.28051C8.16157 0.99319 9.0625 0.88236 11.7418 1.02242C14.421 1.16246 15.6804 0.793165 17.2419 0.823819C18.8034 0.854493 18.7792 1.06733 26.7161 0.84836C34.6532 0.629385 39.0047 0.557358 42.0106 0.497147C45.0164 0.436936 51.2948 0.577909 56.1935 0.47727C61.0924 0.376634 71.0529 0.368518 75.0672 0.231576C79.0813 0.0946439 79.0912 0.332613 82.3366 0.443063Z"
                fill="#519472"
                stroke="#519472"
                strokeWidth=".5"
              />
            </svg>
          </div>

          <div
            className="grid grid-cols-2"
            style={{
              columnGap: "var(--spacing-fluid-4)",
              marginBottom: "30px",
            }}
          >
            <ItemsConsumedStat count={myItems.length} />
            <ReceiptStat
              label="Total Gasto"
              value={formatCurrency(totalConsumptionCents)}
              valueStyle={{
                color: "#DB8583",
                fontSize: "15px",
                fontStyle: "normal",
                fontWeight: 700,
                lineHeight: "normal",
              }}
              icon={
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/avatars/moeda-icon.svg"
                  alt=""
                  aria-hidden="true"
                  className="object-contain"
                  style={{ height: "1.2rem", width: "1.2rem" }}
                />
              }
            />
          </div>

          <div className="w-full shrink-0" style={COMANDA_DIVIDER} />

          <div className="flex min-h-0 flex-1 flex-col" style={{ marginTop: "var(--spacing-fluid-4)" }}>
            <p className="font-poppins font-black text-[#7c7d7d] shrink-0" style={{ fontSize: "15px" }}>
              Itens consumidos
            </p>

            {currentParticipant ? (
              receiptLines.length > 0 ? (
                <div
                  className="receipt-lines-scrollbar min-h-0 flex-1"
                  style={{
                    marginTop: "1rem",
                    overflowY: "auto",
                    scrollBehavior: "smooth",
                    paddingRight: "0.35rem",
                    marginBottom: "5px",
                    scrollbarColor: "#D6D6D6 rgba(248, 246, 240, 0.90)",
                    scrollbarWidth: "thin",
                  }}
                >
                  <ul className="flex list-none flex-col" style={{ gap: "0.45rem" }}>
                    {receiptLines.map((line) => (
                      <li key={line.id} className="flex items-center gap-2">
                        <span className="flex h-6 w-6 shrink-0 items-center justify-center text-[#a2a6ab]">
                          {line.iconSrc ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={line.iconSrc}
                              alt=""
                              aria-hidden="true"
                              className="h-full w-full object-contain"
                            />
                          ) : (
                            <NoIcon className="size-5" />
                          )}
                        </span>

                        <span
                          className="min-w-0 shrink-0 font-poppins text-[#818282]"
                          style={{
                            fontSize: "15px",
                            fontStyle: "normal",
                            fontWeight: 500,
                            lineHeight: "normal",
                          }}
                        >
                          {line.label}
                        </span>

                        <span className="min-w-0 flex-1 border-b border-dotted border-[#d0d6df]" />

                        <span
                          className="shrink-0 font-poppins font-bold text-[#db8583]"
                          style={{ fontSize: "15px" }}
                        >
                          {formatCurrency(line.priceCents)}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p
                  className="font-poppins text-[#818282]"
                  style={{ marginTop: "var(--spacing-fluid-3)", fontSize: "var(--text-fluid-sm)" }}
                >
                  Nenhum item lançado para esta comanda.
                </p>
              )
            ) : (
              <p
                className="font-poppins text-[#818282]"
                style={{ marginTop: "var(--spacing-fluid-3)", fontSize: "var(--text-fluid-sm)" }}
              >
                Você ainda não aparece como participante desta mesa.
              </p>
            )}
          </div>

          {currentParticipant ? (
              <button
                type="button"
                onClick={() => void handleRegisterPayment()}
                disabled={registeringPayment || currentParticipant.paid}
                className="mx-auto mt-6 flex shrink-0 items-center justify-center rounded-[30px] bg-[#CDE9DA] font-poppins font-semibold text-[#418964] transition hover:bg-[#bddfce] disabled:opacity-60"
                style={{
                  minHeight: "2.25rem",
                  paddingInline: "var(--spacing-fluid-4)",
                  fontSize: "var(--text-fluid-sm)",
                  width: "min(100%, 13.5rem)",
                  marginBottom: "10px",
                }}
              >
                {currentParticipant.paid
                  ? "Pagamento registrado"
                  : registeringPayment
                    ? "Comprovando..."
                    : "Confirmar Pagamento"}
              </button>
          ) : null}

          {error ? (
            <p
              className="font-poppins text-center text-[#c0392b]"
              style={{ marginTop: "var(--spacing-fluid-3)", fontSize: "var(--text-fluid-xs)" }}
            >
              {error}
            </p>
          ) : null}
        </ComandaCard>
      </div>

      <style jsx global>{`
        .receipt-lines-scrollbar::-webkit-scrollbar {
          width: 6px;
        }

        .receipt-lines-scrollbar::-webkit-scrollbar-track {
          background: #fffbf0;
          border-radius: 999px;
        }

        .receipt-lines-scrollbar::-webkit-scrollbar-thumb {
          background: #3f4a43;
          border-radius: 999px;
          border: 1px solid #fffbf0;
        }

        .receipt-lines-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #2f382f;
        }
      `}</style>
    </div>
  );
}

type ReceiptStatProps = {
  label: string;
  value: string;
  icon: ReactNode;
  valueStyle?: React.CSSProperties;
};

function ReceiptStat({
  label,
  value,
  icon,
  valueStyle,
}: ReceiptStatProps) {
  return (
    <div
      className="flex flex-col items-center"
      style={{
        gap: "var(--spacing-fluid-2)",
        paddingTop: "20px",
        paddingBottom: "33px",
        ...COMANDA_DIVIDER,
      }}
    >
      <span
        className="font-poppins text-[#7C7D7D]"
        style={{
          fontSize: "15px",
          fontStyle: "normal",
          fontWeight: 800,
          lineHeight: "normal",
        }}
      >
        {label}
      </span>

      <span
        className="font-poppins flex items-center font-bold text-[#3f4a43]"
        style={{
          gap: "var(--spacing-fluid-2)",
          fontSize: "var(--text-fluid-sm)",
          ...valueStyle,
        }}
      >
        <span className="flex items-center justify-center text-[#f0bf73]">{icon}</span>
        {value}
      </span>
    </div>
  );
}
