import { SkeletonAvatar } from "@/components/loading/SkeletonAvatar";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonButton } from "@/components/loading/SkeletonButton";
import { SkeletonText } from "@/components/loading/SkeletonText";

export function SkeletonHero() {
  return (
    <section className="skeleton-hero" aria-hidden="true">
      <div className="skeleton-hero__main">
        <div>
          <SkeletonBlock height={13} width={110} />
          <SkeletonBlock height={72} radius={24} width="88%" />
          <SkeletonText rows={2} widths={["80%", "58%"]} />
        </div>
        <div className="skeleton-actions">
          <SkeletonButton width={152} />
          <SkeletonButton width={112} />
          <SkeletonButton width={128} />
        </div>
      </div>
      <aside className="skeleton-hero__aside">
        <SkeletonAvatar />
        <SkeletonBlock height={26} width="44%" />
        <SkeletonText rows={5} />
      </aside>
    </section>
  );
}
