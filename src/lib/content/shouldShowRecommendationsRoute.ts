import type { SiteSettings } from "@/content/types";

type RecommendationRouteSettings = Pick<SiteSettings, "enableRecommendations" | "showEmptyRecommendations">;

type RecommendationRouteContent = {
  recommendations: readonly unknown[];
  siteSettings: RecommendationRouteSettings;
};

export function hasRecommendations(recommendations: readonly unknown[]): boolean {
  return recommendations.length > 0;
}

export function shouldShowRecommendationsRoute(content: RecommendationRouteContent): boolean {
  return (
    content.siteSettings.enableRecommendations !== false &&
    (hasRecommendations(content.recommendations) || content.siteSettings.showEmptyRecommendations === true)
  );
}
