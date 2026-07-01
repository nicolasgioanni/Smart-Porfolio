import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { ResearchList } from "@/components/portfolio/ResearchList";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectResearchDetailContent } from "@/lib/content/selectHomeContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), "Research", "Research work, methods, impact, supporting links, and technical context.");
}

export default function ResearchPage() {
  const content = getPortfolioContent();
  const researchItems = selectResearchDetailContent(content);

  return (
    <PageContainer
      eyebrow="Research"
      title="Research work"
      description="Selected research with methods, impact, supporting links, and technical context."
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <ResearchList items={researchItems} variant="detail" />
    </PageContainer>
  );
}
