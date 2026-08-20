import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const portfolioStyles = readFileSync(path.join(process.cwd(), "src", "styles", "portfolio.css"), "utf8");

describe("recommendation styles", () => {
  it("uses a true lower-line alpha mask only for collapsed overflowing quotes", () => {
    expect(portfolioStyles).toMatch(
      /\.recommendation-expandable\[data-can-expand="true"\]\[data-expanded="false"\] \.recommendation-expandable__viewport\s*\{[\s\S]*-webkit-mask-image:[\s\S]*mask-image:[\s\S]*calc\(100% - 0\.78em\)[\s\S]*transparent 100%/
    );
    expect(portfolioStyles).not.toMatch(/\.recommendation-expandable__viewport::after/);
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

  it("still removes recommendation expansion transitions for reduced motion", () => {
    expect(portfolioStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.recommendation-expandable__viewport,[\s\S]*\.recommendation-expandable__quote\s*\{[\s\S]*transition: none/
    );
  });
});
