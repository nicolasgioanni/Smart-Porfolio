import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonButton } from "@/components/loading/SkeletonButton";
import { SkeletonText } from "@/components/loading/SkeletonText";

export function ResumePageSkeleton() {
  return (
    <PageSkeleton>
      <div className="skeleton-page__stack">
        <section className="skeleton-page__section" aria-hidden="true">
          <SkeletonBlock height={14} width={112} />
          <SkeletonBlock height={34} width="46%" />
          <SkeletonText rows={3} />
          <div className="skeleton-page__actions">
            <SkeletonButton width={210} />
            <SkeletonButton width={190} />
          </div>
        </section>
      </div>
    </PageSkeleton>
  );
}
