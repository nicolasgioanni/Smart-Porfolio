import type { GeneratedPortfolioContent } from "@/content/types";
import { InteractiveBlobHeader } from "@/components/layout/InteractiveBlobHeader";
import { createNavigationItems } from "@/components/navigation/navigationItems";
import { selectHeaderLinks } from "@/lib/content/selectHomeContent";
import type { ThemeName } from "@/lib/theme/resolveThemeName";

export function BlobHeader({ content, initialTheme }: { content: GeneratedPortfolioContent; initialTheme: ThemeName }) {
  const primaryLinks = selectHeaderLinks(content.links);
  const navigationItems = createNavigationItems({
    ...content.siteSettings,
    recommendationCount: content.recommendations.length
  });
  const brand = {
    initial: content.profile.preferredName?.slice(0, 1) ?? content.profile.fullName.slice(0, 1),
    markImageSrc: content.profile.faviconImage ?? "/favicon/favicon.png",
    name: content.profile.fullName
  };

  return <InteractiveBlobHeader brand={brand} initialTheme={initialTheme} navigationItems={navigationItems} primaryLinks={primaryLinks} />;
}
