import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonGrid } from "@/components/loading/SkeletonGrid";

export function ResearchPageSkeleton() {
  return (
    <PageSkeleton>
      <SkeletonGrid items={4} />
    </PageSkeleton>
  );
}