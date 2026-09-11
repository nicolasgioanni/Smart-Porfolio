import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";

export function ContactPageSkeleton() {
  return (
    <PageSkeleton variant="contact">
      <section aria-hidden="true" className="contact-skeleton">
        <div className="contact-skeleton__heading">
          <SkeletonBlock height={14} width={96} />
          <SkeletonBlock className="skeleton-page__title" height={28} width="min(100%, 320px)" />
          <SkeletonBlock height={20} width="min(100%, 440px)" />
        </div>
        <div className="contact-skeleton__gate">
          <SkeletonBlock height={14} width="32%" />
          <SkeletonBlock className="contact-skeleton__verification-well" height={136} radius={12} width="100%" />
          <SkeletonBlock height={14} width="62%" />
        </div>
        <div className="contact-skeleton__actions">
          <SkeletonBlock height={44} radius="999px" width={136} />
        </div>
        <div className="contact-skeleton__fallback">
          <SkeletonBlock height={14} width={132} />
          <SkeletonBlock height={16} width={218} />
        </div>
      </section>
    </PageSkeleton>
  );
}
