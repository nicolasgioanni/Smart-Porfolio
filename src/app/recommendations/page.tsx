import type { Metadata } from "next";
import { PageContainer } from "@/components/layout/PageContainer";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import { RecommendationsList } from "@/components/portfolio/RecommendationsList";
import { createPageMetadata } from "@/lib/content/createPageMetadata";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { routeHeaderContent } from "@/lib/content/routeHeaderContent";
import { selectRecommendationDetailContent } from "@/lib/content/selectHomeContent";

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
