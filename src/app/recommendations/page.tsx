import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { RecommendationsList } from "@/components/portfolio/RecommendationsList";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectRecommendationDetailContent } from "@/lib/content/selectHomeContent";

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), "Recommendations", "Professional recommendations and social proof with source links when available.");
}

export default function RecommendationsPage() {
  const content = getPortfolioContent();
  const recommendations = selectRecommendationDetailContent(content);

  return (
    <PageContainer
      title="Recommendations"
      description="Read how professors, managers, and teammates describe my engineering, collaboration, and communication below."
      className="page-container--recommendations"
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <RecommendationsList items={recommendations} />
    </PageContainer>
  );
}
