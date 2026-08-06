import type { SiteSettings } from "@/content/types";
import { siteRoutes, type SiteRoutePath } from "@/components/navigation/siteRoutes";

export type NavigationItem = {
  href: SiteRoutePath;
  label: string;
};

type NavigationSettings = Partial<Pick<SiteSettings, "enableRecommendations" | "recommendationsNavLabel" | "showEmptyRecommendations">> & {
  recommendationCount?: number;
};

export function createNavigationItems(siteSettings?: NavigationSettings): NavigationItem[] {
  const recommendationsEnabled = siteSettings?.enableRecommendations !== false;
  const recommendationCount = siteSettings?.recommendationCount;
  const hasRecommendationData = recommendationCount === undefined ? true : recommendationCount > 0;
  const shouldShowRecommendations = recommendationsEnabled && (hasRecommendationData || siteSettings?.showEmptyRecommendations === true);
  const recommendationsLabel = siteSettings?.recommendationsNavLabel || "Recommendations";
  const items: NavigationItem[] = [
    { href: siteRoutes.home, label: "Home" },
    { href: siteRoutes.experience, label: "Experience" },
    { href: siteRoutes.research, label: "Research" },
    { href: siteRoutes.projects, label: "Projects" }
  ];

  if (shouldShowRecommendations) {
    items.push({ href: siteRoutes.recommendations, label: recommendationsLabel });
  }

  items.push({ href: siteRoutes.resume, label: "Resume" });

  return items;
}

export const navigationItems: NavigationItem[] = createNavigationItems();

export function isNavigationItemActive(pathname: string, href: SiteRoutePath): boolean {
  if (href === siteRoutes.home) return pathname === siteRoutes.home;
  return pathname === href || pathname.startsWith(`${href}/`);
}
