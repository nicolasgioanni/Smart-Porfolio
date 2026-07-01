import type { ReactNode } from "react";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { GlassLink } from "@/components/glass/GlassLink";
import { CompressOnScrollSection } from "@/components/motion/CompressOnScrollSection";

type HomeOverviewSectionProps = {
  title: string;
  eyebrow?: string;
  description?: string;
  href?: string;
  linkLabel?: string;
  children: ReactNode;
  wide?: boolean;
  className?: string;
  motionEnabled?: boolean;
};

export function HomeOverviewSection({
  children,
  className,
  description,
  eyebrow,
  href,
  linkLabel,
  motionEnabled = true,
  title,
  wide = false
}: HomeOverviewSectionProps) {
  return (
    <CompressOnScrollSection className={["home-section", wide ? "home-section--wide" : "", className].filter(Boolean).join(" ")} enabled={motionEnabled}>
      <GlassSurface className="home-section__surface" variant="default">
        <header className="home-section__header">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 className="section-heading">{title}</h2>
            {description ? <p className="section-description">{description}</p> : null}
          </div>
          {href && linkLabel ? <GlassLink href={href}>{linkLabel}</GlassLink> : null}
        </header>
        {children}
      </GlassSurface>
    </CompressOnScrollSection>
  );
}
