"use client";

import { useState } from "react";

import MoneyInput from "@/components/MoneyInput";
import { MenuItemIcon } from "@/components/mesa/cardapio/MenuCatalog";

type MenuItemEditCardProps = {
  item: { name: string; price: number; section: string | null };
  saving: boolean;
  error?: string | null;
  onSave: (data: { name: string; price: number }) => void;
  onDelete: () => void;
  onClose: () => void;
};

/**
 * Card aberto do "Editar Cardápio" (Figma): campos Nome e Preço sublinhados,
 * fechar no canto e "Excluir" / "Salvar" embaixo à direita.
 */
export default function MenuItemEditCard({
  item,
  saving,
  error = null,
  onSave,
  onDelete,
  onClose,
}: MenuItemEditCardProps) {
  const [name, setName] = useState(item.name);
  const [price, setPrice] = useState(item.price);

  const canSave = name.trim().length > 0 && price > 0 && !saving;

  const fieldClass =
    "font-poppins w-full border-b-[0.5px] border-[#519472] bg-[#f2f1f1] font-medium text-[#747474] outline-none focus:border-b-[1.5px]";

  return (
    <form
      className="relative flex rounded-[8px] border-[1.5px] border-[#5f9c7d] bg-[rgba(226,232,228,0.03)]"
      style={{ padding: "12px 12px 12px 8px", gap: "10px" }}
      onSubmit={(event) => {
        event.preventDefault();
        if (canSave) {
          onSave({ name: name.trim(), price });
        }
      }}
    >
      <div style={{ paddingTop: "28px" }}>
        <MenuItemIcon item={{ name, section: item.section }} size={40} />
      </div>

      <div className="flex min-w-0 flex-1 flex-col" style={{ gap: "6px", paddingRight: "28px" }}>
        <label className="grid" style={{ gap: "2px" }}>
          <span className="font-poppins font-bold text-[#db8684]" style={{ fontSize: "13px" }}>
            Nome
          </span>
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            autoFocus
            className={fieldClass}
            style={{ height: "22px", paddingInline: "4px", fontSize: "14px" }}
          />
        </label>

        <label className="grid" style={{ gap: "2px" }}>
          <span className="font-poppins font-bold text-[#db8684]" style={{ fontSize: "13px" }}>
            Preço
          </span>
          <MoneyInput
            value={price}
            onChange={setPrice}
            className={fieldClass}
            style={{ height: "22px", paddingInline: "4px", fontSize: "14px" }}
          />
        </label>

        {error ? (
          <p className="font-poppins text-[#c0392b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
            {error}
          </p>
        ) : null}

        <div className="flex justify-end" style={{ gap: "6px", marginTop: "6px", marginRight: "-28px" }}>
          <button
            type="button"
            onClick={onDelete}
            disabled={saving}
            className="font-poppins flex items-center justify-center rounded-[30px] border-[0.5px] border-[#67a184] font-semibold text-[#5f9c7d] transition hover:bg-[#eaf6ef] disabled:opacity-50"
            style={{ height: "22px", paddingInline: "12px", fontSize: "10px", gap: "4px" }}
          >
            <i aria-hidden="true" className="pi pi-trash" style={{ fontSize: "10px" }} />
            Excluir
          </button>
          <button
            type="submit"
            disabled={!canSave}
            className="font-poppins flex items-center justify-center rounded-[30px] border-[0.5px] border-[#67a184] bg-[#5f9c7d] font-semibold text-[#f2f1f1] transition hover:bg-[#518b6e] disabled:opacity-50"
            style={{ height: "22px", paddingInline: "12px", fontSize: "10px", gap: "4px" }}
          >
            <i aria-hidden="true" className="pi pi-check" style={{ fontSize: "10px" }} />
            {saving ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </div>

      <button
        type="button"
        aria-label="Fechar edição"
        onClick={onClose}
        className="absolute flex items-center justify-center rounded-full text-[#5b5b5b] transition hover:bg-black/5"
        style={{ top: "6px", right: "6px", height: "24px", width: "24px" }}
      >
        <i aria-hidden="true" className="pi pi-times" style={{ fontSize: "12px" }} />
      </button>
    </form>
  );
}
