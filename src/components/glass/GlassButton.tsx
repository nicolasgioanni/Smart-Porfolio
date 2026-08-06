import type { AnchorHTMLAttributes, ReactNode } from "react";
import { SmartLink } from "@/components/navigation/SmartLink";

type GlassButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function GlassButton({ children, className, href, variant = "secondary", ...props }: GlassButtonProps) {
  return (
    <SmartLink
      className={["glass-button", `glass-button--${variant}`, "hover-base-1", variant === "primary" ? "hover-base-1--solid" : null, className]
        .filter(Boolean)
        .join(" ")}
      href={href}
      {...props}
    >
      {children}
    </SmartLink>
  );
}
