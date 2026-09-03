import type { Metadata } from "next";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import { ResearchShowcase } from "@/components/portfolio/research/ResearchShowcase";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectResearchDetailContent } from "@/lib/content/selectDetailContent";

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
