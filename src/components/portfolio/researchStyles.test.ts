import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const researchStyles = readFileSync(path.join(process.cwd(), "src", "styles", "research.css"), "utf8");

describe("research showcase styles", () => {
  it("alternates the visualization and evidence columns on desktop", () => {
    const projectRule = researchStyles.match(/\.research-project\s*\{[^}]*}/s)?.[0] ?? "";
    const rightProjectRule =
      researchStyles.match(/\.research-project\[data-visual-side="right"\]\s*\{[^}]*}/s)?.[0] ?? "";
    const rightVisualRule =
      researchStyles.match(/\.research-project\[data-visual-side="right"\] \.research-project__visual\s*\{[^}]*}/s)?.[0] ?? "";
    const rightContentRule =
      researchStyles.match(/\.research-project\[data-visual-side="right"\] \.research-project__content\s*\{[^}]*}/s)?.[0] ?? "";
    const rightSkeletonRule =
      researchStyles.match(/\.research-skeleton__project\[data-visual-side="right"\]\s*\{[^}]*}/s)?.[0] ?? "";

    expect(projectRule).toMatch(/grid-template-columns:\s*minmax\(280px, 0\.82fr\) minmax\(0, 1\.18fr\)/);
    expect(rightProjectRule).toMatch(/grid-template-columns:\s*minmax\(0, 1\.18fr\) minmax\(280px, 0\.82fr\)/);
    expect(rightVisualRule).toMatch(/grid-column:\s*2/);
    expect(rightContentRule).toMatch(/grid-column:\s*1/);
    expect(rightContentRule).toMatch(/grid-row:\s*1/);
    expect(rightSkeletonRule).toMatch(/grid-template-columns:\s*minmax\(0, 1\.18fr\) minmax\(280px, 0\.82fr\)/);
  });

  it("stacks every visualization before its evidence below the desktop breakpoint", () => {
    expect(researchStyles).toMatch(
      /@media \(max-width: 920px\)[\s\S]*?\.research-project__visual,[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*1;[\s\S]*?\.research-project__content,[\s\S]*?grid-column:\s*1;[\s\S]*?grid-row:\s*2;/
    );
  });

  it("defines distinct project palettes and removes optional motion when requested", () => {
    expect(researchStyles).toMatch(/\.research-project\[data-project="aml"\]\s*\{/);
    expect(researchStyles).toMatch(/\.research-project\[data-project="guide-donor"\]\s*\{/);
    expect(researchStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.research-list\[data-motion="enabled"\] \.research-project-wrap[\s\S]*?animation:\s*none/
    );
  });

  it("uses opaque per-project surfaces behind every research diagram", () => {
    const visualSurfaces = [...researchStyles.matchAll(/--visual-surface:\s*([^;]+);/g)].map(([, surface]) => surface.trim());

    expect(visualSurfaces).toHaveLength(6);
    expect(visualSurfaces.every((surface) => /^#[\da-f]{6}$/i.test(surface))).toBe(true);
    expect(researchStyles).toMatch(/\.research-visual\s*{[^}]*background:\s*var\(--visual-surface\)/s);
  });

  it("keeps full-card elevation exclusive to pointer hover", () => {
    const sharedAttentionRule =
      researchStyles.match(/\.research-project:hover,\s*\.research-project:focus-within\s*\{[^}]*}/s)?.[0] ?? "";
    const hoverElevationRule = researchStyles.match(/\.research-project:hover\s*\{[^}]*}/s)?.[0] ?? "";

    expect(sharedAttentionRule).toMatch(/border-color:\s*var\(--detail-accent-border\)/);
    expect(sharedAttentionRule).not.toMatch(/box-shadow|transform/);
    expect(hoverElevationRule).toMatch(/box-shadow:\s*var\(--shadow-soft\)/);
    expect(hoverElevationRule).not.toMatch(/glow|gradient|0 0 64px/);
    expect(hoverElevationRule).toMatch(/transform:\s*translate3d\(0, -2px, 0\)/);
  });

  it("keeps research resource targets touch-safe and the header identity compact", () => {
    const resourceRule = researchStyles.match(/\.research-project__resource\s*\{[^}]*}/s)?.[0] ?? "";
    const pendingResourceRule = researchStyles.match(/\.research-project__resource--pending\s*\{[^}]*}/s)?.[0] ?? "";
    const identityRule = researchStyles.match(/\.research-project__identity\s*\{[^}]*}/s)?.[0] ?? "";

    expect(resourceRule).toMatch(/min-height:\s*44px/);
    expect(pendingResourceRule).toMatch(/min-height:\s*44px/);
    expect(identityRule).toMatch(/display:\s*flex/);
    expect(researchStyles).not.toMatch(/research-project__kicker-row/);
    expect(researchStyles).not.toMatch(/research-project__metadata/);
  });
});
