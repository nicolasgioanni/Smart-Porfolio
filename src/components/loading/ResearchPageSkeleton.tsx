import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";

export function ResearchPageSkeleton() {
  return (
    <PageSkeleton showHeader={false}>
      <div aria-hidden="true" className="research-skeleton">
        <div className="research-skeleton__intro">
          <div className="research-skeleton__intro-copy">
            <SkeletonBlock
              className="skeleton-page__title"
              height={28}
              radius={14}
              width="min(100%, 330px)"
            />
            <SkeletonText rows={2} />
          </div>
          <div className="research-skeleton__intro-control">
            <SkeletonBlock height={12} width={42} />
            <SkeletonBlock height={40} radius="999px" width={196} />
          </div>
        </div>

        {Array.from({ length: 3 }).map((_, index) => (
          <article className="research-skeleton__project" data-visual-side={index % 2 === 0 ? "left" : "right"} key={index}>
            <SkeletonBlock className="research-skeleton__visual" height="100%" radius={0} />
            <div className="research-skeleton__content">
              <SkeletonBlock height={12} width="32%" />
              <SkeletonBlock height={34} width="58%" />
              <SkeletonBlock height={14} width="74%" />
              <SkeletonText rows={3} />
              <div className="research-skeleton__details">
                {Array.from({ length: 3 }).map((__, detailIndex) => (
                  <SkeletonBlock height={70} key={detailIndex} />
                ))}
              </div>
            </div>
          </article>
        ))}
      </div>
    </PageSkeleton>
  );
}
