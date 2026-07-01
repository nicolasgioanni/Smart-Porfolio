import type { PortfolioLink } from "@/content/types";
import { GlassIconLink } from "@/components/glass/GlassIconLink";

type SocialLinkGroupProps = {
  links: PortfolioLink[];
  compact?: boolean;
  label?: string;
};

export function SocialLinkGroup({ compact = false, label = "Primary links", links }: SocialLinkGroupProps) {
  if (links.length === 0) return null;

  return (
    <div aria-label={label} className={["social-link-group", compact ? "social-link-group--compact" : ""].filter(Boolean).join(" ")}>
      {links.map((link) => (
        <GlassIconLink key={link.id} kind={link.kind} label={link.label} showLabel={!compact} url={link.url} />
      ))}
    </div>
  );
}