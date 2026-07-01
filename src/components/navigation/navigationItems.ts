import type { SiteSettings } from "@/content/types";

export type NavigationItem = {
  href: string;
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
    { href: "/", label: "Home" },
    { href: "/research", label: "Research" },
    { href: "/projects", label: "Projects" },
    { href: "/experience", label: "Experience" }
  ];

  if (shouldShowRecommendations) {
    items.push({ href: "/recommendations", label: recommendationsLabel });
  }

  items.push({ href: "/resume", label: "Resume" });

  return items;
}

export const navigationItems: NavigationItem[] = createNavigationItems();

export function isNavigationItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
