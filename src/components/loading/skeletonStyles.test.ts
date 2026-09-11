import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const skeletonStyles = readFileSync(path.join(process.cwd(), "src", "styles", "skeletons.css"), "utf8");
const motionStyles = readFileSync(path.join(process.cwd(), "src", "styles", "motion.css"), "utf8");

describe("skeleton visual contracts", () => {
  it("keeps loading roots outside resolved page-entry animation and matches page container spacing", () => {
    expect(skeletonStyles).toMatch(
      /\.skeleton-page\s*\{[^}]*width: min\(var\(--container-width\), calc\(100% - 32px\)\)[^}]*padding: var\(--space-10\) 0 0/s
    );
    expect(skeletonStyles).toMatch(/\.skeleton-page--home\s*\{[^}]*padding-top: var\(--space-8\)/s);
    expect(skeletonStyles).toMatch(/\.skeleton-page--legal\s*\{[^}]*width: min\(940px, calc\(100% - 32px\)\)/s);
    expect(motionStyles).not.toMatch(/\.skeleton-page[^}]*animation:\s*page-body-enter/);
  });

  it("retains a reduced-motion shimmer escape hatch", () => {
    expect(skeletonStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.skeleton-block\s*\{\s*animation: none;/s
    );
  });

  it("preserves the current page geometries at desktop and narrow widths", () => {
    expect(skeletonStyles).toMatch(
      /\.home-skeleton__hero\s*\{[^}]*grid-template-areas: "profile details"[^}]*grid-template-columns: minmax\(240px, 320px\) minmax\(0, 1fr\)/s
    );
    expect(skeletonStyles).toMatch(/\.detail-card-skeleton-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
    expect(skeletonStyles).toMatch(/\.contact-skeleton\s*\{[^}]*width: min\(100%, 780px\)[^}]*min-height: 34rem/s);
    expect(skeletonStyles).toMatch(/\.resume-skeleton\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(15rem, auto\)/s);
    expect(skeletonStyles).toMatch(/\.legal-skeleton__body\s*\{[^}]*max-width: 74ch/s);
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 860px\)[\s\S]*?\.home-skeleton__academic-grid,[\s\S]*?\.detail-card-skeleton-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s
    );
  });
});
