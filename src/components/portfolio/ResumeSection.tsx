import type { ReactNode } from "react";
import { SectionHeader } from "@/components/layout/SectionHeader";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";

export function ResumeSection({ children, title }: { children: ReactNode; title: string }) {
  return (
    <PortfolioCard as="section" className="resume-section" variant="detail">
      <SectionHeader headingLevel="h2" title={title} variant="compact" />
      {children}
    </PortfolioCard>
  );
}
