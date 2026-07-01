import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonGrid } from "@/components/loading/SkeletonGrid";
import { SkeletonHero } from "@/components/loading/SkeletonHero";

export function HomePageSkeleton() {
  return (
    <PageSkeleton showHeader={false}>
      <div className="skeleton-page__stack">
        <SkeletonHero />
        <section className="skeleton-page__section" aria-hidden="true">
          <SkeletonBlock height={22} width="26%" />
          <SkeletonGrid columns="three" items={3} />
        </section>
        <SkeletonGrid items={4} />
      </div>
    </PageSkeleton>
  );
}