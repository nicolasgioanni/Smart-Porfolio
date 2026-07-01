import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonGrid } from "@/components/loading/SkeletonGrid";
import { SkeletonText } from "@/components/loading/SkeletonText";

export function ResumePageSkeleton() {
  return (
    <PageSkeleton>
      <div className="skeleton-page__stack">
        <section className="skeleton-page__section" aria-hidden="true">
          <SkeletonBlock height={42} width="42%" />
          <SkeletonText rows={2} />
        </section>
        <SkeletonGrid items={4} />
      </div>
    </PageSkeleton>
  );
}