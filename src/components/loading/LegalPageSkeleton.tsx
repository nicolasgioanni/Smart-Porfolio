import { PageSkeleton } from "@/components/loading/PageSkeleton";
import { SkeletonBlock } from "@/components/loading/SkeletonBlock";
import { SkeletonText } from "@/components/loading/SkeletonText";
import { siteRoutes } from "@/components/navigation/siteRoutes";

export type LegalSkeletonRoutePath = (typeof siteRoutes)["terms" | "privacy" | "security"];

export type LegalSkeletonContentBlock =
  | {
      rows: number;
      type: "paragraph";
    }
  | {
      itemRows: readonly number[];
      type: "list";
    };

export type LegalSkeletonSectionProfile = {
  content: readonly LegalSkeletonContentBlock[];
  headingWidth: string;
};

export const legalSkeletonProfiles = {
  [siteRoutes.terms]: [
    { content: [{ rows: 3, type: "paragraph" }, { rows: 2, type: "paragraph" }], headingWidth: "42%" },
    {
      content: [
        { rows: 3, type: "paragraph" },
        { rows: 3, type: "paragraph" },
        { rows: 2, type: "paragraph" }
      ],
      headingWidth: "64%"
    },
    { content: [{ rows: 4, type: "paragraph" }, { rows: 4, type: "paragraph" }], headingWidth: "46%" },
    { content: [{ rows: 3, type: "paragraph" }], headingWidth: "36%" },
    { content: [{ rows: 3, type: "paragraph" }, { rows: 4, type: "paragraph" }], headingWidth: "58%" },
    { content: [{ rows: 4, type: "paragraph" }], headingWidth: "44%" },
    { content: [{ rows: 2, type: "paragraph" }], headingWidth: "24%" }
  ],
  [siteRoutes.privacy]: [
    {
      content: [
        { rows: 4, type: "paragraph" },
        { rows: 2, type: "paragraph" },
        { rows: 3, type: "paragraph" }
      ],
      headingWidth: "58%"
    },
    {
      content: [
        { rows: 4, type: "paragraph" },
        { rows: 6, type: "paragraph" },
        { rows: 5, type: "paragraph" }
      ],
      headingWidth: "72%"
    },
    { content: [{ rows: 5, type: "paragraph" }], headingWidth: "62%" },
    {
      content: [
        { rows: 6, type: "paragraph" },
        { rows: 5, type: "paragraph" },
        { rows: 6, type: "paragraph" },
        { rows: 8, type: "paragraph" },
        { rows: 8, type: "paragraph" },
        { rows: 5, type: "paragraph" },
        { rows: 4, type: "paragraph" },
        { rows: 5, type: "paragraph" },
        { rows: 4, type: "paragraph" }
      ],
      headingWidth: "68%"
    },
    { content: [{ rows: 3, type: "paragraph" }, { rows: 3, type: "paragraph" }], headingWidth: "48%" },
    {
      content: [
        { rows: 5, type: "paragraph" },
        { rows: 5, type: "paragraph" },
        { rows: 6, type: "paragraph" }
      ],
      headingWidth: "56%"
    },
    { content: [{ rows: 5, type: "paragraph" }], headingWidth: "38%" },
    { content: [{ rows: 3, type: "paragraph" }], headingWidth: "52%" }
  ],
  [siteRoutes.security]: [
    {
      content: [
        { rows: 4, type: "paragraph" },
        { rows: 5, type: "paragraph" },
        { rows: 4, type: "paragraph" }
      ],
      headingWidth: "46%"
    },
    {
      content: [
        { rows: 4, type: "paragraph" },
        { rows: 5, type: "paragraph" },
        { rows: 7, type: "paragraph" },
        { rows: 6, type: "paragraph" },
        { rows: 8, type: "paragraph" },
        { rows: 4, type: "paragraph" }
      ],
      headingWidth: "52%"
    },
    {
      content: [
        { rows: 2, type: "paragraph" },
        { itemRows: [1, 2, 1, 2], type: "list" },
        { rows: 2, type: "paragraph" }
      ],
      headingWidth: "48%"
    },
    {
      content: [
        { rows: 1, type: "paragraph" },
        { itemRows: [1, 2, 2, 2, 2, 3], type: "list" },
        { rows: 3, type: "paragraph" }
      ],
      headingWidth: "38%"
    },
    { content: [{ rows: 3, type: "paragraph" }], headingWidth: "44%" },
    { content: [{ rows: 3, type: "paragraph" }], headingWidth: "70%" },
    { content: [{ rows: 2, type: "paragraph" }], headingWidth: "24%" }
  ]
} as const satisfies Readonly<Record<LegalSkeletonRoutePath, readonly LegalSkeletonSectionProfile[]>>;

export function LegalPageSkeleton({ pathname, sectionProfiles }: { pathname: LegalSkeletonRoutePath; sectionProfiles: readonly LegalSkeletonSectionProfile[] }) {
  return (
    <PageSkeleton pathname={pathname} variant="legal">
      <article aria-hidden="true" className="legal-skeleton">
        <header className="legal-skeleton__meta">
          <SkeletonBlock height={14} width={188} />
        </header>
        <div className="legal-skeleton__body">
          {sectionProfiles.map((section, index) => (
            <section className="legal-skeleton__section" key={index}>
              <SkeletonBlock height={26} width={section.headingWidth} />
              <div className="legal-skeleton__content">
                {section.content.map((block, blockIndex) =>
                  block.type === "paragraph" ? (
                    <SkeletonText key={blockIndex} rows={block.rows} widths={["100%", "96%", "92%", "68%"]} />
                  ) : (
                    <ul className="legal-skeleton__list" key={blockIndex}>
                      {block.itemRows.map((rows, itemIndex) => (
                        <li className="legal-skeleton__list-item" key={itemIndex}>
                          <SkeletonBlock height={8} radius="999px" width={8} />
                          <SkeletonText rows={rows} widths={["100%", "92%", "76%"]} />
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            </section>
          ))}
        </div>
      </article>
    </PageSkeleton>
  );
}
