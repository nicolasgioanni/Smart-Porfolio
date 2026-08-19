import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const navigationStyles = readFileSync(path.join(process.cwd(), "src", "styles", "navigation.css"), "utf8");

describe("progressive footer styles", () => {
  it("uses a fixed, non-interactive trigger that cannot change footer layout", () => {
    expect(navigationStyles).toMatch(
      /\.blob-footer__viewport-trigger\s*\{(?=[^}]*position: absolute)(?=[^}]*(?:height|block-size): 64px)(?=[^}]*pointer-events: none)[^}]*\}/
    );
  });

  it("animates the compact and expanded geometry without scale or blur transitions", () => {
    expect(navigationStyles).toMatch(/\.blob-footer\s*\{[\s\S]*max-width: var\(--header-compact-width\)/);
    expect(navigationStyles).toMatch(/\.blob-footer--expanded\s*\{[\s\S]*max-width: var\(--container-width\)/);
    expect(navigationStyles).toMatch(/\.blob-footer__details\s*\{[\s\S]*grid-template-rows: 0fr/);
    expect(navigationStyles).toMatch(/\.blob-footer--expanded \.blob-footer__details\s*\{[\s\S]*grid-template-rows: 1fr/);
    expect(navigationStyles).not.toMatch(/\.blob-footer(?:--expanded)?\s*\{[^}]*scale\(/);
  });

  it("uses three desktop columns, one mobile column, and safe long-link wrapping", () => {
    expect(navigationStyles).toMatch(
      /\.blob-footer__details-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1\.25fr\) repeat\(2, minmax\(0, 1fr\)\)/
    );
    expect(navigationStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*\.blob-footer__details-grid\s*\{[\s\S]*grid-template-columns: minmax\(0, 1fr\)/
    );
    expect(navigationStyles).toMatch(/\.blob-footer__link\s*\{[\s\S]*overflow-wrap: anywhere/);
  });

  it("removes footer transitions and transforms for reduced motion", () => {
    expect(navigationStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*\.blob-footer__details-inner[\s\S]*transition: none/
    );
    expect(navigationStyles).toMatch(
      /\.blob-footer__details-inner,[\s\S]*\.blob-footer--expanded \.blob-footer__details-inner\s*\{[\s\S]*transform: none/
    );
  });
});
