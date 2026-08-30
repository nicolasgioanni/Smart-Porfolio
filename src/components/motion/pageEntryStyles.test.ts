import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const motionStyles = readFileSync(path.join(process.cwd(), "src", "styles", "motion.css"), "utf8");

describe("page entry motion styles", () => {
  it("animates only resolved page content with a short opacity and transform entrance", () => {
    expect(motionStyles).toMatch(
      /\.site-main > \.page-container\s*\{[^}]*animation: page-body-enter 280ms cubic-bezier\(0\.16, 1, 0\.3, 1\)/
    );
    expect(motionStyles).toMatch(
      /@keyframes page-body-enter\s*\{\s*from\s*\{\s*opacity: 0;\s*transform: translateY\(8px\);\s*\}\s*to\s*\{\s*opacity: 1;\s*transform: translateY\(0\);/
    );
    expect(motionStyles).not.toMatch(/\.site-main\s*\{[^}]*animation:/);
    expect(motionStyles).not.toMatch(/\.skeleton-page[^}]*animation:\s*page-body-enter/);
  });

  it("renders page content immediately when reduced motion is requested", () => {
    expect(motionStyles).toMatch(
      /@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.site-main > \.page-container\s*\{\s*animation: none;/
    );
  });

  it("uses only an opacity snapshot fade for hydrated palette changes when motion is allowed", () => {
    const themeTransitionStyles = motionStyles.match(
      /@media \(prefers-reduced-motion: no-preference\)\s*\{([\s\S]*?)\}\s*@keyframes theme-palette-fade\s*\{([\s\S]*?)\n\}/
    )?.[0];

    expect(themeTransitionStyles).toMatch(
      /::view-transition-group\(root\)\s*\{\s*animation-duration: 160ms;\s*animation-timing-function: cubic-bezier\(0\.2, 0, 0, 1\);/
    );
    expect(themeTransitionStyles).toMatch(
      /::view-transition,\s*::view-transition-group\(\*\),\s*::view-transition-image-pair\(\*\),\s*::view-transition-old\(\*\),\s*::view-transition-new\(\*\)\s*\{\s*pointer-events: none;/
    );
    expect(themeTransitionStyles).toMatch(
      /::view-transition-old\(root\)\s*\{\s*animation: theme-palette-hold 160ms cubic-bezier\(0\.2, 0, 0, 1\);/
    );
    expect(themeTransitionStyles).toMatch(
      /::view-transition-new\(root\)\s*\{\s*animation: theme-palette-fade 160ms cubic-bezier\(0\.2, 0, 0, 1\);/
    );
    expect(themeTransitionStyles).toMatch(/from\s*\{\s*opacity: 0;\s*\}\s*to\s*\{\s*opacity: 1;/);
    expect(motionStyles).toMatch(
      /@keyframes theme-palette-hold\s*\{\s*from\s*\{\s*opacity: 1;\s*\}\s*to\s*\{\s*opacity: 1;/
    );
    expect(themeTransitionStyles).not.toMatch(/transform:|filter:|transition:/);
  });
});
