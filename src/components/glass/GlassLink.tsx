import type { AnchorHTMLAttributes, ReactNode } from "react";
import { getExternalLinkProps } from "@/lib/content/displayHelpers";

type GlassLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
};

export function GlassLink({ children, className, href, ...props }: GlassLinkProps) {
  return (
    <a className={["glass-link", className].filter(Boolean).join(" ")} href={href} {...getExternalLinkProps(href)} {...props}>
      {children}
    </a>
  );
}