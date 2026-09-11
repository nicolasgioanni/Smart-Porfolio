import type { ComponentType } from "react";
import { ContactPageSkeleton } from "@/components/loading/ContactPageSkeleton";
import { ExperiencePageSkeleton } from "@/components/loading/ExperiencePageSkeleton";
import { HomePageSkeleton } from "@/components/loading/HomePageSkeleton";
import { LegalPageSkeleton, legalSkeletonProfiles } from "@/components/loading/LegalPageSkeleton";
import { ProjectsPageSkeleton } from "@/components/loading/ProjectsPageSkeleton";
import { RecommendationsPageSkeleton } from "@/components/loading/RecommendationsPageSkeleton";
import { ResearchPageSkeleton } from "@/components/loading/ResearchPageSkeleton";
import { ResumePageSkeleton } from "@/components/loading/ResumePageSkeleton";
import { siteRoutes, type SiteRoutePath } from "@/components/navigation/siteRoutes";

type RouteSkeletonComponent = ComponentType;

function TermsPageSkeleton() {
  return <LegalPageSkeleton pathname={siteRoutes.terms} sectionProfiles={legalSkeletonProfiles[siteRoutes.terms]} />;
}

function PrivacyPageSkeleton() {
  return <LegalPageSkeleton pathname={siteRoutes.privacy} sectionProfiles={legalSkeletonProfiles[siteRoutes.privacy]} />;
}

function SecurityPageSkeleton() {
  return <LegalPageSkeleton pathname={siteRoutes.security} sectionProfiles={legalSkeletonProfiles[siteRoutes.security]} />;
}

export const routeSkeletons = {
  [siteRoutes.home]: HomePageSkeleton,
  [siteRoutes.experience]: ExperiencePageSkeleton,
  [siteRoutes.research]: ResearchPageSkeleton,
  [siteRoutes.projects]: ProjectsPageSkeleton,
  [siteRoutes.recommendations]: RecommendationsPageSkeleton,
  [siteRoutes.resume]: ResumePageSkeleton,
  [siteRoutes.contact]: ContactPageSkeleton,
  [siteRoutes.terms]: TermsPageSkeleton,
  [siteRoutes.privacy]: PrivacyPageSkeleton,
  [siteRoutes.security]: SecurityPageSkeleton
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
