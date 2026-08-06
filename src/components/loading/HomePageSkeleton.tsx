import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonCard } from "@/components/loading/SkeletonCard";
import { SkeletonGrid } from "@/components/loading/SkeletonGrid";
import { SkeletonHero } from "@/components/loading/SkeletonHero";

export function HomePageSkeleton() {
  return (
    <PageSkeleton showHeader={false}>
      <div className="skeleton-page__stack">
        <SkeletonHero />
        <section className="skeleton-page__section" aria-hidden="true">
          <SkeletonBlock height={22} width="26%" />
          <div className="skeleton-skills">
            <div className="skeleton-skills__toolkit">
              {Array.from({ length: 5 }).map((_, index) => (
                <SkeletonBlock height={30} key={index} radius="999px" width={index % 2 === 0 ? 92 : 118} />
              ))}
            </div>
            <div className="skeleton-skills__explorer">
              <div className="skeleton-skills__selector">
                {Array.from({ length: 5 }).map((_, index) => (
                  <SkeletonBlock height={58} key={index} />
                ))}
              </div>
              <SkeletonCard rows={8} />
            </div>
          </div>
        </section>
        <SkeletonGrid columns="one" items={4} />
      </div>
    </PageSkeleton>
  );
}
