import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import { RecommendationsList } from "@/components/portfolio/recommendations/RecommendationsList";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";
import { selectRecommendationDetailContent } from "@/lib/content/selectRecommendationContent";

const recommendationsHeader = routeHeaderContent[siteRoutes.recommendations];

export function generateMetadata(): Metadata {
  return createPageMetadata(getPortfolioContent(), {
    pathname: siteRoutes.recommendations,
    title: recommendationsHeader.title,
    description: "Professional recommendations and social proof with source links when available."
  });
}

export default function RecommendationsPage() {
  const content = getPortfolioContent();
  const recommendations = selectRecommendationDetailContent(content);

  return (
    <PageContainer
      title={recommendationsHeader.title}
      description={recommendationsHeader.description}
      className="page-container--recommendations"
      introVariant="panel"
      motionEnabled={content.siteSettings.enableScrollMotion}
    >
      <RecommendationsList items={recommendations} />
    </PageContainer>
  );
}
