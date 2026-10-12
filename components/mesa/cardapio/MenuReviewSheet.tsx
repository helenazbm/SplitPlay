"use client";

import { useMemo, useState } from "react";

import MenuCatalog, { MenuItemIcon, PillButton, brl } from "@/components/mesa/cardapio/MenuCatalog";
import MenuItemEditCard from "@/components/mesa/cardapio/MenuItemEditCard";
import MenuSheet, { SheetDashedButton, SheetPrimaryButton } from "@/components/mesa/cardapio/MenuSheet";
import type { MenuDraft, MenuItemWithId, MenuReadResult } from "@/lib/types/menu";

type MenuReviewSheetProps = {
  result: MenuReadResult;
  /** Itens lidos que já estavam no cardápio e foram tirados da revisão. */
  alreadyInMenu?: number;
  saving: boolean;
  error: string | null;
  onSave: (draft: MenuDraft) => void;
  onRetake: () => void;
  onClose: () => void;
};

/** Item do rascunho com id local, para reaproveitar o catálogo do cardápio. */
function toDraftItems(result: MenuReadResult): MenuItemWithId[] {
  return result.items.map((item, index) => ({
    ...item,
    id: `draft-${index}`,
    position: index,
    hidden: false,
    updatedBy: "",
    updatedAt: null,
  }));
}

/**
 * Revisão da leitura por IA (só admin), no mesmo visual do "Editar Cardápio".
 * Nada vai para o Firestore até "Salvar cardápio": preço lido errado viraria
 * cobrança errada.
 */
export default function MenuReviewSheet({
  result,
  alreadyInMenu = 0,
  saving,
  error,
  onSave,
  onRetake,
  onClose,
}: MenuReviewSheetProps) {
  const [items, setItems] = useState<MenuItemWithId[]>(() => toDraftItems(result));
  const [editingId, setEditingId] = useState<string | null>(null);

  const count = items.length;
  const intro = useMemo(() => {
    const read = `Li ${result.items.length} ${result.items.length === 1 ? "item novo" : "itens novos"}.`;
    const repeated =
      alreadyInMenu > 0
        ? ` ${alreadyInMenu} ${alreadyInMenu === 1 ? "já estava" : "já estavam"} no cardápio.`
        : "";
    const discarded =
      result.discarded > 0
        ? ` ${result.discarded} ${result.discarded === 1 ? "ficou" : "ficaram"} de fora por falta de preço legível.`
        : "";
    return `${read}${repeated}${discarded} Confira nomes e preços antes de salvar.`;
  }, [result, alreadyInMenu]);

  function update(id: string, data: { name: string; price: number }) {
    setItems((current) => current.map((item) => (item.id === id ? { ...item, ...data } : item)));
    setEditingId(null);
  }

  function remove(id: string) {
    setItems((current) => current.filter((item) => item.id !== id));
    setEditingId(null);
  }

  return (
    <MenuSheet
      title="Revisar Cardápio"
      subtitle={result.menuName}
      onClose={saving ? () => undefined : onClose}
      footer={
        <>
          {error ? (
            <p role="alert" className="font-poppins text-center text-[#c0392b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
              {error}
            </p>
          ) : null}
          <SheetDashedButton onClick={onRetake} disabled={saving}>
            <i aria-hidden="true" className="pi pi-camera" />
            Ler outra foto
          </SheetDashedButton>
          <SheetPrimaryButton
            dataCy="cardapio-salvar"
            onClick={() => onSave({ menuName: result.menuName, items })}
            disabled={saving || count === 0}
          >
            {saving ? "Salvando..." : `Salvar cardápio (${count} ${count === 1 ? "item" : "itens"})`}
          </SheetPrimaryButton>
        </>
      }
    >
      <p
        className="font-poppins rounded-[10px_10px_25px_10px] border border-[#fdebd0] bg-[#fff7e7] text-[#8a6d3b]"
        style={{ fontSize: "var(--text-fluid-xs)", padding: "10px 14px", marginBottom: "12px" }}
      >
        {intro}
      </p>

      <MenuCatalog
        items={items}
        empty={
          <p className="font-poppins text-center text-[#8f8f8f]" style={{ fontSize: "var(--text-fluid-sm)", paddingBlock: "24px" }}>
            Nenhum item para salvar. Tire outra foto, mais perto e com boa luz.
          </p>
        }
        renderItem={(item) =>
          editingId === item.id ? (
            <MenuItemEditCard
              item={item}
              saving={false}
              onSave={(data) => update(item.id, data)}
              onDelete={() => remove(item.id)}
              onClose={() => setEditingId(null)}
            />
          ) : (
            <MenuRow item={item} onEdit={() => setEditingId(item.id)} />
          )
        }
      />
    </MenuSheet>
  );
}

/** Card fechado do modo edição: ícone, nome, preço e o lápis. */
export function MenuRow({ item, onEdit }: { item: MenuItemWithId; onEdit: () => void }) {
  return (
    <div
      className="flex items-center rounded-[8px] border-[0.5px] border-[#5f9c7d] bg-[#f9f9f9]"
      style={{ minHeight: "60px", padding: "8px 16px 8px 10px", gap: "12px" }}
    >
      <MenuItemIcon item={item} size={38} />
      <div className="min-w-0 flex-1">
        <p className="font-poppins truncate font-medium text-[#5b9a7a]" style={{ fontSize: "15px" }}>
          {item.name}
        </p>
        <p className="font-poppins font-bold text-[#db8684]" style={{ fontSize: "15px" }}>
          {brl.format(item.price)}
        </p>
      </div>
      <PillButton label={`Editar ${item.name}`} onClick={onEdit}>
        <i aria-hidden="true" className="pi pi-pencil" style={{ fontSize: "10px" }} />
      </PillButton>
    </div>
  );
}
