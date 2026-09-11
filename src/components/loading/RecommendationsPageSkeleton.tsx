import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutes } from "@/components/navigation/siteRoutes";

export function RecommendationsPageSkeleton() {
  return (
    <PageSkeleton pathname={siteRoutes.recommendations}>
      <div aria-hidden="true" className="detail-card-skeleton-grid detail-card-skeleton-grid--recommendations">
        {Array.from({ length: 4 }).map((_, index) => (
          <article className="detail-card-skeleton detail-card-skeleton--recommendation" key={index}>
            <div className="detail-card-skeleton__header">
              <SkeletonBlock height={24} width="66%" />
              <SkeletonBlock height={16} width="82%" />
              <SkeletonBlock height={14} width="52%" />
            </div>
            <SkeletonText rows={5} widths={["100%", "96%", "90%", "86%", "62%"]} />
            <SkeletonBlock height={32} radius="999px" width={128} />
            <div className="detail-card-skeleton__actions">
              <SkeletonBlock height={38} radius="999px" width={116} />
              <SkeletonBlock height={38} radius="999px" width={144} />
            </div>
          </article>
        ))}
      </div>
    </PageSkeleton>
  );
}
