import type { ReactNode } from "react";
import { GlassSurface } from "@/components/glass/GlassSurface";
import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { SectionHeader } from "@/components/layout/SectionHeader";

export type PageIntroVariant = "plain" | "panel";

type PageIntroProps = {
  accessory?: ReactNode;
  className?: string;
  description?: string;
  eyebrow?: string;
  motionEnabled?: boolean;
  title: string;
  variant?: PageIntroVariant;
};

export function PageIntro({
  accessory,
  className,
  description,
  eyebrow,
  motionEnabled = true,
  title,
  variant = "plain"
}: PageIntroProps) {
  const header = <SectionHeader description={description} eyebrow={eyebrow} headingLevel="h1" title={title} variant="page" />;

  return (
    <ScrollReveal
      as="div"
      className={["page-intro", `page-intro--${variant}`, className].filter(Boolean).join(" ")}
      enabled={motionEnabled}
    >
      {variant === "panel" ? (
        <GlassSurface
          className={["page-intro__surface", accessory ? "page-intro__surface--with-accessory" : null]
            .filter(Boolean)
            .join(" ")}
          variant="strong"
        >
          {header}
          {accessory ? <div className="page-intro__accessory">{accessory}</div> : null}
        </GlassSurface>
      ) : (
        <>
          {header}
          {accessory ? <div className="page-intro__accessory">{accessory}</div> : null}
        </>
      )}
    </ScrollReveal>
  );
}
