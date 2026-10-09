import type { ComponentType } from "react";
import type { ProjectItem, ResearchItem } from "@/content/types";
import { ContactPageSkeleton } from "@/components/loading/ContactPageSkeleton";
import { ExperiencePageSkeleton } from "@/components/loading/ExperiencePageSkeleton";
import { HomePageSkeleton } from "@/components/loading/HomePageSkeleton";
import { LegalPageSkeleton, legalSkeletonProfiles } from "@/components/loading/LegalPageSkeleton";
import { ProjectsPageSkeleton } from "@/features/projects/loading/ProjectsPageSkeleton";
import { getHomeProjectSkeletonProfiles } from "@/features/projects/loading/projectSkeletonProfiles";
import { RecommendationsPageSkeleton } from "@/components/loading/RecommendationsPageSkeleton";
import { ResearchPageSkeleton } from "@/features/research/loading/ResearchPageSkeleton";
import { ResumePageSkeleton } from "@/components/loading/ResumePageSkeleton";
import { siteRoutes, type SiteRoutePath } from "@/lib/routing/siteRoutes";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectHomeItems } from "@/lib/content/selectHomeContent";

type RouteSkeletonComponent = ComponentType;

export type RouteSkeletonProps = {
  pathname: SiteRoutePath;
  /**
   * Canonical detail content for an isolated Research skeleton render. Normal
   * route loading boundaries omit it and preserve generated-content alignment.
   */
  researchDetailItems?: readonly ResearchItem[];
  /** Canonical Project fixture items for standalone visual skeleton rendering. */
  projectDetailItems?: readonly ProjectItem[];
  /** Canonical Home Project fixture items for standalone visual skeleton rendering. */
  homeProjectItems?: readonly ProjectItem[];
};

function TermsPageSkeleton() {
  return <LegalPageSkeleton pathname={siteRoutes.terms} sectionProfiles={legalSkeletonProfiles[siteRoutes.terms]} />;
}

function ContactTermsPageSkeleton() {
  return <LegalPageSkeleton pathname={siteRoutes.contactTerms} sectionProfiles={legalSkeletonProfiles[siteRoutes.contactTerms]} />;
}

function PrivacyPageSkeleton() {
  return <LegalPageSkeleton pathname={siteRoutes.privacy} sectionProfiles={legalSkeletonProfiles[siteRoutes.privacy]} />;
}

function SecurityPageSkeleton() {
  return <LegalPageSkeleton pathname={siteRoutes.security} sectionProfiles={legalSkeletonProfiles[siteRoutes.security]} />;
}

function HomeRouteSkeleton({ projectItems }: { projectItems?: readonly ProjectItem[] }) {
  const content = getPortfolioContent();
  const items = projectItems ?? selectHomeItems(content.projects, content.siteSettings.maxHomeProjectItems);

  return <HomePageSkeleton projectProfiles={getHomeProjectSkeletonProfiles(items)} />;
}

export const routeSkeletons = {
  [siteRoutes.home]: HomeRouteSkeleton,
  [siteRoutes.experience]: ExperiencePageSkeleton,
  [siteRoutes.research]: ResearchPageSkeleton,
  [siteRoutes.projects]: ProjectsPageSkeleton,
  [siteRoutes.recommendations]: RecommendationsPageSkeleton,
  [siteRoutes.resume]: ResumePageSkeleton,
  [siteRoutes.contact]: ContactPageSkeleton,
  [siteRoutes.contactTerms]: ContactTermsPageSkeleton,
  [siteRoutes.terms]: TermsPageSkeleton,
  [siteRoutes.privacy]: PrivacyPageSkeleton,
  [siteRoutes.security]: SecurityPageSkeleton
} as const satisfies Readonly<Record<SiteRoutePath, RouteSkeletonComponent>>;

export const skeletonRoutePaths = Object.freeze(Object.keys(routeSkeletons) as SiteRoutePath[]);

export function RouteSkeleton({ homeProjectItems, pathname, projectDetailItems, researchDetailItems }: RouteSkeletonProps) {
  const Skeleton = routeSkeletons[pathname];
  const content =
    pathname === siteRoutes.research ? <ResearchPageSkeleton detailItems={researchDetailItems} /> :
      pathname === siteRoutes.projects ? <ProjectsPageSkeleton detailItems={projectDetailItems} /> :
        pathname === siteRoutes.home ? <HomeRouteSkeleton projectItems={homeProjectItems} /> : <Skeleton />;

  return (
    <div data-skeleton-route={pathname} data-testid={`loading-boundary-${pathname}`}>
      {content}
    </div>
  );
}
