import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const navigationStyles = readFileSync(path.join(process.cwd(), "src", "styles", "navigation.css"), "utf8");
const layoutStyles = readFileSync(path.join(process.cwd(), "src", "styles", "layout.css"), "utf8");
const interactionStyles = readFileSync(path.join(process.cwd(), "src", "styles", "interactions.css"), "utf8");

describe("progressive footer styles", () => {
  it("reserves a stable overlay runway with a non-interactive activation band", () => {
    expect(navigationStyles).toMatch(/\.blob-footer\s*\{[^}]*display: grid/);
    expect(navigationStyles).toMatch(
      /\.blob-footer__runway,\s*\.blob-footer__island\s*\{[^}]*grid-area: 1 \/ 1/
    );
    expect(navigationStyles).toMatch(
      /\.blob-footer__runway\s*\{(?=[^}]*min-height: var\(--footer-stage-height, 24rem\))(?=[^}]*position: relative)(?=[^}]*pointer-events: none)[^}]*\}/
    );
    expect(navigationStyles).toMatch(
      /\.blob-footer__runway-sentinel\s*\{(?=[^}]*position: absolute)(?=[^}]*top: calc\(var\(--footer-compact-footprint, 66px\) \+ var\(--footer-runway-entry-gap\)\))(?=[^}]*width: 1px)(?=[^}]*height: var\(--footer-runway-band-height, 48px\))(?=[^}]*pointer-events: none)[^}]*\}/
    );
    expect(navigationStyles).not.toMatch(/\.blob-footer--expanded\s+\.blob-footer__runway\s*\{/);
  });

  it("reserves the expanded footer footprint in the shell at every breakpoint", () => {
    expect(layoutStyles).toMatch(
      /\.site-shell\s*\{(?=[^}]*--footer-compact-footprint: 66px)(?=[^}]*--footer-stage-height: 28rem)(?=[^}]*min-height: calc\(100vh \+ var\(--footer-stage-height\) - var\(--footer-compact-footprint\)\))[^}]*\}/
    );
    expect(layoutStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.site-shell\s*\{(?=[^}]*--footer-compact-footprint: 74px)(?=[^}]*--footer-stage-height: 44rem)[^}]*\}/
    );
    expect(layoutStyles).toMatch(
      /@media \(max-width: 520px\)[\s\S]*?\.site-shell\s*\{(?=[^}]*--footer-compact-footprint: 96px)(?=[^}]*--footer-stage-height: 48rem)[^}]*\}/
    );
  });

  it("animates the compact and expanded geometry without scale or blur transitions", () => {
    expect(navigationStyles).toMatch(/\.blob-footer__island\s*\{[^}]*max-width: var\(--header-compact-width\)/);
    expect(navigationStyles).toMatch(
      /\.blob-footer--expanded \.blob-footer__island\s*\{[^}]*max-width: var\(--container-width\)/
    );
    expect(navigationStyles).toMatch(/\.blob-footer__details\s*\{[^}]*grid-template-rows: 0fr/);
    expect(navigationStyles).toMatch(/\.blob-footer--expanded \.blob-footer__details\s*\{[^}]*grid-template-rows: 1fr/);
    expect(navigationStyles).not.toMatch(/\.blob-footer(?:--expanded)?(?: \.blob-footer__island)?\s*\{[^}]*scale\(/);
  });

  it("keeps the disclosure control's complete idle treatment unchanged when expanded", () => {
    expect(navigationStyles).toMatch(
      /\.blob-footer__toggle\.hover-base-1\s*\{(?=[^}]*--hover-base-1-control-selected-shadow: none)(?=[^}]*--hover-base-1-selected-layer-opacity: 0)(?=[^}]*--hover-base-1-selected-text: var\(--color-ink-strong\))[^}]*\}/
    );
    expect(navigationStyles).toMatch(
      /\.blob-footer__toggle\s*\{(?=[^}]*border: 1px solid var\(--color-line\))(?=[^}]*color: var\(--color-ink-strong\))(?=[^}]*background: var\(--color-control-surface-soft\))[^}]*\}/
    );
    expect(navigationStyles).not.toMatch(
      /(?:\.blob-footer--expanded\s+\.blob-footer__toggle|\.blob-footer__toggle\[aria-expanded="true"\])\s*\{[^}]*(?:background(?:-color)?|border(?:-color)?|color|box-shadow)\s*:/
    );
  });

  it("preserves the shared hover and keyboard-focus treatments for the footer toggle", () => {
    expect(interactionStyles).toMatch(
      /\.hover-base-1:not\(:disabled\):not\(\[aria-disabled="true"\]\):focus-visible\s*\{(?=[^}]*box-shadow: var\(--focus-ring\), var\(--hover-base-1-control-hover-shadow\))(?=[^}]*color: var\(--hover-base-1-hover-text\))(?=[^}]*transform: translateY\(-1px\))[^}]*\}/
    );
    expect(interactionStyles).toMatch(
      /\.hover-base-1:not\(:disabled\):not\(\[aria-disabled="true"\]\):focus-visible::before\s*\{(?=[^}]*background: var\(--hover-base-1-hover-surface\))(?=[^}]*box-shadow: inset 0 0 0 1px var\(--hover-base-1-hover-border\))(?=[^}]*opacity: var\(--hover-base-1-hover-layer-opacity\))[^}]*\}/
    );
    expect(interactionStyles).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.hover-base-1:not\(:disabled\):not\(\[aria-disabled="true"\]\):hover\s*\{(?=[^}]*box-shadow: var\(--hover-base-1-control-hover-shadow\))(?=[^}]*color: var\(--hover-base-1-hover-text\))(?=[^}]*transform: translateY\(-1px\))[^}]*\}/
    );
    expect(interactionStyles).toMatch(
      /@media \(hover: hover\) and \(pointer: fine\)[\s\S]*?\.hover-base-1:not\(:disabled\):not\(\[aria-disabled="true"\]\):hover::before\s*\{(?=[^}]*background: var\(--hover-base-1-hover-surface\))(?=[^}]*box-shadow: inset 0 0 0 1px var\(--hover-base-1-hover-border\))(?=[^}]*opacity: var\(--hover-base-1-hover-layer-opacity\))[^}]*\}/
    );
  });

  it("uses three desktop columns, one mobile column, and safe long-link wrapping", () => {
    expect(navigationStyles).toMatch(
      /\.blob-footer__details-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1\.25fr\) repeat\(2, minmax\(0, 1fr\)\)/
    );
    expect(navigationStyles).toMatch(
      /@media \(max-width: 720px\)[\s\S]*?\.blob-footer__details-grid\s*\{[^}]*grid-template-columns: minmax\(0, 1fr\)/
    );
    expect(navigationStyles).toMatch(/\.blob-footer__link\s*\{[^}]*overflow-wrap: anywhere/);
  });

  it("removes footer transitions and transforms for reduced motion", () => {
    expect(navigationStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.blob-footer__link\s*\{[^}]*transition: none[^}]*\}/
    );
    expect(navigationStyles).toMatch(
      /\.blob-footer__details-inner,\s*\.blob-footer--expanded \.blob-footer__details-inner\s*\{[^}]*transform: none/
    );
  });
});
