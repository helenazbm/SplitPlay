"use client";

import { useAuth } from "@/lib/contexts/AuthContext";
import {
  createTableItem,
  deleteTableItem,
  subscribeToTableItems,
  subscribeToTableParticipants,
  updateTableItem,
} from "@/lib/services/itemService";
import type { TableItemWithId } from "@/lib/types/item";
import { useParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

type MesaPedidosTabProps = {
  isCreateOpen: boolean;
  onCloseCreate: () => void;
};

type ParticipantOption = {
  uid: string;
  displayName: string;
};

export default function MesaPedidosTab({
  isCreateOpen,
  onCloseCreate,
}: MesaPedidosTabProps) {
  const params = useParams<{ tableId: string }>();
  const tableId = params.tableId;
  const { user } = useAuth();

  const [items, setItems] = useState<TableItemWithId[]>([]);
  const [participants, setParticipants] = useState<ParticipantOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [draftName, setDraftName] = useState("");
  const [draftPrice, setDraftPrice] = useState("");
  const [draftConsumerUid, setDraftConsumerUid] = useState("");
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editPrice, setEditPrice] = useState("");
  const [editConsumerUid, setEditConsumerUid] = useState("");

  useEffect(() => {
    setLoading(true);
    setError(null);

    const stopItems = subscribeToTableItems(
      tableId,
      (nextItems) => {
        setItems(nextItems);
        setLoading(false);
      },
      (nextError) => {
        setError(nextError.message);
        setLoading(false);
      },
    );

    const stopParticipants = subscribeToTableParticipants(
      tableId,
      setParticipants,
      (nextError) => setError(nextError.message),
    );

    return () => {
      stopItems();
      stopParticipants();
    };
  }, [tableId]);

  const participantOptions = useMemo(
    () =>
      participants.length > 0
        ? participants
        : user
          ? [{ uid: user.uid, displayName: user.displayName ?? "Eu" }]
          : [],
    [participants, user],
  );

  useEffect(() => {
    if (!draftConsumerUid && participantOptions.length > 0) {
      setDraftConsumerUid(participantOptions[0].uid);
    }
  }, [draftConsumerUid, participantOptions]);

  const total = useMemo(
    () => items.reduce((sum, item) => sum + item.price, 0),
    [items],
  );

  async function handleCreateItem(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!draftName.trim() || !draftConsumerUid) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await createTableItem(tableId, {
        name: draftName,
        price: Number(draftPrice),
        consumerUid: draftConsumerUid,
      });
      setDraftName("");
      setDraftPrice("");
      onCloseCreate();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Não foi possível adicionar o item.");
    } finally {
      setSaving(false);
    }
  }

  function beginEdit(item: TableItemWithId) {
    if (item.ownerUid !== user?.uid) {
      return;
    }

    setEditingItemId(item.id);
    setEditName(item.name);
    setEditPrice(String(item.price));
    setEditConsumerUid(item.consumerUid);
  }

  async function handleSaveEdit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editingItemId) {
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await updateTableItem(tableId, editingItemId, {
        name: editName,
        price: Number(editPrice),
        consumerUid: editConsumerUid,
      });
      setEditingItemId(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Não foi possível editar o item.");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(itemId: string) {
    setSaving(true);
    setError(null);

    try {
      await deleteTableItem(tableId, itemId);
      if (editingItemId === itemId) {
        setEditingItemId(null);
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : "Não foi possível excluir o item.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div
      className="flex flex-1 flex-col"
      role="tabpanel"
      aria-label="Pedidos"
      style={{ gap: "var(--spacing-fluid-4)" }}
    >
      <div className="flex items-start justify-between" style={{ gap: "var(--spacing-fluid-2)" }}>
        <div>
          <h2 className="font-bagel text-[#418964]" style={{ fontSize: "var(--text-fluid-lg)" }}>
            Itens da mesa
          </h2>
          <p
            className="font-poppins text-[#64835b]"
            style={{ marginTop: "var(--spacing-fluid-1)", fontSize: "var(--text-fluid-xs)" }}
          >
            Lista em tempo real com consumidor, edição e exclusão restritas ao dono.
          </p>
        </div>

        <span
          className="font-poppins rounded-full bg-[#cde9da] px-3 py-1 font-semibold text-[#418964]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          Total {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(total)}
        </span>
      </div>

      <div
        className="rounded-[20px] border border-[#418964]/20 bg-white p-4"
        style={{ display: isCreateOpen ? "grid" : "none", gap: "var(--spacing-fluid-3)" }}
      >
        <h3 className="font-bagel text-[#418964]" style={{ fontSize: "var(--text-fluid-xl)" }}>
          Adicionar item
        </h3>

        <form className="grid" onSubmit={handleCreateItem} style={{ gap: "var(--spacing-fluid-2)" }}>
          <label className="grid gap-1 font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
            Nome do item
            <input
              value={draftName}
              onChange={(event) => setDraftName(event.target.value)}
              className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
              placeholder="Ex.: Suco de laranja"
            />
          </label>

          <div className="grid grid-cols-2" style={{ gap: "var(--spacing-fluid-2)" }}>
            <label className="grid gap-1 font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
              Valor
              <input
                type="number"
                min="0"
                step="0.01"
                value={draftPrice}
                onChange={(event) => setDraftPrice(event.target.value)}
                className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
                placeholder="0,00"
              />
            </label>

            <label className="grid gap-1 font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
              Consumidor
              <select
                value={draftConsumerUid}
                onChange={(event) => setDraftConsumerUid(event.target.value)}
                className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
              >
                {participantOptions.map((participant) => (
                  <option key={participant.uid} value={participant.uid}>
                    {participant.displayName}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="flex items-center justify-end" style={{ gap: "var(--spacing-fluid-2)" }}>
            <button
              type="button"
              onClick={onCloseCreate}
              className="font-poppins rounded-[30px] border border-[#418964] px-5 font-semibold text-[#418964]"
              style={{ height: "var(--height-control-sm)", fontSize: "var(--text-fluid-xs)" }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={saving}
              className="font-poppins flex items-center rounded-[30px] bg-[#418964] px-5 font-semibold text-white transition hover:bg-[#367050] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ height: "var(--height-control-sm)", fontSize: "var(--text-fluid-xs)", gap: "0.35rem" }}
            >
              <i aria-hidden="true" className="pi pi-plus" />
              {saving ? "Salvando..." : "Adicionar item"}
            </button>
          </div>
        </form>
      </div>

      {error ? (
        <p
          className="font-poppins rounded-[10px_10px_25px_10px] border border-[#fdebd0] bg-[#fff7e7] px-4 py-3 text-[#8a6d3b]"
          style={{ fontSize: "var(--text-fluid-xs)" }}
        >
          {error}
        </p>
      ) : null}

      <div className="flex items-center justify-between" style={{ gap: "var(--spacing-fluid-2)" }}>
        <span className="font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
          {loading ? "Carregando itens..." : `${items.length} itens cadastrados`}
        </span>
      </div>

      <div className="flex flex-col" style={{ gap: "var(--spacing-fluid-2)" }}>
        {items.map((item) => {
          const isOwner = item.ownerUid === user?.uid;
          const isEditing = editingItemId === item.id;
          const consumerLabel =
            participantOptions.find((participant) => participant.uid === item.consumerUid)?.displayName ??
            item.consumerUid;

          return (
            <article
              key={item.id}
              className="rounded-[10px_10px_25px_10px] border border-[#418964]/20 bg-white p-4 shadow-sm"
            >
              <div className="flex items-start justify-between" style={{ gap: "var(--spacing-fluid-2)" }}>
                <div className="min-w-0">
                  <h3 className="font-poppins truncate font-semibold text-[#418964]" style={{ fontSize: "var(--text-fluid-sm)" }}>
                    {item.name}
                  </h3>
                  <p
                    className="font-poppins text-[#64835b]"
                    style={{ marginTop: "var(--spacing-fluid-1)", fontSize: "var(--text-fluid-xs)" }}
                  >
                    Consumidor: {consumerLabel}
                  </p>
                </div>

                <strong className="font-poppins shrink-0 text-[#418964]" style={{ fontSize: "var(--text-fluid-sm)" }}>
                  {new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(item.price)}
                </strong>
              </div>

              <div className="flex items-center justify-between" style={{ marginTop: "var(--spacing-fluid-2)", gap: "var(--spacing-fluid-2)" }}>
                <span className="font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
                  {isOwner ? "Seu item" : "Somente leitura"}
                </span>

                <div className="flex items-center" style={{ gap: "var(--spacing-fluid-2)" }}>
                  <button
                    type="button"
                    disabled={!isOwner || saving}
                    onClick={() => beginEdit(item)}
                    className="font-poppins rounded-[30px] border border-[#418964] px-4 font-semibold text-[#418964] transition hover:bg-[#cde9da] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ height: "2.25rem", fontSize: "var(--text-fluid-xs)" }}
                  >
                    Editar item
                  </button>
                  <button
                    type="button"
                    disabled={!isOwner || saving}
                    onClick={() => void handleDelete(item.id)}
                    className="font-poppins rounded-[30px] bg-[#f8d7da] px-4 font-semibold text-[#8a3b43] transition hover:bg-[#f4c6cd] disabled:cursor-not-allowed disabled:opacity-50"
                    style={{ height: "2.25rem", fontSize: "var(--text-fluid-xs)" }}
                  >
                    Excluir item
                  </button>
                </div>
              </div>

              {isEditing ? (
                <form className="mt-3 grid" onSubmit={handleSaveEdit} style={{ gap: "var(--spacing-fluid-2)" }}>
                  <label className="grid gap-1 font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
                    Nome do item
                    <input
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
                    />
                  </label>

                  <div className="grid grid-cols-2" style={{ gap: "var(--spacing-fluid-2)" }}>
                    <label className="grid gap-1 font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
                      Valor
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={editPrice}
                        onChange={(event) => setEditPrice(event.target.value)}
                        className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
                      />
                    </label>

                    <label className="grid gap-1 font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-xs)" }}>
                      Consumidor
                      <select
                        value={editConsumerUid}
                        onChange={(event) => setEditConsumerUid(event.target.value)}
                        className="rounded-[10px_10px_25px_10px] border border-[#418964]/25 bg-white px-4 py-3 text-[#1f2b24] outline-none focus:border-[#418964]"
                      >
                        {participantOptions.map((participant) => (
                          <option key={participant.uid} value={participant.uid}>
                            {participant.displayName}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex items-center justify-end" style={{ gap: "var(--spacing-fluid-2)" }}>
                    <button
                      type="button"
                      onClick={() => setEditingItemId(null)}
                      className="font-poppins rounded-[30px] border border-[#418964] px-4 font-semibold text-[#418964]"
                      style={{ height: "2.25rem", fontSize: "var(--text-fluid-xs)" }}
                    >
                      Cancelar
                    </button>
                    <button
                      type="submit"
                      disabled={saving}
                      className="font-poppins rounded-[30px] bg-[#418964] px-4 font-semibold text-white transition hover:bg-[#367050] disabled:cursor-not-allowed disabled:opacity-60"
                      style={{ height: "2.25rem", fontSize: "var(--text-fluid-xs)" }}
                    >
                      {saving ? "Salvando..." : "Salvar alteração"}
                    </button>
                  </div>
                </form>
              ) : null}
            </article>
          );
        })}

        {!loading && items.length === 0 ? (
          <div className="rounded-[10px_10px_25px_10px] border border-dashed border-[#418964]/25 bg-white p-6 text-center">
            <p className="font-poppins text-[#64835b]" style={{ fontSize: "var(--text-fluid-sm)" }}>
              Nenhum item lançado ainda.
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
