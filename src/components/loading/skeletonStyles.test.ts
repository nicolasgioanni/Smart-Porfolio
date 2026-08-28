import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const skeletonStyles = readFileSync(path.join(process.cwd(), "src", "styles", "skeletons.css"), "utf8");
const motionStyles = readFileSync(path.join(process.cwd(), "src", "styles", "motion.css"), "utf8");
const experienceStyles = readFileSync(path.join(process.cwd(), "src", "styles", "experience.css"), "utf8");
const researchStyles = readFileSync(path.join(process.cwd(), "src", "styles", "research.css"), "utf8");

describe("skeleton style contracts", () => {
  it("keeps loading roots outside resolved page-entry animation and matches page container spacing", () => {
    expect(skeletonStyles).toMatch(
      /\.skeleton-page\s*\{[^}]*width: min\(var\(--container-width\), calc\(100% - 32px\)\)[^}]*padding: var\(--space-10\) 0 0/s
    );
    expect(skeletonStyles).toMatch(/\.skeleton-page--home\s*\{[^}]*padding-top: var\(--space-8\)/s);
    expect(skeletonStyles).toMatch(/\.skeleton-page--legal\s*\{[^}]*width: min\(940px, calc\(100% - 32px\)\)/s);
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 860px\)[\s\S]*?\.skeleton-page__title\s*\{[^}]*height: 25px !important/s
    );
    expect(motionStyles).not.toMatch(/\.skeleton-page[^}]*animation:\s*page-body-enter/);
  });

  it("retains a reduced-motion shimmer escape hatch", () => {
    expect(skeletonStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)\s*\{\s*\.skeleton-block\s*\{\s*animation: none;/s
    );
  });

  it("preserves route geometry and responsive breakpoints from the resolved page styles", () => {
    expect(skeletonStyles).toMatch(
      /\.home-skeleton__hero\s*\{[^}]*grid-template-areas:\s*"profile introduction"\s*"profile details"[^}]*grid-template-columns: minmax\(240px, 320px\) minmax\(0, 1fr\)/s
    );
    expect(skeletonStyles).toMatch(/\.home-skeleton__introduction\s*\{[^}]*grid-area: introduction/s);
    expect(skeletonStyles).toMatch(/\.detail-card-skeleton-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s);
    expect(skeletonStyles).toMatch(/\.contact-skeleton\s*\{[^}]*width: min\(100%, 780px\)[^}]*min-height: 34rem/s);
    expect(skeletonStyles).toMatch(/\.contact-skeleton\s*\{[^}]*gap: var\(--space-5\)/s);
    expect(skeletonStyles).toMatch(/\.resume-skeleton\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\) minmax\(15rem, auto\)/s);
    expect(skeletonStyles).toMatch(/\.legal-skeleton__body\s*\{[^}]*max-width: 74ch/s);
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.home-skeleton__hero\s*\{[^}]*grid-template-areas:\s*"profile"\s*"introduction"\s*"details"[^}]*grid-template-columns: minmax\(0, 1fr\)/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.home-skeleton__card-grid,\s*\.detail-card-skeleton-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.home-skeleton__card-grid--recommendations,\s*\.home-skeleton__skill-grid\s*\{[^}]*grid-template-columns: repeat\(2, minmax\(0, 1fr\)\)/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*?\.home-skeleton__portrait\s*\{[^}]*width: clamp\(150px, 28vw, 220px\) !important[^}]*height: clamp\(150px, 28vw, 220px\) !important/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.home-skeleton__academic-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.home-skeleton__hero\s*\{[^}]*grid-template-areas:\s*"introduction"\s*"profile"\s*"details"/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.home-skeleton__profile\s*\{[^}]*grid-template-columns: minmax\(96px, 0\.82fr\) minmax\(0, 1\.18fr\)[^}]*width: 100%/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.home-skeleton__portrait-column\s*\{[^}]*grid-column: 1/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.home-skeleton__identity-list\s*\{[^}]*grid-column: 2[^}]*border-inline-start: 1px solid var\(--color-line\)/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.home-skeleton__portrait\s*\{[^}]*width: clamp\(96px, 28vw, 132px\) !important[^}]*height: clamp\(96px, 28vw, 132px\) !important/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.home-skeleton__card-grid--recommendations,\s*\.home-skeleton__skill-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?\.resume-skeleton\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)[^}]*align-items: start[^}]*padding: var\(--space-6\)/s
    );
    expect(skeletonStyles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*?\.resume-skeleton__actions\s*\{[^}]*width: 100%[\s\S]*?\.resume-skeleton__actions \.skeleton-button\s*\{[^}]*width: 100% !important/s
    );
    const tabletRules = skeletonStyles.slice(
      skeletonStyles.indexOf("@media (max-width: 980px)"),
      skeletonStyles.indexOf("@media (max-width: 860px)")
    );
    expect(tabletRules).not.toContain(".home-skeleton__academic-grid");
    const phoneRules = skeletonStyles.slice(
      skeletonStyles.indexOf("@media (max-width: 720px)"),
      skeletonStyles.indexOf("@media (max-width: 620px)")
    );
    expect(phoneRules).not.toContain(".resume-skeleton");
  });

  it("matches strong intro surfaces to their resolved GlassSurface counterparts", () => {
    expect(experienceStyles).toMatch(
      /\.experience-skeleton__intro\s*\{[^}]*border: 1px solid var\(--color-line-strong\)[^}]*background: var\(--color-surface-strong\)[^}]*box-shadow: var\(--shadow-soft\), var\(--shadow-glow\)[^}]*backdrop-filter: blur\(var\(--glass-blur-mobile\)\)/s
    );
    expect(researchStyles).toMatch(
      /\.research-skeleton__intro\s*\{[^}]*border: 1px solid var\(--color-line-strong\)[^}]*background: var\(--color-surface-strong\)[^}]*box-shadow: var\(--shadow-soft\), var\(--shadow-glow\)[^}]*backdrop-filter: blur\(var\(--glass-blur-mobile\)\)/s
    );
    expect(experienceStyles).toMatch(
      /\.experience-skeleton__card\s*\{[^}]*border: 1px solid var\(--color-line\)[^}]*background: var\(--color-surface\)[^}]*box-shadow: var\(--shadow-card\)/s
    );
    expect(researchStyles).toMatch(
      /\.research-skeleton__project\s*\{[^}]*border: 1px solid var\(--color-line\)[^}]*background: var\(--color-surface\)[^}]*box-shadow: var\(--shadow-card\)/s
    );
  });

  it("uses resolved opaque fallbacks when glass effects are unavailable", () => {
    expect(skeletonStyles).toMatch(
      /:where\(html\[data-glass-effects="false"\], \.site-shell\[data-glass-effects="false"\]\) :is\([\s\S]*?\.home-skeleton__section,[\s\S]*?\.experience-skeleton__card,[\s\S]*?\.research-skeleton__project[\s\S]*?\)\s*\{[^}]*background: var\(--color-background-elevated\)[^}]*backdrop-filter: none;/s
    );
    expect(skeletonStyles).toMatch(
      /:where\(html\[data-glass-effects="false"\], \.site-shell\[data-glass-effects="false"\]\) :is\([\s\S]*?\.skeleton-page__header,[\s\S]*?\.experience-skeleton__intro,[\s\S]*?\.research-skeleton__intro[\s\S]*?\)\s*\{[^}]*background: var\(--color-surface-strong\)[^}]*box-shadow: var\(--shadow-soft\), var\(--shadow-glow\)[^}]*backdrop-filter: none;/s
    );
    expect(skeletonStyles).toMatch(
      /:where\(html\[data-glass-effects="false"\], \.site-shell\[data-glass-effects="false"\]\) \.detail-card-skeleton\s*\{[^}]*background: var\(--color-card-surface-strong\)[^}]*backdrop-filter: none;/s
    );
  });
});
