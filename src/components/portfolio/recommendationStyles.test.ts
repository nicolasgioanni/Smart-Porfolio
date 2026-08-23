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

  it("styles inline quote links as bold underlined text with hover and keyboard-focus feedback", () => {
    const inlineLinkRule =
      portfolioStyles.match(/\.recommendation-expandable__inline-link\s*\{[^}]*}/s)?.[0] ?? "";
    const interactionRule =
      portfolioStyles.match(
        /\.recommendation-expandable__inline-link:hover,\s*\.recommendation-expandable__inline-link:focus-visible\s*\{[^}]*}/s
      )?.[0] ?? "";

    expect(inlineLinkRule).toMatch(/font-weight:\s*var\(--font-weight-bold\)/);
    expect(inlineLinkRule).toMatch(/text-decoration-line:\s*underline/);
    expect(interactionRule).toMatch(/color:\s*var\(--color-accent-strong\)/);
    expect(interactionRule).toMatch(/text-decoration-thickness:\s*0\.14em/);
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

  it("uses an opaque theme-matched surface for Home recommendation cards", () => {
    const themeSurfaces = [
      [/:root,\s*\[data-theme="navy"\]\s*\{([^}]*)\}/s, "#081627"],
      [/\[data-theme="light"\]\s*\{([^}]*)\}/s, "#fefeff"],
      [/\[data-theme="dark"\]\s*\{([^}]*)\}/s, "#14181f"]
    ] as const;

    for (const [themePattern, expectedSurface] of themeSurfaces) {
      const themeTokens = tokenStyles.match(themePattern)?.[1] ?? "";

      expect(themeTokens).toMatch(
        new RegExp(`--color-home-recommendation-card-solid:\\s*${expectedSurface}`, "i")
      );
    }

    expect(portfolioStyles).toMatch(
      /\.home-section--recommendations \.recommendation-card--summary\s*\{[^}]*background:\s*var\(--color-home-recommendation-card-solid\);[^}]*backdrop-filter:\s*none/
    );
    expect(portfolioStyles).toMatch(
      /\.home-section__surface \.portfolio-card\s*\{[^}]*background:\s*var\(--color-surface-soft\)/
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

  it("still removes recommendation expansion transitions for reduced motion", () => {
    expect(portfolioStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.recommendation-expandable__viewport,\s*\.recommendation-expandable__quote,\s*\.recommendation-expandable__inline-link\s*\{[^}]*transition: none/
    );
  });
});
