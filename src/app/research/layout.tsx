import type { ReactNode } from "react";
import { ResearchNoScriptRouteGate } from "@/components/layout/ResearchNoScriptRouteGate";
import { ResearchShowcase } from "@/features/research/components/ResearchShowcase";
import { selectResearchDetailContent } from "@/features/research/content/selectResearchDetailContent";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

export default function ResearchLayout({ children }: Readonly<{ children: ReactNode }>) {
  const content = getPortfolioContent();

  return (
    <ResearchNoScriptRouteGate fallback={<ResearchShowcase items={selectResearchDetailContent(content)} motionEnabled={false} />}>
      {children}
    </ResearchNoScriptRouteGate>
  );
}
