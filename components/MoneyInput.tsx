"use client";

import type { ChangeEvent, InputHTMLAttributes } from "react";

const fmt = new Intl.NumberFormat("pt-BR", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

type MoneyInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "value" | "onChange" | "type" | "inputMode"
> & {
  /** Valor em reais. */
  value: number;
  /** Recebe o novo valor em reais. */
  onChange: (reais: number) => void;
};

/**
 * Campo de valor monetário (BRL) com máscara de "acumulador de centavos":
 * o usuário digita só dígitos e a vírgula/centavos aparecem sozinhos
 * (ex.: digitar 4500 → "45,00"). Sem necessidade de digitar a vírgula.
 */
export default function MoneyInput({
  value,
  onChange,
  placeholder = "0,00",
  ...rest
}: MoneyInputProps) {
  const cents = Math.round((Number.isFinite(value) ? value : 0) * 100);
  const display = cents > 0 ? fmt.format(cents / 100) : "";

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const digits = event.target.value.replace(/\D/g, "");
    onChange(digits ? Number.parseInt(digits, 10) / 100 : 0);
  }

  return (
    <input
      {...rest}
      dataa-cy="valoritem"
      data-cy="taxa"
      type="text"
      inputMode="numeric"
      value={display}
      placeholder={placeholder}
      onChange={handleChange}
    />
  );
}
