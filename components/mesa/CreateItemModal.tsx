"use client";

import { useState } from "react";

import Avatar from "@/components/Avatar";
import MoneyInput from "@/components/MoneyInput";
import { FOOD_ICONS, foodIconSrc } from "@/lib/foodIcons";

// Ícone pré-definido exibido ao abrir o modal (usuário pode trocar no editar).
const DEFAULT_ICON = FOOD_ICONS[0]?.key ?? null;

export type CreateItemParticipant = {
  uid: string;
  displayName: string;
  avatarUrl?: string | null;
};

type CreateItemModalProps = {
  participants: CreateItemParticipant[];
  currentUid: string;
  saving: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (data: {
    name: string;
    price: number;
    quantity: number;
    consumerUids: string[];
    icon: string | null;
  }) => void;
  /** Título e rótulo do botão de confirmar (default: criação). */
  title?: string;
  submitLabel?: string;
  /** Valores iniciais — usados na edição de um item existente. */
  initialName?: string;
  initialPrice?: number;
  initialQuantity?: number;
  initialIcon?: string | null;
  initialSharedUids?: string[];
};

/**
 * Modal "Adicionar Itens" — fiel à tela do Figma: item selecionado (ícone +
 * nome + preço), seletor de ícone de comida, valor e com quem dividir (divisão
 * igual; o próprio usuário sempre incluído).
 */
