import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";

const documentSections = [3, 4, 3, 4, 3, 2] as const;

export function LegalPageSkeleton() {
  return (
    <PageSkeleton headerVariant="legal" variant="legal">
      <article aria-hidden="true" className="legal-skeleton">
        <header className="legal-skeleton__meta">
          <SkeletonBlock height={14} width={188} />
        </header>
        <div className="legal-skeleton__body">
          {documentSections.map((rows, index) => (
            <section className="legal-skeleton__section" key={index}>
              <SkeletonBlock height={26} width={index % 2 === 0 ? "56%" : "68%"} />
              <SkeletonText rows={rows} widths={["100%", "96%", "92%", "68%"]} />
            </section>
          ))}
        </div>
      </article>
    </PageSkeleton>
  );
}
