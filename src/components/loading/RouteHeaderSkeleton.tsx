import type { SiteRoutePath } from "@/lib/routing/siteRoutes";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { resolveRouteHeaderContent, type RouteHeaderContentSource } from "@/lib/content/routeHeaderContent";

type RouteHeaderSkeletonProps = {
  content?: RouteHeaderContentSource;
  pathname: SiteRoutePath;
};

/**
 * A noninteractive ink mask over the exact resolved header copy.
 *
 * The browser lays out the same resolved strings, typography, and copy
 * container, so responsive line fragments remain faithful without viewport
 * JavaScript or hand-maintained breakpoint width arrays.
 */
export function RouteHeaderSkeleton({ content: source = getPortfolioContent(), pathname }: RouteHeaderSkeletonProps) {
  const content = resolveRouteHeaderContent(pathname, source);

  if (!content) return null;

  return (
    <div aria-hidden="true" className="section-header section-header--page route-header-skeleton">
      <div className="section-header__copy">
        {content.eyebrow ? (
          <p className="eyebrow route-header-skeleton__eyebrow">
            <span className="route-header-skeleton__ink">{content.eyebrow}</span>
          </p>
        ) : null}
        <h1 className="page-title route-header-skeleton__title">
          <span className="route-header-skeleton__ink">{content.title}</span>
        </h1>
        <p className="page-description route-header-skeleton__description">
          <span className="route-header-skeleton__ink">{content.description}</span>
        </p>
      </div>
    </div>
  );
}
