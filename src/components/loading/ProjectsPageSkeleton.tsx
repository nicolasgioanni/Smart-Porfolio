import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { getProjectSkeletonProfiles } from "@/components/loading/projectSkeletonProfiles";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { getPortfolioContent } from "@/lib/content/getPortfolioContent";
import { selectProjectDetailContent } from "@/lib/content/selectDetailContent";
import type { ProjectItem } from "@/content/types";
import { siteRoutes } from "@/lib/routing/siteRoutes";

export function ProjectsPageSkeleton({ detailItems }: { detailItems?: readonly ProjectItem[] }) {
  const projectSkeletonProfiles = getProjectSkeletonProfiles(detailItems ?? selectProjectDetailContent(getPortfolioContent()));

  return (
    <PageSkeleton pathname={siteRoutes.projects}>
      <div aria-hidden="true" className="detail-card-skeleton-grid detail-card-skeleton-grid--projects">
        {projectSkeletonProfiles.map((profile) => (
          <article className="detail-card-skeleton detail-card-skeleton--project" key={profile.id}>
            <div className="detail-card-skeleton__header">
              <SkeletonBlock height={26} width="74%" />
            </div>
            <SkeletonText rows={profile.summaryWidths.length} widths={profile.summaryWidths.map((width) => `${width}%`)} />
            {profile.tabCount > 0 ? (
              <div className="detail-card-skeleton__project-tabs">
                <SkeletonBlock height={44} radius="12px" width={84} />
                <SkeletonBlock height={44} radius="12px" width={112} />
              </div>
            ) : null}
            {profile.hasVisual ? <div className="detail-card-skeleton__project-visual"><SkeletonBlock height="100%" /></div> : null}
            <div className="detail-card-skeleton__actions">
              {profile.actionWidths.map((width, actionIndex) => <SkeletonBlock height={38} key={actionIndex} radius="999px" width={width} />)}
            </div>
          </article>
        ))}
      </div>
    </PageSkeleton>
  );
}
