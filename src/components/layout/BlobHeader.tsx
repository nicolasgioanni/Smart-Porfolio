import type { GeneratedPortfolioContent } from "@/content/types";
import { InteractiveBlobHeader } from "@/components/layout/InteractiveBlobHeader";
import { createNavigationItems } from "@/components/navigation/navigationItems";
import { selectPrimaryLinks } from "@/lib/content/selectHomeContent";

export function BlobHeader({ content }: { content: GeneratedPortfolioContent }) {
  const primaryLinks = selectPrimaryLinks(content.links);
  const navigationItems = createNavigationItems({
    ...content.siteSettings,
    recommendationCount: content.recommendations.length
  });
  const brand = {
    headline: content.profile.headline,
    initial: content.profile.preferredName?.slice(0, 1) ?? content.profile.fullName.slice(0, 1),
    markImageSrc: content.profile.faviconImage ?? "/favicon/favicon.png",
    name: content.profile.fullName
  };

  return <InteractiveBlobHeader brand={brand} navigationItems={navigationItems} primaryLinks={primaryLinks} />;
}
