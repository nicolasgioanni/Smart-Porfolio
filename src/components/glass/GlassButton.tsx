import type { AnchorHTMLAttributes, ReactNode } from "react";
import { getExternalLinkProps } from "@/lib/content/displayHelpers";

type GlassButtonProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
  variant?: "primary" | "secondary" | "ghost";
};

export function GlassButton({ children, className, href, variant = "secondary", ...props }: GlassButtonProps) {
  return (
    <a className={["glass-button", `glass-button--${variant}`, className].filter(Boolean).join(" ")} href={href} {...getExternalLinkProps(href)} {...props}>
      {children}
    </a>
  );
}