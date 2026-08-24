import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonGrid } from "@/components/loading/SkeletonGrid";
import { SkeletonHero } from "@/components/loading/SkeletonHero";

export function HomePageSkeleton() {
  return (
    <PageSkeleton showHeader={false}>
      <div className="skeleton-page__stack">
        <SkeletonHero />
        <SkeletonGrid columns="one" items={4} />
        <section className="skeleton-page__section" aria-hidden="true">
          <SkeletonBlock height={22} width="26%" />
          <div className="home-skeleton__skills">
            <SkeletonGrid columns="three" items={3} />
          </div>
        </section>
        <SkeletonGrid columns="three" items={3} />
      </div>
    </PageSkeleton>
  );
}
