/**
 * Cálculo financeiro em CENTAVOS + MAIOR RESTO.
 *
 * ⚠️ Mantenha em sincronia com `lib/billing.ts` do app. É uma cópia porque o
 * deploy das Cloud Functions empacota apenas a pasta `functions/`; o módulo é
 * puro (sem dependências) justamente para poder rodar nos dois lados.
 */

export type BillItem = {
  price: number;
  consumerUids: string[];
  createdAtMs?: number | null;
};


export type RoundOptions = {
  settledThroughMs?: number | null;
  couvertSettled?: boolean;
};

export function isItemInCurrentRound(
  item: BillItem,
  settledThroughMs: number | null,
): boolean {
  if (settledThroughMs === null) {
    return true;
  }
  if (item.createdAtMs === null || item.createdAtMs === undefined) {
    return true;
  }
  return item.createdAtMs > settledThroughMs;
}

export function reaisToCents(reais: number): number {
  if (!Number.isFinite(reais)) {
    return 0;
  }
  return Math.round(reais * 100);
}

export function centsToReais(cents: number): number {
  return cents / 100;
}

export function splitCents(totalCents: number, parts: number): number[] {
  if (parts <= 0) {
    return [];
  }

  const sign = totalCents < 0 ? -1 : 1;
  const total = Math.abs(Math.trunc(totalCents));
  const base = Math.floor(total / parts);
  const remainder = total - base * parts;

  return Array.from({ length: parts }, (_, index) =>
    sign * (base + (index < remainder ? 1 : 0)),
  );
}

export function itemSharesByUid(
  priceReais: number,
  consumerUids: string[],
): Map<string, number> {
  const uids = Array.from(new Set(consumerUids)).sort();
  const shares = splitCents(reaisToCents(priceReais), uids.length);

  const result = new Map<string, number>();
  uids.forEach((uid, index) => result.set(uid, shares[index] ?? 0));
  return result;
}

export function userItemShareCents(uid: string, item: BillItem): number {
  if (!item.consumerUids.includes(uid)) {
    return 0;
  }
  return itemSharesByUid(item.price, item.consumerUids).get(uid) ?? 0;
}

export function userSubtotalCents(
  uid: string,
  items: BillItem[],
  couvertReais = 0,
  round: RoundOptions = {},
): number {
  const settledThroughMs = round.settledThroughMs ?? null;

  let cents = round.couvertSettled === true ? 0 : reaisToCents(couvertReais);
  for (const item of items) {
    if (!isItemInCurrentRound(item, settledThroughMs)) {
      continue;
    }
    cents += userItemShareCents(uid, item);
  }
  return cents;
}

export function tipCents(subtotalCents: number, tipPercent: number): number {
  if (!Number.isFinite(tipPercent) || tipPercent <= 0) {
    return 0;
  }
  return Math.round((subtotalCents * tipPercent) / 100);
}

export function userTotalCents(
  subtotalCents: number,
  tipPercent: number,
  tipEnabled: boolean,
): number {
  return subtotalCents + (tipEnabled ? tipCents(subtotalCents, tipPercent) : 0);
}
