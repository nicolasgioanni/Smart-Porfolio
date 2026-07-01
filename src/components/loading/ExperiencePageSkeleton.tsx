import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonCard } from "@/components/loading/SkeletonCard";

export function ExperiencePageSkeleton() {
  return (
    <PageSkeleton>
      <div className="skeleton-page__stack" aria-hidden="true">
        {Array.from({ length: 4 }).map((_, index) => (
          <div className="timeline-item" key={index}>
            <SkeletonBlock height={14} radius="999px" width={14} />
            <SkeletonCard rows={3} />
          </div>
        ))}
      </div>
    </PageSkeleton>
  );
}