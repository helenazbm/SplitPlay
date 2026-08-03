"use client";

import { forwardRef, type ButtonHTMLAttributes } from "react";

type EnterButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  label?: string;
};

export const EnterButton = forwardRef<HTMLButtonElement, EnterButtonProps>(
  function EnterButton(
    { className = "", label = "Entrar", type = "submit", ...props },
    ref,
  ) {
    return (
      <button
        data-cy="entrarmesa"
        ref={ref}
        type={type}
        {...props}
        style={{
          height: "var(--height-control-md)",
          paddingInline: "var(--spacing-fluid-5)",
          fontSize: "var(--text-fluid-base)",
          gap: "var(--spacing-fluid-2)",
          ...props.style,
        }}
        className={`font-poppins inline-flex min-w-[clamp(8.75rem,40cqi,11rem)] items-center justify-center rounded-[30px] bg-[#cde9da] font-semibold text-[#418964] transition hover:bg-[#bddfce] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
      >
        <span>{label}</span>
        <i
          aria-hidden="true"
          className="pi pi-arrow-right"
          style={{ fontSize: "var(--text-fluid-base)" }}
        />
      </button>
    );
  },
);

export default EnterButton;
