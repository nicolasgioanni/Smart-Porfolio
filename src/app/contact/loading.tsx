import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { shouldRenderSkeletons } from "@/components/loading/shouldRenderSkeletons";

export default function Loading() {
  if (!shouldRenderSkeletons()) return null;

  return (
    <PageSkeleton>
      <section className="skeleton-page__section" aria-hidden="true">
        <SkeletonBlock height={14} width={132} />
        <SkeletonBlock height={34} width="48%" />
        <SkeletonText rows={5} />
      </section>
    </PageSkeleton>
  );
}
