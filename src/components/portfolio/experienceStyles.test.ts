import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const detailStyles = readFileSync(path.join(process.cwd(), "src", "styles", "detail.css"), "utf8");

describe("shared detail styles", () => {
  it("pins the compact detail control to the intro panel's top-right corner", () => {
    const accessoryRule =
      detailStyles.match(
        /\.page-container--experience \.page-intro__accessory,\s*\.page-container--research \.page-intro__accessory\s*\{[^}]*}/s
      )?.[0] ?? "";
    const switchRule = detailStyles.match(/\.detail-mode-switch\s*\{[^}]*}/s)?.[0] ?? "";
    const buttonRule = detailStyles.match(/\.detail-mode-switch__button\s*\{[^}]*}/s)?.[0] ?? "";

    expect(accessoryRule).toMatch(/position:\s*absolute/);
    expect(accessoryRule).toMatch(/top:\s*var\(--space-4\)/);
    expect(accessoryRule).toMatch(/right:\s*var\(--space-4\)/);
    expect(switchRule).toMatch(/width:\s*12\.25rem/);
    expect(buttonRule).toMatch(/min-height:\s*34px/);
  });

  it("returns the control to document flow when the intro copy needs the width", () => {
    expect(detailStyles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.page-container--experience \.page-intro__accessory,\s*\.page-container--research \.page-intro__accessory\s*\{[^}]*position:\s*static/
    );
  });

  it("keeps desktop signals and disclosure icons in dedicated grid columns", () => {
    const signalRule = detailStyles.match(/\.detail-section__signal\s*\{[^}]*}/s)?.[0] ?? "";
    const iconRule = detailStyles.match(/\.detail-section__icon\s*\{[^}]*}/s)?.[0] ?? "";

    expect(signalRule).toMatch(/grid-column:\s*3/);
    expect(iconRule).toMatch(/grid-column:\s*4/);
    expect(detailStyles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*\.detail-section__signal\s*\{[^}]*grid-column:\s*2[\s\S]*\.detail-section__icon\s*\{[^}]*grid-column:\s*3/
    );
  });

  it("insets disclosure dividers without narrowing their trigger targets", () => {
    const listRule = detailStyles.match(/\.detail-list\s*\{[^}]*}/s)?.[0] ?? "";
    const sectionRule = detailStyles.match(/\.detail-section\s*\{[^}]*}/s)?.[0] ?? "";
    const dividerRule =
      detailStyles.match(/\.detail-list::before,\s*\.detail-section::before\s*\{[^}]*}/s)?.[0] ?? "";
    const accentDividerRule = detailStyles.match(/\.detail-section::after\s*\{[^}]*}/s)?.[0] ?? "";

    expect(listRule).toMatch(/border-top:\s*1px solid transparent/);
    expect(sectionRule).toMatch(/border-bottom:\s*1px solid transparent/);
    expect(dividerRule).toMatch(/right:\s*var\(--space-1\)/);
    expect(dividerRule).toMatch(/left:\s*var\(--space-1\)/);
    expect(accentDividerRule).toMatch(/right:\s*var\(--space-1\)/);
    expect(accentDividerRule).toMatch(/left:\s*var\(--space-1\)/);
  });
});
