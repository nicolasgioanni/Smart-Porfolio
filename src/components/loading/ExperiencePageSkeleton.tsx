import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";

export function ExperiencePageSkeleton() {
  return (
    <PageSkeleton showHeader={false}>
      <div className="experience-skeleton" aria-hidden="true">
        <div className="experience-skeleton__intro">
          <div className="experience-skeleton__intro-copy">
            <SkeletonBlock height={44} radius={14} width="min(100%, 260px)" />
            <SkeletonText rows={2} />
          </div>
          <div className="experience-skeleton__intro-control">
            <SkeletonBlock height={16} width={76} />
            <SkeletonBlock height={54} radius="999px" width={300} />
          </div>
        </div>
        {Array.from({ length: 4 }).map((_, index) => (
          <article className="experience-skeleton__card" key={index}>
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
                {Array.from({ length: 3 }).map((_, chapterIndex) => (
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
