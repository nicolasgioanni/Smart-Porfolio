import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";

type SkeletonCardProps = {
  rows?: number;
};

export function SkeletonCard({ rows = 3 }: SkeletonCardProps) {
  return (
    <article aria-hidden="true" className="skeleton-card">
      <SkeletonBlock height={22} width="72%" />
      <SkeletonText rows={rows} />
      <div className="skeleton-actions">
        <SkeletonBlock height={28} radius="999px" width={82} />
        <SkeletonBlock height={28} radius="999px" width={108} />
      </div>
    </article>
  );
}
