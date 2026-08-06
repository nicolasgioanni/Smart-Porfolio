import type { AnchorHTMLAttributes } from "react";
import { LinkIcon } from "@/components/icons/LinkIcon";
import { SmartLink } from "@/components/navigation/SmartLink";
import { getLinkKind } from "@/lib/content/displayHelpers";

type GlassIconLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  label: string;
  url: string;
  kind?: string;
  showLabel?: boolean;
};

export function GlassIconLink({ className, kind, label, showLabel = true, url, ...props }: GlassIconLinkProps) {
  const resolvedKind = kind ?? getLinkKind({ label, url });

  return (
    <SmartLink
      aria-label={showLabel ? undefined : label}
      className={["glass-icon-link", showLabel ? "glass-icon-link--labeled" : "", "hover-base-1", "hover-base-1--compact", className]
        .filter(Boolean)
        .join(" ")}
      href={url}
      {...props}
    >
      <LinkIcon kind={resolvedKind} />
      {showLabel ? <span>{label}</span> : null}
    </SmartLink>
  );
}
