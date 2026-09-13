import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const detailStyles = readFileSync(path.join(process.cwd(), "src", "styles", "detail.css"), "utf8");
const experienceStyles = readFileSync(path.join(process.cwd(), "src", "styles", "experience.css"), "utf8");

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
    expect(buttonRule).toMatch(/min-width:\s*44px/);
    expect(buttonRule).toMatch(/min-height:\s*44px/);
    expect(detailStyles).not.toMatch(/@media \(pointer: coarse\)[\s\S]*\.detail-mode-switch__button/);
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

  it("clips disclosure grid motion outside the capped, keyboard-scrollable body", () => {
    const clipRule = detailStyles.match(/\.detail-section__panel-clip\s*\{[^}]*}/s)?.[0] ?? "";
    const scrollBaseRule = detailStyles.match(/\.detail-section__panel-scroll\s*\{[^}]*}/s)?.[0] ?? "";
    const scrollRule =
      detailStyles.match(
        /@media \(min-width: 981px\)[\s\S]*?\.detail-list\[data-layout-mode="overlay"\] \.detail-section__panel-scroll\s*\{[^}]*}/
      )?.[0] ?? "";
    const focusRule = detailStyles.match(/\.detail-section__panel-scroll:focus-visible\s*\{[^}]*}/s)?.[0] ?? "";

    expect(clipRule).toMatch(/min-height:\s*0/);
    expect(clipRule).toMatch(/overflow:\s*hidden/);
    expect(clipRule).not.toMatch(/max-block-size|overflow:\s*auto/);
    expect(scrollBaseRule).toMatch(/min-block-size:\s*0/);
    expect(scrollRule).toMatch(/max-block-size:\s*60dvh/);
    expect(scrollRule).toMatch(/overflow-x:\s*hidden/);
    expect(scrollRule).toMatch(/overflow-y:\s*auto/);
    expect(scrollRule).toMatch(/overscroll-behavior:\s*contain/);
    expect(focusRule).toMatch(/inset 0 0 0 2px var\(--color-canvas\), inset 0 0 0 5px var\(--color-focus-ring\)/);
  });

  it("keeps full-card elevation exclusive to pointer hover", () => {
    const sharedAttentionRule =
      experienceStyles.match(/\.experience-card:hover,\s*\.experience-card:focus-within\s*\{[^}]*}/s)?.[0] ?? "";
    const hoverElevationRule = experienceStyles.match(/\.experience-card:hover\s*\{[^}]*}/s)?.[0] ?? "";

    expect(sharedAttentionRule).toMatch(/border-color:\s*var\(--color-line-strong\)/);
    expect(sharedAttentionRule).not.toMatch(/box-shadow|transform/);
    expect(hoverElevationRule).toMatch(/box-shadow:\s*var\(--shadow-soft\)/);
    expect(hoverElevationRule).not.toMatch(/glow|gradient/);
    expect(hoverElevationRule).toMatch(/transform:\s*translate3d\(0, -2px, 0\)/);
  });
});
