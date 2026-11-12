import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonButton } from "@/components/loading/SkeletonButton";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutes } from "@/lib/routing/siteRoutes";

export function ResumePageSkeleton() {
  return (
    <PageSkeleton pathname={siteRoutes.resume}>
      <section aria-hidden="true" className="resume-skeleton">
        <div className="resume-skeleton__content">
          <SkeletonBlock height={14} width={112} />
          <SkeletonBlock height={34} width="min(100%, 360px)" />
          <SkeletonText rows={2} widths={["100%", "78%"]} />
        </div>
        <div className="resume-skeleton__actions">
          <SkeletonButton width={210} />
          <SkeletonButton width={190} />
        </div>
      </section>
    </PageSkeleton>
  );
}
