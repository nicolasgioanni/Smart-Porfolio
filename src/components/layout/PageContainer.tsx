import type { ReactNode } from "react";
import { PageIntro, type PageIntroVariant } from "@/components/layout/PageIntro";

type PageContainerProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  introVariant?: PageIntroVariant;
  motionEnabled?: boolean;
};

export function PageContainer({
  eyebrow,
  title,
  description,
  children,
  className,
  introVariant = "plain",
  motionEnabled = true
}: PageContainerProps) {
  return (
    <div className={["page-container", className].filter(Boolean).join(" ")}>
      <PageIntro
        description={description}
        eyebrow={eyebrow}
        motionEnabled={motionEnabled}
        title={title}
        variant={introVariant}
      />
      {children}
    </div>
  );
}
