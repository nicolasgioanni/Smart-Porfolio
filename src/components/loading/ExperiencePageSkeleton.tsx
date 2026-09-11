import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { RouteHeaderSkeleton } from "@/components/loading/RouteHeaderSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutes } from "@/components/navigation/siteRoutes";
import type { RouteHeaderContentSource } from "@/lib/content/routeHeaderContent";

export const experienceSkeletonProfiles = [
  { id: "us-treasury-ai-engineer", overviewRows: 0 },
  { id: "research-assistant-software-engineering", overviewRows: 4 },
  { id: "teaching-assistant", overviewRows: 4 },
  { id: "undergraduate-researcher-adversarial-ml", overviewRows: 4 },
  { id: "research-assistant-ai-ml", overviewRows: 4 }
] as const;

export function ExperiencePageSkeleton({ headerContent }: { headerContent?: RouteHeaderContentSource }) {
  return (
    <PageSkeleton pathname={siteRoutes.experience}>
      <div className="experience-skeleton" aria-hidden="true">
        <div className="experience-skeleton__intro">
          <div className="experience-skeleton__intro-copy">
            <RouteHeaderSkeleton content={headerContent} pathname={siteRoutes.experience} />
          </div>
          <div className="experience-skeleton__intro-control">
            <SkeletonBlock height={20.4} width={42} />
            <SkeletonBlock height={52} radius="999px" width={196} />
          </div>
        </div>
        {experienceSkeletonProfiles.map((profile) => (
          <article className="experience-skeleton__card" key={profile.id}>
            <div className="experience-skeleton__header">
              <SkeletonBlock height={64} radius="999px" width={64} />
              <div className="experience-skeleton__identity">
                <SkeletonBlock height={12} width="42%" />
                <SkeletonBlock height={24} width="68%" />
                <SkeletonBlock height={14} width="52%" />
              </div>
            </div>
            <div className="experience-skeleton__body">
              <SkeletonText rows={2} />
              <div className="experience-skeleton__chapters">
                {Array.from({ length: profile.overviewRows }).map((_, chapterIndex) => (
                  <SkeletonBlock height={72} key={chapterIndex} />
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </PageSkeleton>
  );
}
