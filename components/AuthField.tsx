"use client";

import {
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

type AuthFieldProps = InputHTMLAttributes<HTMLInputElement> & {
  label: string;
  icon?: ReactNode;
  trailing?: ReactNode;
};

export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(
  function AuthField(
    { label, icon, trailing, className = "", id, ...inputProps },
    ref,
  ) {
    const inputId = id ?? inputProps.name;
    return (
      <div className={`flex flex-col ${className}`}>
        <label
          htmlFor={inputId}
          className="font-poppins text-[#64835b]"
          style={{ fontSize: "var(--text-fluid-sm)" }}
        >
          {label}
        </label>

        <div
          style={{
            height: "var(--height-control-md)",
            paddingInlineStart: "var(--spacing-fluid-4)",
            paddingInlineEnd: trailing ? "var(--spacing-fluid-1)" : "var(--spacing-fluid-4)",
            marginTop: "var(--spacing-fluid-1)",
          }}
          className="flex items-center rounded-[10px_10px_25px_10px] border border-[#418964] focus-within:ring-2 focus-within:ring-[#418964]/20"
        >
          <input
            ref={ref}
            id={inputId}
            {...inputProps}
            style={{ fontSize: "var(--text-fluid-base)" }}
            className="font-poppins min-w-0 flex-1 bg-transparent text-[#418964] outline-none placeholder:text-[#64835b]/50"
          />
          {trailing ? (
            <span className="ml-2 shrink-0">{trailing}</span>
          ) : icon ? (
            <span
              className="ml-2 shrink-0 text-[#b1c1ad]"
              style={{ fontSize: "var(--text-fluid-lg)" }}
            >
              {icon}
            </span>
          ) : null}
        </div>
      </div>
    );
  },
);

export default AuthField;
