import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { projectSkeletonProfiles } from "@/components/loading/projectSkeletonProfiles";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutes } from "@/lib/routing/siteRoutes";

export function ProjectsPageSkeleton() {
  return (
    <PageSkeleton pathname={siteRoutes.projects}>
      <div aria-hidden="true" className="detail-card-skeleton-grid detail-card-skeleton-grid--projects">
        {projectSkeletonProfiles.map((profile) => (
          <article className="detail-card-skeleton detail-card-skeleton--project" key={profile.id}>
            <div className="detail-card-skeleton__header">
              <SkeletonBlock height={26} width="74%" />
              <SkeletonBlock height={16} width="48%" />
            </div>
            <SkeletonText rows={3} widths={["100%", "94%", "70%"]} />
            <div className="detail-card-skeleton__deep-dive">
              {profile.deepDiveLines.map((group, groupIndex) => (
                <div className="detail-card-skeleton__deep-dive-group" key={groupIndex}>
                  {group.map((width, lineIndex) => <SkeletonBlock height={16} key={lineIndex} width={`${width}%`} />)}
                </div>
              ))}
            </div>
            <div className="detail-card-skeleton__chips">
              {profile.chipWidths.map((width, chipIndex) => <SkeletonBlock height={30} key={chipIndex} radius="999px" width={width} />)}
            </div>
            <div className="detail-card-skeleton__actions">
              {profile.actionWidths.map((width, actionIndex) => <SkeletonBlock height={38} key={actionIndex} radius="999px" width={width} />)}
            </div>
          </article>
        ))}
      </div>
    </PageSkeleton>
  );
}
