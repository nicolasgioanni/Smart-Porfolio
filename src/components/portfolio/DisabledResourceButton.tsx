import type { ButtonHTMLAttributes, ReactNode } from "react";

type DisabledResourceButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children" | "disabled" | "type"> & {
  children?: ReactNode;
  label: string;
};

/**
 * Represents a named resource that is intentionally unavailable without
 * presenting it as an interactive destination.
 */
export function DisabledResourceButton({ children, label, ...props }: DisabledResourceButtonProps) {
  return (
    <button {...props} aria-label={`${label} — not yet published`} disabled title="Not yet published" type="button">
      {children ?? label}
    </button>
  );
}
