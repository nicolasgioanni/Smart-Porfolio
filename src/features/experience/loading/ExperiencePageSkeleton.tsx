import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { RouteHeaderSkeleton } from "@/components/loading/RouteHeaderSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutes } from "@/lib/routing/siteRoutes";
import type { RouteHeaderContentSource } from "@/lib/content/routeHeaderContent";

export const experienceSkeletonProfiles = [
  { id: "cdao-some-kinda-engineer", badges: 1, metadataLines: 2, overviewRows: 0, resourceCount: 0, summaryLines: 1 },
  { id: "us-treasury-ai-engineer", badges: 0, metadataLines: 2, overviewRows: 0, resourceCount: 1, summaryLines: 0 },
  { id: "research-assistant-software-engineering", badges: 1, metadataLines: 2, overviewRows: 4, resourceCount: 0, summaryLines: 2 },
  { id: "teaching-assistant", badges: 1, metadataLines: 2, overviewRows: 4, resourceCount: 0, summaryLines: 2 },
  { id: "undergraduate-researcher-adversarial-ml", badges: 1, metadataLines: 2, overviewRows: 4, resourceCount: 0, summaryLines: 2 },
  { id: "research-assistant-ai-ml", badges: 1, metadataLines: 2, overviewRows: 4, resourceCount: 0, summaryLines: 2 }
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
                <div className="experience-skeleton__metadata">
                  {Array.from({ length: profile.metadataLines }).map((_, metadataIndex) => (
                    <SkeletonBlock height={14} key={metadataIndex} width={metadataIndex === 0 ? "52%" : "38%"} />
                  ))}
                </div>
                {profile.badges > 0 ? (
                  <div className="experience-skeleton__badges">
                    {Array.from({ length: profile.badges }).map((_, badgeIndex) => (
                      <SkeletonBlock height={26} key={badgeIndex} radius="999px" width={68} />
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
            <div className="experience-skeleton__body">
              {profile.summaryLines > 0 ? <SkeletonText rows={profile.summaryLines} /> : null}
              <div className="experience-skeleton__chapters">
                {Array.from({ length: profile.overviewRows }).map((_, chapterIndex) => (
                  <SkeletonBlock height={72} key={chapterIndex} />
                ))}
              </div>
              {profile.resourceCount > 0 ? (
                <div className="experience-skeleton__resources">
                  {Array.from({ length: profile.resourceCount }).map((_, resourceIndex) => (
                    <SkeletonBlock height={44} key={resourceIndex} radius="999px" width={132} />
                  ))}
                </div>
              ) : null}
            </div>
          </article>
        ))}
      </div>
    </PageSkeleton>
  );
}
