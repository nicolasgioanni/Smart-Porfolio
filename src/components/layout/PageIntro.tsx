import { ScrollReveal } from "@/components/motion/ScrollReveal";
import { SectionHeader } from "@/components/layout/SectionHeader";

type PageIntroProps = {
  className?: string;
  description?: string;
  eyebrow: string;
  motionEnabled?: boolean;
  title: string;
};

export function PageIntro({ className, description, eyebrow, motionEnabled = true, title }: PageIntroProps) {
  return (
    <ScrollReveal as="div" className={["page-intro", className].filter(Boolean).join(" ")} enabled={motionEnabled}>
      <SectionHeader description={description} eyebrow={eyebrow} headingLevel="h1" title={title} variant="page" />
    </ScrollReveal>
  );
}
