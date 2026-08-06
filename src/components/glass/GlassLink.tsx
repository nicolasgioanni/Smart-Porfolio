import type { AnchorHTMLAttributes, ReactNode } from "react";
import { SmartLink } from "@/components/navigation/SmartLink";

type GlassLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  children: ReactNode;
  href: string;
};

export function GlassLink({ children, className, href, ...props }: GlassLinkProps) {
  return (
    <SmartLink className={["glass-link", "hover-base-1", "hover-base-1--compact", className].filter(Boolean).join(" ")} href={href} {...props}>
      {children}
      <span aria-hidden="true" className="glass-link__arrow">
        &gt;
      </span>
    </SmartLink>
  );
}
