import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { getProjectSkeletonProfiles } from "@/features/projects/loading/projectSkeletonProfiles";
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
            <div className="detail-card-skeleton__project-header-content">
              <div className="detail-card-skeleton__header detail-card-skeleton__project-header">
                <SkeletonBlock height={26} width="74%" />
                {profile.hasBadge ? <SkeletonBlock className="detail-card-skeleton__project-badge" height={24} radius="999px" width={76} /> : null}
              </div>
              <div className="detail-card-skeleton__project-summary">
                <SkeletonText rows={profile.summaryWidths.length} widths={profile.summaryWidths.map((width) => `${width}%`)} />
                {profile.hasAttribution ? <SkeletonBlock className="detail-card-skeleton__project-attribution" height={14} width="42%" /> : null}
              </div>
            </div>
            <div className="detail-card-skeleton__project-visual-content">
              {profile.hasVisual ? <div className="detail-card-skeleton__project-visual"><SkeletonBlock height="100%" /></div> : null}
              {profile.visualControlCount > 0 ? (
                <div className="detail-card-skeleton__project-controls">
                  <SkeletonBlock height={44} radius="999px" width={126} />
                </div>
              ) : null}
            </div>
            <div className="detail-card-skeleton__project-footer">
              {profile.actionWidths.length > 0 ? <div aria-hidden="true" className="detail-card-skeleton__project-divider" /> : null}
              <div className="detail-card-skeleton__actions">
                {profile.actionWidths.map((width, actionIndex) => <SkeletonBlock height={38} key={actionIndex} radius="999px" width={width} />)}
              </div>
            </div>
          </article>
        ))}
      </div>
    </PageSkeleton>
  );
}
