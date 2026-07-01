import type { ReactNode } from "react";
import { PortfolioCard } from "@/components/portfolio/PortfolioCard";

export function ResumePanel({ children }: { children: ReactNode }) {
  return (
    <PortfolioCard as="section" className="resume-panel" variant="cta">
      {children}
    </PortfolioCard>
  );
}
