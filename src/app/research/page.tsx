import type { Metadata } from "next";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import { ResearchShowcase } from "@/features/research/components/ResearchShowcase";
import { selectResearchDetailContent } from "@/features/research/content/selectResearchDetailContent";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.research,
    title: "Research",
    description: "Applied research in bioimage analysis, adversarial machine learning, and computational biology automation."
  });
}

export default function ResearchPage() {
  const content = getPortfolioContent();
  const researchItems = selectResearchDetailContent(content);

  return <ResearchShowcase items={researchItems} motionEnabled={content.siteSettings.enableScrollMotion} />;
}
