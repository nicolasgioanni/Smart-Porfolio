import type { SiteSettings } from "@/content/types";
import { shouldShowRecommendationsRoute } from "@/lib/content/shouldShowRecommendationsRoute";
import { siteRoutes, type SiteRoutePath } from "@/lib/routing/siteRoutes";

export type NavigationItem = {
  href: SiteRoutePath;
  label: string;
};

type NavigationSettings = Partial<Pick<SiteSettings, "enableRecommendations" | "recommendationsNavLabel" | "showEmptyRecommendations">> & {
  recommendationCount?: number;
};

export function createNavigationItems(siteSettings?: NavigationSettings): NavigationItem[] {
  const recommendationCount = siteSettings?.recommendationCount;
  const shouldShowRecommendations = shouldShowRecommendationsRoute({
    recommendations: recommendationCount === undefined || recommendationCount > 0 ? [true] : [],
    siteSettings: {
      enableRecommendations: siteSettings?.enableRecommendations ?? true,
      showEmptyRecommendations: siteSettings?.showEmptyRecommendations ?? false
    }
  });
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
