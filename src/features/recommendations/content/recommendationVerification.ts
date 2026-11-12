import type { RecommendationItem } from "@/content/types";

export const linkedInRecommendationsUrl =
  "https://www.linkedin.com/in/nicolas-gioanni/details/recommendations/";

const linkedInRecommendationFallbackIds = new Set([
  "billy-gardner-mcintyre",
  "brent-lagesse",
  "annuska-zolyomi",
  "anoop-prasad",
  "minh-nhat-huynh"
]);

/**
 * Resolves the public LinkedIn recommendation record separately from a
 * recommender's LinkedIn profile. The current five authored records all point
 * to Nicolas's recommendations page when their source is missing or repeats
 * the profile URL; future records must provide their own distinct source URL.
 */
export function getRecommendationVerificationUrl(
  item: Pick<RecommendationItem, "id" | "linkedinUrl" | "sourceUrl">
): string | undefined {
  if (item.sourceUrl && item.sourceUrl !== item.linkedinUrl) {
    return item.sourceUrl;
  }

  return linkedInRecommendationFallbackIds.has(item.id) ? linkedInRecommendationsUrl : undefined;
}
