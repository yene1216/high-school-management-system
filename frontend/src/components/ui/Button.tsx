import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";
const VARIANT: Record<Variant, string> = { primary: "btn-primary", secondary: "btn-secondary", danger: "btn-danger", ghost: "btn-ghost" };

export function Button({ variant = "primary", small, loading, children, className = "", disabled, type = "button", ...rest }:
  ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean; loading?: boolean }) {
  return (
    <button type={type} disabled={disabled || loading} className={`btn ${VARIANT[variant]} ${small ? "btn-sm" : ""} ${className}`} {...rest}>
      {loading && <span aria-hidden className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />}
      {children}
    </button>
  );
}
