import type { ReactNode } from "react";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { SectionHeader } from "@/components/layout/SectionHeader";
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
        <SectionHeader actionHref={href} actionLabel={linkLabel} className="home-section__header" description={description} eyebrow={eyebrow} title={title} />
        {children}
      </GlassSurface>
    </CompressOnScrollSection>
  );
}
