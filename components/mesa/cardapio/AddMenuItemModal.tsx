"use client";

import { useState } from "react";

import Avatar from "@/components/Avatar";
import { MenuItemIcon, brl } from "@/components/mesa/cardapio/MenuCatalog";
import { menuLinePrice } from "@/lib/services/menuService";
import type { MenuItemWithId } from "@/lib/types/menu";

export type MenuParticipant = {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
};

type AddMenuItemModalProps = {
  item: MenuItemWithId;
  /** Quem pode dividir (sem o usuário atual, que entra sempre). */
  participants: MenuParticipant[];
  initialQuantity?: number;
  initialSharedUids?: string[];
  submitLabel?: string;
  onClose: () => void;
  onSubmit: (data: { quantity: number; sharedUids: string[] }) => void;
};

const labelStyle = { fontSize: "var(--text-fluid-xs)" };
const labelClass = "font-poppins text-[#64835b]";
const pillButtonStyle = { width: "105px", height: "28px", fontSize: "var(--text-fluid-sm)" };

/**
 * "Adicionar Itens" (Figma): item do cardápio escolhido, com quem dividir e
 * quantidade. Não grava nada — devolve a escolha para o carrinho do cardápio.
 */
export default function AddMenuItemModal({
  item,
  participants,
  initialQuantity = 1,
  initialSharedUids = [],
  submitLabel = "Adicionar",
  onClose,
  onSubmit,
}: AddMenuItemModalProps) {
  const [quantity, setQuantity] = useState(initialQuantity);
  const [sharedUids, setSharedUids] = useState<string[]>(initialSharedUids);
  const [showList, setShowList] = useState(false);

  const selected = participants.filter((participant) => sharedUids.includes(participant.uid));

  function toggle(uid: string) {
    setSharedUids((current) =>
      current.includes(uid) ? current.filter((id) => id !== uid) : [...current, uid],
    );
  }

  // Mesmas medidas do CreateItemModal (item manual), para os dois fluxos de
  // "Adicionar Itens" parecerem a mesma tela.
  return (
    <div
      className="fixed inset-0 z-[60] mx-auto flex w-full max-w-[420px] items-center justify-center"
      style={{ padding: "var(--spacing-fluid-5)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar Itens"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="sp-fade-in absolute inset-0 bg-[#1f2b24]/40"
      />

      <div
        className="sp-fade-in relative flex max-h-full w-full flex-col overflow-y-auto rounded-[10px_10px_25px_10px] bg-white shadow-[0_20px_50px_rgba(31,43,36,0.25)]"
        style={{ padding: "var(--spacing-fluid-5)", gap: "var(--spacing-fluid-4)" }}
      >
        <h3 className="font-poppins text-center font-black text-[#e5786c]" style={{ fontSize: "20px" }}>
          Adicionar Itens
        </h3>

        <div className="grid gap-1">
          <span className={labelClass} style={labelStyle}>
            Item selecionado:
          </span>
          <div
            className="flex items-center rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3"
            style={{ gap: "var(--spacing-fluid-2)" }}
          >
            <MenuItemIcon item={item} size={32} />
            <div className="min-w-0 flex-1">
              <p className="font-poppins truncate font-semibold text-[#418964]" style={{ fontSize: "var(--text-fluid-sm)" }}>
                {item.name}
              </p>
              <p className="font-poppins text-[#9bb0a4]" style={{ fontSize: "var(--text-fluid-xs)" }}>
                {quantity} × {brl.format(item.price)}
              </p>
            </div>
            <strong className="font-poppins shrink-0 font-bold text-[#db8684]" style={{ fontSize: "var(--text-fluid-sm)" }}>
              {brl.format(menuLinePrice(item.price, quantity))}
            </strong>
          </div>
        </div>

        <div className="grid gap-2">
          <span className={labelClass} style={labelStyle}>
            Dividir com:
          </span>
          <div
            className="-mx-1 flex overflow-x-auto px-1"
            style={{ gap: "var(--spacing-fluid-2)", paddingBottom: "0.25rem" }}
          >
            {selected.map((participant) => (
              <div
                key={participant.uid}
                className="flex shrink-0 flex-col items-center rounded-lg border border-[#418964]/25 bg-white"
                style={{ width: "101px", height: "129px", padding: "var(--spacing-fluid-2)", gap: "0.4rem" }}
              >
                <Avatar
                  name={participant.displayName}
                  avatarUrl={participant.avatarUrl}
                  style={{ height: "2.75rem", width: "2.75rem" }}
                  textStyle={{ fontSize: "var(--text-fluid-sm)" }}
                />
                <span
                  className="font-poppins w-full truncate text-center font-semibold text-[#418964]"
                  style={{ fontSize: "var(--text-fluid-xs)" }}
                  title={participant.displayName}
                >
                  {participant.displayName}
                </span>
                <button
                  type="button"
                  onClick={() => toggle(participant.uid)}
                  className="font-poppins rounded-full bg-[#F1D4D3] px-3 font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3]"
                  style={{ fontSize: "0.6rem", paddingBlock: "0.15rem" }}
                >
                  Excluir
                </button>
              </div>
            ))}

            <button
              type="button"
              onClick={() => setShowList(true)}
              aria-label="Adicionar participantes"
              className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-[#418964]/25 bg-white transition hover:border-[#418964]/50"
              style={{ width: "101px", height: "129px", gap: "0.4rem" }}
            >
              <i aria-hidden="true" className="pi pi-plus text-[#418964]" style={{ fontSize: "var(--text-fluid-lg)" }} />
              <span
                className="font-poppins rounded-full bg-[#cde9da] px-3 font-semibold text-[#418964]"
                style={{ fontSize: "0.6rem", paddingBlock: "0.15rem" }}
              >
                Adicionar
              </span>
            </button>
          </div>

          <div className="grid w-full gap-1">
            <span className={`${labelClass} justify-self-start text-left`} style={labelStyle}>
              Quantidade:
            </span>
            <div className="flex w-full justify-center">
              <div
                className="flex w-fit items-center overflow-hidden rounded-[6px] border border-[#418964]/25 bg-white"
                style={{ height: "2rem" }}
              >
                <button
                  type="button"
                  aria-label="Diminuir quantidade"
                  onClick={() => setQuantity((current) => Math.max(1, current - 1))}
                  disabled={quantity <= 1}
                  className="font-poppins flex h-full w-8 items-center justify-center text-[#418964] transition hover:bg-[#f4faf6] disabled:opacity-40"
                >
                  -
                </button>
                <span
                  aria-live="polite"
                  className="font-poppins flex h-full min-w-9 items-center justify-center border-x border-[#418964]/20 text-[#418964]"
                  style={{ fontSize: "var(--text-fluid-sm)" }}
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() => setQuantity((current) => Math.min(99, current + 1))}
                  className="font-poppins flex h-full w-8 items-center justify-center text-[#418964] transition hover:bg-[#f4faf6] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center" style={{ gap: "var(--spacing-fluid-2)" }}>
          <button
            type="button"
            onClick={onClose}
            className="font-poppins flex items-center justify-center rounded-[30px] bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3]"
            style={pillButtonStyle}
          >
            Cancelar
          </button>
          <button
            type="button"
            data-cy="cardapio-confirmar-item"
            onClick={() => onSubmit({ quantity, sharedUids })}
            className="font-poppins flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc]"
            style={pillButtonStyle}
          >
            {submitLabel}
          </button>
        </div>
      </div>

      {showList ? (
        <div className="absolute inset-0 z-10 flex items-center justify-center" style={{ padding: "var(--spacing-fluid-5)" }}>
          <button
            type="button"
            aria-label="Fechar lista"
            onClick={() => setShowList(false)}
            className="absolute inset-0 bg-[#1f2b24]/30"
          />
          <div
            className="relative flex max-h-full w-full flex-col overflow-y-auto rounded-[10px_10px_25px_10px] bg-white shadow-[0_20px_50px_rgba(31,43,36,0.25)]"
            style={{ padding: "var(--spacing-fluid-5)", gap: "var(--spacing-fluid-3)" }}
          >
            <h4 className="font-poppins text-center font-black text-[#e5786c]" style={{ fontSize: "20px" }}>
              Lista de Participantes
            </h4>

            {participants.length === 0 ? (
              <p className="font-poppins text-center text-[#9bb0a4]" style={{ fontSize: "var(--text-fluid-sm)" }}>
                Ninguém mais na mesa.
              </p>
            ) : (
              <ul className="flex flex-col" style={{ gap: "var(--spacing-fluid-2)" }}>
                {participants.map((participant) => {
                  const added = sharedUids.includes(participant.uid);
                  return (
                    <li
                      key={participant.uid}
                      className="flex items-center justify-between rounded-[10px] border border-[#418964]/20 bg-white"
                      style={{ padding: "var(--spacing-fluid-2)", gap: "var(--spacing-fluid-2)" }}
                    >
                      <div className="flex min-w-0 items-center" style={{ gap: "var(--spacing-fluid-2)" }}>
                        <Avatar
                          name={participant.displayName}
                          avatarUrl={participant.avatarUrl}
                          style={{ height: "2.25rem", width: "2.25rem" }}
                          textStyle={{ fontSize: "var(--text-fluid-xs)" }}
                        />
                        <div className="min-w-0">
                          <p className="font-poppins truncate font-semibold text-[#418964]" style={{ fontSize: "var(--text-fluid-sm)" }}>
                            {participant.displayName}
                          </p>
                          <p className="font-poppins text-[#9bb0a4]" style={{ fontSize: "var(--text-fluid-xs)" }}>
                            Participante
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => toggle(participant.uid)}
                        aria-label={added ? `Tirar ${participant.displayName}` : `Dividir com ${participant.displayName}`}
                        aria-pressed={added}
                        className={`flex shrink-0 items-center justify-center rounded-full transition ${
                          added
                            ? "bg-[#418964] text-white"
                            : "border border-[#418964] text-[#418964] hover:bg-[#cde9da]"
                        }`}
                        style={{ height: "2rem", width: "2rem" }}
                      >
                        <i aria-hidden="true" className={`pi ${added ? "pi-check" : "pi-plus"}`} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <button
              type="button"
              onClick={() => setShowList(false)}
              className="font-poppins flex items-center justify-center self-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc]"
              style={pillButtonStyle}
            >
              Pronto
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
