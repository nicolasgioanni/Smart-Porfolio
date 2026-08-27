import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutes } from "@/components/navigation/siteRoutes";

export type LegalSkeletonRoutePath = (typeof siteRoutes)["terms" | "privacy" | "security"];

export type LegalSkeletonSectionProfile = {
  headingWidth: string;
  rows: number;
};

export const legalSkeletonProfiles = {
  [siteRoutes.terms]: [
    { headingWidth: "42%", rows: 3 },
    { headingWidth: "64%", rows: 4 },
    { headingWidth: "46%", rows: 3 },
    { headingWidth: "36%", rows: 2 },
    { headingWidth: "58%", rows: 3 },
    { headingWidth: "44%", rows: 2 },
    { headingWidth: "24%", rows: 2 }
  ],
  [siteRoutes.privacy]: [
    { headingWidth: "58%", rows: 4 },
    { headingWidth: "72%", rows: 5 },
    { headingWidth: "62%", rows: 3 },
    { headingWidth: "68%", rows: 7 },
    { headingWidth: "48%", rows: 4 },
    { headingWidth: "56%", rows: 4 },
    { headingWidth: "38%", rows: 3 },
    { headingWidth: "52%", rows: 2 }
  ],
  [siteRoutes.security]: [
    { headingWidth: "46%", rows: 4 },
    { headingWidth: "52%", rows: 7 },
    { headingWidth: "48%", rows: 4 },
    { headingWidth: "38%", rows: 4 },
    { headingWidth: "44%", rows: 3 },
    { headingWidth: "70%", rows: 3 },
    { headingWidth: "24%", rows: 2 }
  ]
} as const satisfies Readonly<Record<LegalSkeletonRoutePath, readonly LegalSkeletonSectionProfile[]>>;

export function LegalPageSkeleton({ sectionProfiles }: { sectionProfiles: readonly LegalSkeletonSectionProfile[] }) {
  return (
    <PageSkeleton headerVariant="legal" variant="legal">
      <article aria-hidden="true" className="legal-skeleton">
        <header className="legal-skeleton__meta">
          <SkeletonBlock height={14} width={188} />
        </header>
        <div className="legal-skeleton__body">
          {sectionProfiles.map((section, index) => (
            <section className="legal-skeleton__section" key={index}>
              <SkeletonBlock height={26} width={section.headingWidth} />
              <SkeletonText rows={section.rows} widths={["100%", "96%", "92%", "68%"]} />
            </section>
          ))}
        </div>
      </article>
    </PageSkeleton>
  );
}
