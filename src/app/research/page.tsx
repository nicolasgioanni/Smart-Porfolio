import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { ResearchList } from "@/components/portfolio/ResearchList";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectResearchDetailContent } from "@/lib/content/selectHomeContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.research,
    title: "Research",
    description: "Research work, methods, impact, supporting links, and technical context."
  });
}

export default function ResearchPage() {
  const content = getPortfolioContent();
  const researchItems = selectResearchDetailContent(content);

  return (
    <PageContainer
      title="Research"
      description="I research computer vision for microscopy, adversarial machine learning, and automated biology workflows—explore it below."
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ResearchList items={researchItems} variant="detail" />
    </PageContainer>
  );
}
