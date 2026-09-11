import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";

export function ProjectsPageSkeleton() {
  return (
    <PageSkeleton>
      <div aria-hidden="true" className="detail-card-skeleton-grid detail-card-skeleton-grid--projects">
        {Array.from({ length: 3 }).map((_, index) => (
          <article className="detail-card-skeleton detail-card-skeleton--project" key={index}>
            <div className="detail-card-skeleton__header">
              <SkeletonBlock height={26} width="74%" />
              <SkeletonBlock height={16} width="48%" />
            </div>
            <SkeletonText rows={3} widths={["100%", "94%", "70%"]} />
            <div className="detail-card-skeleton__deep-dive">
              <SkeletonBlock height={16} width="94%" />
              <SkeletonBlock height={16} width="88%" />
              <SkeletonBlock height={16} width="78%" />
            </div>
            <div className="detail-card-skeleton__chips">
              {[74, 98, 68, 112].map((width) => <SkeletonBlock height={30} key={width} radius="999px" width={width} />)}
            </div>
            <div className="detail-card-skeleton__actions">
              <SkeletonBlock height={38} radius="999px" width={112} />
              <SkeletonBlock height={38} radius="999px" width={96} />
            </div>
          </article>
        ))}
      </div>
    </PageSkeleton>
  );
}
