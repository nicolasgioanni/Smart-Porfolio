import type { GeneratedPortfolioContent, RecommendationItem } from "@/content/types";
import { limitItems } from "@/lib/content/displayHelpers";
import { selectHomeCandidates, resolveItemLimit } from "@/lib/content/selectVisibleContent";
import { sortRecommendationsForDetail, sortRecommendationsForHome } from "@/lib/content/sortPortfolioContent";

export function createRecommendationExcerpt(fullQuote: string, maxLength = 190): string {
  const normalizedQuote = fullQuote.trim().replace(/\s+/g, " ");

  if (normalizedQuote.length <= maxLength) {
    return normalizedQuote;
  }

  const truncatedQuote = normalizedQuote.slice(0, maxLength).trimEnd();
  const lastSpaceIndex = truncatedQuote.lastIndexOf(" ");
  const wordSafeQuote = lastSpaceIndex > 80 ? truncatedQuote.slice(0, lastSpaceIndex) : truncatedQuote;

  return `${wordSafeQuote.replace(/[.,;:!?]$/, "")}...`;
}

export function selectHomeRecommendations(recommendations: RecommendationItem[], maxItems?: number): RecommendationItem[] {
  const sortedItems = sortRecommendationsForHome(selectHomeCandidates(recommendations));
  return limitItems(sortedItems, resolveItemLimit(maxItems, 3));
}

export function hasRecommendations(recommendations: RecommendationItem[]): boolean {
  return recommendations.length > 0;
}

export function shouldShowRecommendationsRoute(content: Pick<GeneratedPortfolioContent, "recommendations" | "siteSettings">): boolean {
  return (
    content.siteSettings.enableRecommendations !== false &&
    (hasRecommendations(content.recommendations) || content.siteSettings.showEmptyRecommendations === true)
  );
}

export function selectRecommendationDetailContent(content: GeneratedPortfolioContent): RecommendationItem[] {
  return content.siteSettings.enableRecommendations === false ? [] : sortRecommendationsForDetail(content.recommendations);
}
