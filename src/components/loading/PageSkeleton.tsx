import type { ReactNode } from "react";
import { RouteHeaderSkeleton } from "@/components/loading/RouteHeaderSkeleton";
import type { SiteRoutePath } from "@/lib/routing/siteRoutes";
import { getRouteHeaderContent } from "@/lib/content/routeHeaderContent";

type PageSkeletonProps = {
  children: ReactNode;
  pathname: SiteRoutePath;
  variant?: "default" | "home" | "legal" | "contact";
};

export function PageSkeleton({
  children,
  pathname,
  variant = "default"
}: PageSkeletonProps) {
  const header = getRouteHeaderContent(pathname);

  return (
    <section
      aria-busy="true"
      aria-label="Loading page"
      className={["skeleton-page", `skeleton-page--${variant}`].join(" ")}
    >
      {header?.placement === "page" ? (
        <div className="page-intro page-intro--panel skeleton-page__intro">
          <header className="page-intro__surface skeleton-page__header" aria-hidden="true">
            <RouteHeaderSkeleton pathname={pathname} />
          </header>
        </div>
      ) : null}
      {children}
    </section>
  );
}
