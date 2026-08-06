import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

type GlassIconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  children: ReactNode;
  label: string;
};

export const GlassIconButton = forwardRef<HTMLButtonElement, GlassIconButtonProps>(function GlassIconButton(
  { children, className, label, type = "button", ...props },
  ref
) {
  return (
    <button
      aria-label={label}
      className={["glass-icon-button", "hover-base-1", "hover-base-1--compact", className].filter(Boolean).join(" ")}
      ref={ref}
      type={type}
      {...props}
    >
      {children}
    </button>
  );
});