export default function CreateItemModal({
  participants,
  currentUid,
  saving,
  error,
  onClose,
  onSubmit,
  title = "Adicionar Itens",
  submitLabel = "Adicionar",
  initialName = "",
  initialPrice,
  initialQuantity = 1,
  initialIcon = DEFAULT_ICON,
  initialSharedUids = [],
}: CreateItemModalProps) {
  const [name, setName] = useState(initialName);
  const [price, setPrice] = useState(
    initialPrice !== undefined ? String(initialPrice) : "",
  );
  const [icon, setIcon] = useState<string | null>(initialIcon);
  const [quantity, setQuantity] = useState(initialQuantity);
  const [sharedUids, setSharedUids] = useState<string[]>(initialSharedUids);
  const [showList, setShowList] = useState(false);
  const [editingIcon, setEditingIcon] = useState(false);
  // Estado de sharedUids ao abrir a lista, para o "Cancelar" reverter.
  const [listSnapshot, setListSnapshot] = useState<string[]>([]);

  function openList() {
    setListSnapshot(sharedUids);
    setShowList(true);
  }

  function cancelList() {
    setSharedUids(listSnapshot);
    setShowList(false);
  }

  const priceValue = Number(price);
  const totalPrice = priceValue * quantity;
  const hasValidPrice = Number.isFinite(priceValue) && priceValue > 0;
  const canSubmit = name.trim().length > 0 && hasValidPrice && !saving;

  // O dono (currentUid) entra sempre; os cards mostram só os demais.
  const others = participants.filter((p) => p.uid !== currentUid);
  const selectedOthers = others.filter((p) => sharedUids.includes(p.uid));

  function toggle(uid: string) {
    setSharedUids((current) =>
      current.includes(uid)
        ? current.filter((id) => id !== uid)
        : [...current, uid],
    );
  }

  function handleSubmit() {
    if (!canSubmit) {
      return;
    }
    onSubmit({
      name: name.trim(),
      price: totalPrice,
      quantity,
      consumerUids: [currentUid, ...sharedUids],
      icon,
    });
  }

  return (
    <div
      className="fixed inset-0 z-50 mx-auto flex w-full max-w-[420px] items-center justify-center"
      style={{ padding: "var(--spacing-fluid-5)" }}
      role="dialog"
      aria-modal="true"
      aria-label="Adicionar Itens"
    >
      <button
        type="button"
        aria-label="Fechar"
        onClick={onClose}
        className="absolute inset-0 bg-[#1f2b24]/40"
      />

      <div
        className="relative flex max-h-full w-full flex-col overflow-y-auto rounded-[10px_10px_25px_10px] bg-white shadow-[0_20px_50px_rgba(31,43,36,0.25)]"
        style={{
          padding: "var(--spacing-fluid-5)",
          gap: "var(--spacing-fluid-4)",
        }}
      >
        <h3
          className="font-poppins font-black text-center text-[#e5786c]"
          style={{ fontSize: "20px" }}
        >
          {title}
        </h3>
        {/* Seletor de ícone de comida */}
        <div className="grid gap-2">

                  <label
          className="grid gap-1 font-poppins text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          Nome do item:
          <div className="relative">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Ex.: Pizza Marguerita"
              className="w-full rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 pr-12 text-[#1f2b24] outline-none focus:border-[#418964]"
            />
            <button
              type="button"
              onClick={() => setEditingIcon(true)}
              aria-label="Escolher ícone do item"
              className="absolute right-2 top-1/2 flex -translate-y-1/2 items-center justify-center rounded-full bg-[#fdf3df] transition hover:bg-[#f8e6c8]"
              style={{ height: "2rem", width: "2rem" }}
            >
              {foodIconSrc(icon) ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={foodIconSrc(icon) as string}
                  alt=""
                  aria-hidden="true"
                  className="object-contain"
                  style={{ height: "1.2rem", width: "1.2rem" }}
                />
              ) : (
                <i
                  aria-hidden="true"
                  className="pi pi-shopping-bag text-[#e5786c]"
                  style={{ fontSize: "var(--text-fluid-xs)" }}
                />
              )}
            </button>
          </div>
        </label>

        <label
          className="grid gap-1 font-poppins text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          Valor:
          <MoneyInput
            value={priceValue}
            onChange={(reais) => setPrice(String(reais))}
            placeholder="0,00"
            className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
          />
        </label>

        </div>

        {/* Dividir com (divisão igual; você sempre incluído) */}
        <div className="grid gap-2">
          <span
            className="font-poppins text-[#64835b]"
            style={{ fontSize: "var(--text-fluid-xs)" }}
          >
            Participantes:
          </span>

          {/* Cards dos participantes selecionados + card "Adicionar" (abre a
              lista). Em rolagem horizontal. O dono entra sempre na divisão. */}
          <div
            className="-mx-1 flex overflow-x-auto px-1"
            style={{ gap: "var(--spacing-fluid-2)", paddingBottom: "0.25rem" }}
          >
            {selectedOthers.map((participant) => (
              <div
                key={participant.uid}
                className="flex shrink-0 flex-col items-center rounded-lg border border-[#418964]/25 bg-white"
                style={{
                  width: "101px",
                  height: "129px",
                  padding: "var(--spacing-fluid-2)",
                  gap: "0.4rem",
                }}
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
              onClick={openList}
              aria-label="Adicionar participantes"
              className="flex shrink-0 flex-col items-center justify-center rounded-lg border border-[#418964]/25 bg-white transition hover:border-[#418964]/50"
              style={{
                width: "101px",
                height: "129px",
                gap: "0.4rem",
              }}
            >
              <i
                aria-hidden="true"
                className="pi pi-plus text-[#418964]"
                style={{ fontSize: "var(--text-fluid-lg)" }}
              />
              <span
                className="font-poppins rounded-full bg-[#cde9da] px-3 font-semibold text-[#418964]"
                style={{ fontSize: "0.6rem", paddingBlock: "0.15rem" }}
              >
                Adicionar
              </span>
            </button>
          </div>

          <div className="grid w-full gap-1">
            <span
              className="font-poppins justify-self-start text-left text-[#64835b]"
              style={{ fontSize: "var(--text-fluid-xs)" }}
            >
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
                  disabled={saving || quantity <= 1}
                  className="font-poppins flex h-full w-8 items-center justify-center text-[#418964] transition hover:bg-[#f4faf6] disabled:opacity-40"
                >
                  -
                </button>

                <span
                  className="font-poppins flex h-full min-w-9 items-center justify-center border-x border-[#418964]/20 text-[#418964]"
                  style={{ fontSize: "var(--text-fluid-sm)" }}
                >
                  {quantity}
                </span>

                <button
                  type="button"
                  aria-label="Aumentar quantidade"
                  onClick={() => setQuantity((current) => current + 1)}
                  disabled={saving}
                  className="font-poppins flex h-full w-8 items-center justify-center text-[#418964] transition hover:bg-[#f4faf6] disabled:opacity-40"
                >
                  +
                </button>
              </div>
            </div>
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
          className="flex items-center justify-center"
          style={{ gap: "var(--spacing-fluid-2)" }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="font-poppins flex items-center justify-center rounded-[30px] bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3] disabled:opacity-60"
            style={{
              width: "105px",
              height: "28px",
              fontSize: "var(--text-fluid-sm)",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="font-poppins flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc] disabled:opacity-60"
            style={{
              width: "105px",
              height: "28px",
              fontSize: "var(--text-fluid-sm)",
            }}
          >
            {saving ? "Salvando..." : submitLabel}
          </button>
        </div>
      </div>

      {/* Seletor de ícones — abre ao tocar no ícone dentro do input. */}
      {editingIcon ? (
        <div
          className="absolute inset-0 z-20 flex items-center justify-center"
          style={{ padding: "var(--spacing-fluid-5)" }}
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={() => setEditingIcon(false)}
            className="absolute inset-0 bg-[#1f2b24]/30"
          />

          <div
            className="relative flex max-h-full w-full flex-col overflow-y-auto rounded-[10px_10px_25px_10px] bg-white shadow-[0_20px_50px_rgba(31,43,36,0.25)]"
            style={{
              padding: "var(--spacing-fluid-5)",
              gap: "var(--spacing-fluid-3)",
            }}
          >
            <h4
              className="font-poppins font-black text-center text-[#e5786c]"
              style={{ fontSize: "20px" }}
            >
              Escolha um ícone
            </h4>

            <div className="grid grid-cols-6" style={{ gap: "0.5rem" }}>
              {FOOD_ICONS.map((food) => {
                const selected = icon === food.key;
                return (
                  <button
                    key={food.key}
                    type="button"
                    aria-label={food.label}
                    aria-pressed={selected}
                    title={food.label}
                    onClick={() => {
                      setIcon(food.key);
                      setEditingIcon(false);
                    }}
                    className={`flex aspect-square items-center justify-center border transition ${
                      selected
                        ? "border-[#418964] bg-[#cde9da]"
                        : "border-[#418964]/15 bg-white hover:border-[#418964]/40"
                    }`}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={food.src}
                      alt=""
                      aria-hidden="true"
                      className="object-contain"
                      style={{ height: "1.6rem", width: "1.6rem" }}
                    />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setEditingIcon(false)}
              className="font-poppins self-center flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc]"
              style={{
                width: "105px",
                height: "28px",
                fontSize: "var(--text-fluid-sm)",
              }}
            >
              Fechar
            </button>
          </div>
        </div>
      ) : null}

      {/* Lista de Participantes — abre ao tocar em "Adicionar". */}
      {showList ? (
        <div
          className="absolute inset-0 z-10 flex items-center justify-center"
          style={{ padding: "var(--spacing-fluid-5)" }}
        >
          <button
            type="button"
            aria-label="Fechar"
            onClick={cancelList}
            className="absolute inset-0 bg-[#1f2b24]/30"
          />

          <div
            className="relative flex max-h-full w-full flex-col overflow-y-auto rounded-[10px_10px_25px_10px] bg-white shadow-[0_20px_50px_rgba(31,43,36,0.25)]"
            style={{
              padding: "var(--spacing-fluid-5)",
              gap: "var(--spacing-fluid-3)",
            }}
          >
            <h4
              className="font-poppins font-black text-center text-[#e5786c]"
              style={{ fontSize: "20px" }}
            >
              Lista de Participantes
            </h4>

            {others.length === 0 ? (
              <p
                className="font-poppins text-center text-[#9bb0a4]"
                style={{ fontSize: "var(--text-fluid-sm)" }}
              >
                Ninguém mais na mesa ainda.
              </p>
            ) : (
              <ul
                className="flex flex-col"
                style={{ gap: "var(--spacing-fluid-2)" }}
              >
                {others.map((participant) => {
                  const added = sharedUids.includes(participant.uid);
                  return (
                    <li
                      key={participant.uid}
                      className="flex items-center justify-between rounded-[10px] border border-[#418964]/20 bg-white"
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
                          name={participant.displayName}
                          avatarUrl={participant.avatarUrl}
                          style={{ height: "2.25rem", width: "2.25rem" }}
                          textStyle={{ fontSize: "var(--text-fluid-xs)" }}
                        />
                        <div className="min-w-0">
                          <p
                            className="font-poppins truncate font-semibold text-[#418964]"
                            style={{ fontSize: "var(--text-fluid-sm)" }}
                          >
                            {participant.displayName}
                          </p>
                          <p
                            className="font-poppins text-[#9bb0a4]"
                            style={{ fontSize: "var(--text-fluid-xs)" }}
                          >
                            Participante
                          </p>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => toggle(participant.uid)}
                        aria-label={added ? "Remover" : "Adicionar"}
                        aria-pressed={added}
                        className={`flex shrink-0 items-center justify-center rounded-full transition ${
                          added
                            ? "bg-[#418964] text-white"
                            : "border border-[#418964] text-[#418964] hover:bg-[#cde9da]"
                        }`}
                        style={{ height: "2rem", width: "2rem" }}
                      >
                        <i
                          aria-hidden="true"
                          className={`pi ${added ? "pi-check" : "pi-plus"}`}
                        />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}

            <div
              className="flex items-center justify-center"
              style={{ gap: "var(--spacing-fluid-2)" }}
            >
              <button
                type="button"
                onClick={cancelList}
                className="font-poppins flex items-center justify-center rounded-[30px] bg-[#F1D4D3] font-semibold text-[#DA8280] transition hover:bg-[#e9c4c3]"
                style={{
                  width: "105px",
                  height: "28px",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => setShowList(false)}
                className="font-poppins flex items-center justify-center rounded-[30px] bg-[#CDE9DA] font-semibold text-[#5B9A7A] transition hover:bg-[#bbe0cc]"
                style={{
                  width: "105px",
                  height: "28px",
                  fontSize: "var(--text-fluid-sm)",
                }}
              >
                Adicionar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
