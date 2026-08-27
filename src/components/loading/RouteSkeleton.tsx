import type { ComponentType } from "react";
import { ContactPageSkeleton } from "@/components/loading/ContactPageSkeleton";
import { ExperiencePageSkeleton } from "@/components/loading/ExperiencePageSkeleton";
import { HomePageSkeleton } from "@/components/loading/HomePageSkeleton";
import { LegalPageSkeleton } from "@/components/loading/LegalPageSkeleton";
import { ProjectsPageSkeleton } from "@/components/loading/ProjectsPageSkeleton";
import { RecommendationsPageSkeleton } from "@/components/loading/RecommendationsPageSkeleton";
import { ResearchPageSkeleton } from "@/components/loading/ResearchPageSkeleton";
import { ResumePageSkeleton } from "@/components/loading/ResumePageSkeleton";
import { siteRoutes, type SiteRoutePath } from "@/components/navigation/siteRoutes";

type RouteSkeletonComponent = ComponentType;

export const routeSkeletons = {
  [siteRoutes.home]: HomePageSkeleton,
  [siteRoutes.experience]: ExperiencePageSkeleton,
  [siteRoutes.research]: ResearchPageSkeleton,
  [siteRoutes.projects]: ProjectsPageSkeleton,
  [siteRoutes.recommendations]: RecommendationsPageSkeleton,
  [siteRoutes.resume]: ResumePageSkeleton,
  [siteRoutes.contact]: ContactPageSkeleton,
  [siteRoutes.terms]: LegalPageSkeleton,
  [siteRoutes.privacy]: LegalPageSkeleton,
  [siteRoutes.security]: LegalPageSkeleton
} as const satisfies Readonly<Record<SiteRoutePath, RouteSkeletonComponent>>;

export const skeletonRoutePaths = Object.freeze(Object.keys(routeSkeletons) as SiteRoutePath[]);

export function RouteSkeleton({ pathname }: { pathname: SiteRoutePath }) {
  const Skeleton = routeSkeletons[pathname];

  return (
    <div data-skeleton-route={pathname} data-testid={`loading-boundary-${pathname}`}>
      <Skeleton />
    </div>
  );
}
