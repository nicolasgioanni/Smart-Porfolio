import type { GeneratedPortfolioContent } from "@/content/types";
import { GlassBlob } from "@/components/glass/GlassBlob";
import { MainNavigation } from "@/components/navigation/MainNavigation";
import { MobileNavigation } from "@/components/navigation/MobileNavigation";
import { createNavigationItems } from "@/components/navigation/navigationItems";
import { SocialLinkGroup } from "@/components/navigation/SocialLinkGroup";
import { selectPrimaryLinks } from "@/lib/content/selectHomeContent";

export function BlobHeader({ content }: { content: GeneratedPortfolioContent }) {
  const primaryLinks = selectPrimaryLinks(content.links);
  const navigationItems = createNavigationItems({
    ...content.siteSettings,
    recommendationCount: content.recommendations.length
  });

  return (
    <header className="blob-header">
      <GlassBlob className="blob-header__island" tone="nav">
        <a className="site-brand" href="/" aria-label={`${content.profile.fullName} home`}>
          <span className="site-brand__mark" aria-hidden="true">
            {content.profile.preferredName?.slice(0, 1) ?? content.profile.fullName.slice(0, 1)}
          </span>
          <span className="site-brand__text">
            <span className="site-brand__name">{content.profile.fullName}</span>
            <span className="site-brand__headline">{content.profile.headline}</span>
          </span>
        </a>
        <MainNavigation items={navigationItems} />
        <SocialLinkGroup compact links={primaryLinks.slice(0, 4)} />
        <MobileNavigation items={navigationItems} links={primaryLinks} />
      </GlassBlob>
    </header>
  );
}
