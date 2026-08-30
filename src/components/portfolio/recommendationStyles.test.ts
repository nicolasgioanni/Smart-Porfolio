import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const portfolioStyles = readFileSync(path.join(process.cwd(), "src", "styles", "portfolio.css"), "utf8");
const tokenStyles = readFileSync(path.join(process.cwd(), "src", "styles", "tokens.css"), "utf8");

describe("recommendation styles", () => {
  it("uses a true lower-line alpha mask only for collapsed overflowing quotes", () => {
    expect(portfolioStyles).toMatch(
      /\.recommendation-expandable\[data-can-expand="true"\]\[data-expanded="false"\] \.recommendation-expandable__viewport\s*\{[\s\S]*-webkit-mask-image:[\s\S]*mask-image:[\s\S]*calc\(100% - 0\.78em\)[\s\S]*transparent 100%/
    );
    expect(portfolioStyles).not.toMatch(/\.recommendation-expandable__viewport::after/);
  });

  it("keeps inline quote links bold at rest and adds only color and an underline during interaction", () => {
    const inlineLinkRule =
      portfolioStyles.match(/\.recommendation-expandable__inline-link\s*\{[^}]*}/s)?.[0] ?? "";
    const interactionRule =
      portfolioStyles.match(
        /\.recommendation-expandable__inline-link:hover,\s*\.recommendation-expandable__inline-link:focus-visible\s*\{[^}]*}/s
      )?.[0] ?? "";

    expect(inlineLinkRule).toMatch(/font-weight:\s*var\(--font-weight-bold\)/);
    expect(inlineLinkRule).toMatch(/text-decoration-line:\s*none/);
    expect(inlineLinkRule).not.toMatch(/background(?:-image)?:/);
    expect(interactionRule).toMatch(/color:\s*var\(--hover-base-1-inline-link-text\)/);
    expect(interactionRule).toMatch(/text-decoration-line:\s*underline/);
    expect(interactionRule).toMatch(/text-decoration-color:\s*currentColor/);
    expect(interactionRule).toMatch(/text-decoration-thickness:\s*0\.14em/);
    expect(interactionRule).not.toMatch(/background(?:-image)?:/);
    expect(tokenStyles.match(/--hover-base-1-inline-link-text:/g)).toHaveLength(3);
  });

  it("keeps shared Home row sizing as a minimum so one expanded card can grow independently", () => {
    expect(portfolioStyles).toMatch(
      /\.home-recommendations__item \.recommendation-card--summary\s*\{[\s\S]*min-height: var\(--recommendation-row-collapsed-height, auto\)/
    );
    expect(portfolioStyles).toMatch(
      /\.home-recommendations__item \.recommendation-expandable__toggle\s*\{[\s\S]*align-self: end/
    );
    expect(portfolioStyles).toMatch(/\.home-recommendations__grid\s*\{[\s\S]*align-items: start/);
  });

  it("uses one opaque theme-matched surface for summary cards and expanded detail overlays", () => {
    const themeSurfaces = [
      [/:root,\s*\[data-theme="navy"\]\s*\{([^}]*)\}/s, "#081627"],
      [/\[data-theme="light"\]\s*\{([^}]*)\}/s, "#fefeff"],
      [/\[data-theme="dark"\]\s*\{([^}]*)\}/s, "#14181f"]
    ] as const;

    for (const [themePattern, expectedSurface] of themeSurfaces) {
      const themeTokens = tokenStyles.match(themePattern)?.[1] ?? "";

      expect(themeTokens).toMatch(
        new RegExp(`--color-recommendation-card-solid:\\s*${expectedSurface}`, "i")
      );
    }

    expect(portfolioStyles).toMatch(
      /\.home-section--recommendations \.recommendation-card--summary\s*\{[^}]*background:\s*var\(--color-recommendation-card-solid\);[^}]*backdrop-filter:\s*none/
    );
    expect(portfolioStyles).toMatch(
      /\.recommendations-list\[data-layout-mode="overlay"\]\[data-overlay-ready="true"\][\s\S]*\.recommendation-card--detail\s*\{[^}]*position:\s*absolute;[^}]*background:\s*var\(--color-recommendation-card-solid\);[^}]*box-shadow:[^}]*backdrop-filter:\s*none/
    );
    expect(portfolioStyles).toMatch(
      /\.home-section__surface \.portfolio-card\s*\{[^}]*background:\s*var\(--color-surface-soft\)/
    );
  });

  it("wraps long recommendation identities while keeping verification visually quiet until interaction", () => {
    const identityRule = portfolioStyles.match(/\.recommendation-card__identity-row\s*\{[^}]*}/s)?.[0] ?? "";
    const nameRule = portfolioStyles.match(/\.recommendation-card__name\s*\{[^}]*}/s)?.[0] ?? "";
    const verificationRule = portfolioStyles.match(/\.recommendation-verification-link\s*\{[^}]*}/s)?.[0] ?? "";
    const verificationTextRule =
      portfolioStyles.match(/\.recommendation-verification-link__text\s*\{[^}]*}/s)?.[0] ?? "";
    const verificationInteractionRule =
      portfolioStyles.match(
        /\.recommendation-verification-link:hover \.recommendation-verification-link__text,\s*\.recommendation-verification-link:focus-visible \.recommendation-verification-link__text\s*\{[^}]*}/s
      )?.[0] ?? "";

    expect(identityRule).toMatch(/flex-wrap:\s*wrap/);
    expect(identityRule).toMatch(/justify-content:\s*space-between/);
    expect(nameRule).toMatch(/flex:\s*1 1 12rem/);
    expect(nameRule).toMatch(/min-width:\s*0/);
    expect(verificationRule).toMatch(/font-weight:\s*var\(--font-weight-regular\)/);
    expect(verificationRule).toMatch(/text-decoration:\s*none/);
    expect(verificationTextRule).toMatch(/font-weight:\s*var\(--font-weight-regular\)/);
    expect(verificationTextRule).toMatch(/text-decoration-line:\s*none/);
    expect(verificationInteractionRule).toMatch(/font-weight:\s*var\(--font-weight-bold\)/);
    expect(verificationInteractionRule).toMatch(/text-decoration-line:\s*underline/);
    expect(verificationInteractionRule).not.toContain("recommendation-verification-link__icon");
  });

  it("keeps detail rows fixed while elevating the active card and dimming only measured overlaps", () => {
    expect(portfolioStyles).toMatch(
      /\.recommendations-list\s*\{[^}]*padding-bottom:\s*var\(--recommendations-overlay-reserve, 0px\)/
    );
    expect(portfolioStyles).toMatch(
      /@media \(min-width: 981px\)[\s\S]*\.recommendations-list\[data-layout-mode="overlay"\]\[data-overlay-ready="true"\] \.recommendations-list__item\s*\{[^}]*height:\s*var\(--recommendation-detail-collapsed-height\)/
    );
    expect(portfolioStyles).toMatch(
      /@media \(min-width: 981px\)[\s\S]*\.recommendations-list\[data-layout-mode="overlay"\] \.recommendations-list__item\[data-expanded="true"\]\s*\{[^}]*z-index:\s*3/
    );
    expect(portfolioStyles).toMatch(
      /@media \(min-width: 981px\)[\s\S]*\.recommendations-list\[data-layout-mode="overlay"\] \.recommendations-list__item\[data-overlapped="true"\]\s*\{[^}]*opacity:\s*0\.58/
    );
  });

  it("keeps the Home panel collapsed while reserving normal flow for a protruding card", () => {
    expect(portfolioStyles).toMatch(
      /\.home-section--recommendations\[data-recommendation-overflow-layout="ready"\]\s*\{[\s\S]*padding-bottom: var\(--home-recommendations-overflow-reserve, 0px\)/
    );
    expect(portfolioStyles).toMatch(
      /\.home-section--recommendations\[data-recommendation-overflow-layout="ready"\] \.home-section__surface\s*\{[\s\S]*height: var\(--home-recommendations-panel-height\);[\s\S]*overflow: visible/
    );
    expect(portfolioStyles).toMatch(
      /\.home-section--recommendations\[data-recommendation-overflow-layout="ready"\] \.home-section__surface::before\s*\{[\s\S]*border-radius: inherit/
    );
    expect(portfolioStyles).not.toMatch(
      /\.home-section--recommendations\[data-recommendation-overflow-layout="ready"\][^{]*\{[^}]*(?:transform|margin-bottom):/
    );
  });

  it("defensively restores natural Home recommendation flow at responsive breakpoints", () => {
    expect(portfolioStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*\.home-section--recommendations\[data-recommendation-overflow-layout="ready"\]\s*\{[^}]*padding-bottom:\s*0/
    );
    expect(portfolioStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*\.home-section--recommendations\[data-recommendation-overflow-layout="ready"\] \.home-section__surface\s*\{[^}]*height:\s*auto;[^}]*overflow:\s*visible/
    );
    expect(portfolioStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.home-recommendations__item \.recommendation-card--summary\s*\{[^}]*min-height:\s*0/
    );
    expect(portfolioStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*\.recommendations-list\s*\{[^}]*padding-bottom:\s*0/
    );
    expect(portfolioStyles).toMatch(
      /@media \(max-width: 980px\)[\s\S]*\.recommendations-list__item\s*\{[^}]*height:\s*auto;[^}]*opacity:\s*1/
    );
  });

  it("still removes recommendation expansion transitions for reduced motion", () => {
    expect(portfolioStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.recommendation-expandable__viewport,\s*\.recommendation-expandable__quote,\s*\.recommendation-expandable__inline-link,\s*\.recommendations-list,\s*\.recommendations-list__item\s*\{[^}]*transition: none/
    );
  });
});
