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
      eyebrow="Recommendations"
      title="Professional recommendations"
      description="Professional social proof with source links and context when available."
      className="page-container--recommendations"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <RecommendationsList items={recommendations} />
    </PageContainer>
  );
}
