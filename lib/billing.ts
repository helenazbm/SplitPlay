/**
 * Cálculo financeiro da conta — sempre em CENTAVOS (inteiros) para evitar erros
 * de ponto flutuante, com divisão por MAIOR RESTO para que a soma das partes
 * bata exatamente com o total.
 *
 * Este módulo é puro (sem Firebase/React) para ser testável e, futuramente,
 * reaproveitado no servidor (Cloud Functions) como fonte autoritativa.
 */

export type BillItem = {
  /** Preço total do item, em reais. */
  price: number;
  /** Participantes que dividem o item em partes iguais. */
  consumerUids: string[];
};

/** Converte reais (ex.: 10.5) em centavos inteiros (1050). */
export function reaisToCents(reais: number): number {
  if (!Number.isFinite(reais)) {
    return 0;
  }
  return Math.round(reais * 100);
}

/** Converte centavos inteiros (1050) em reais (10.5). */
export function centsToReais(cents: number): number {
  return cents / 100;
}

/**
 * Divide `totalCents` em `parts` partes inteiras que somam EXATAMENTE totalCents.
 * Método do maior resto: as primeiras `(totalCents % parts)` partes recebem
 * +1 centavo. Ex.: 1000 / 3 → [334, 333, 333] (soma 1000).
 */
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

/**
 * Parte (em centavos) de cada consumidor de um item dividido igualmente.
 * A ordem é estável (uids ordenados) para que o centavo extra do maior resto
 * caia sempre no mesmo participante, em qualquer cliente. Uids repetidos são
 * ignorados.
 */
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

/** Parte (em centavos) de UM participante em um item. 0 se ele não divide o item. */
export function userItemShareCents(uid: string, item: BillItem): number {
  if (!item.consumerUids.includes(uid)) {
    return 0;
  }
  return itemSharesByUid(item.price, item.consumerUids).get(uid) ?? 0;
}

/**
 * Subtotal (em centavos) de um participante: soma das suas partes nos itens que
 * consome + o couvert artístico (cobrado por pessoa). NÃO inclui gorjeta — ela é
 * opcional e aplicada à parte na etapa de pagamento.
 */
export function userSubtotalCents(
  uid: string,
  items: BillItem[],
  couvertReais = 0,
): number {
  let cents = reaisToCents(couvertReais);
  for (const item of items) {
    cents += userItemShareCents(uid, item);
  }
  return cents;
}

/**
 * Gorjeta (em centavos) sobre um subtotal, dado o percentual sugerido.
 * Arredonda para o centavo mais próximo. Opcional por participante.
 */
export function tipCents(subtotalCents: number, tipPercent: number): number {
  if (!Number.isFinite(tipPercent) || tipPercent <= 0) {
    return 0;
  }
  return Math.round((subtotalCents * tipPercent) / 100);
}

/**
 * Total (em centavos) que o participante paga: subtotal + gorjeta, somente se
 * ele optou por incluí-la (tipEnabled). Se não optou, é igual ao subtotal.
 */
export function userTotalCents(
  subtotalCents: number,
  tipPercent: number,
  tipEnabled: boolean,
): number {
  return subtotalCents + (tipEnabled ? tipCents(subtotalCents, tipPercent) : 0);
}
