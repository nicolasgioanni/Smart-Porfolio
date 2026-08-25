import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const experienceStyles = readFileSync(path.join(process.cwd(), "src", "styles", "experience.css"), "utf8");

describe("experience styles", () => {
  it("places the detail control at the top right of the combined desktop intro", () => {
    const introSurfaceRule =
      experienceStyles.match(/\.page-container--experience \.page-intro__surface\s*\{[^}]*}/s)?.[0] ?? "";
    const introAccessoryRule =
      experienceStyles.match(/\.page-container--experience \.page-intro__accessory\s*\{[^}]*}/s)?.[0] ?? "";
    const modeControlRule = experienceStyles.match(/\.experience-mode-control\s*\{[^}]*}/s)?.[0] ?? "";

    expect(introSurfaceRule).toMatch(/display:\s*grid/);
    expect(introSurfaceRule).toMatch(/grid-template-columns:\s*minmax\(0, 1fr\) auto/);
    expect(introSurfaceRule).toMatch(/align-items:\s*start/);
    expect(introAccessoryRule).toMatch(/justify-self:\s*end/);
    expect(modeControlRule).toMatch(/justify-content:\s*flex-end/);
  });

  it("stretches the combined intro control and switch at narrow widths", () => {
    expect(experienceStyles).toMatch(
      /@media \(max-width: 760px\)[\s\S]*?\.page-container--experience \.page-intro__surface\s*\{[^}]*grid-template-columns:\s*minmax\(0, 1fr\)[^}]*}[\s\S]*?\.page-container--experience \.page-intro__accessory\s*\{[^}]*justify-self:\s*stretch[^}]*width:\s*100%/
    );
    expect(experienceStyles).toMatch(
      /@media \(max-width: 520px\)[\s\S]*?\.experience-mode-control\s*\{[^}]*flex-direction:\s*column[^}]*}[\s\S]*?\.experience-mode-switch\s*\{[^}]*flex-basis:\s*auto[^}]*width:\s*100%/
    );
  });

  it("keeps desktop signals and disclosure icons in dedicated grid columns", () => {
    const signalRule = experienceStyles.match(/\.experience-chapter__signal\s*\{[^}]*}/s)?.[0] ?? "";
    const iconRule = experienceStyles.match(/\.experience-chapter__icon\s*\{[^}]*}/s)?.[0] ?? "";

    expect(signalRule).toMatch(/grid-column:\s*3/);
    expect(iconRule).toMatch(/grid-column:\s*4/);
    expect(experienceStyles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*\.experience-chapter__signal\s*\{[^}]*grid-column:\s*2[\s\S]*\.experience-chapter__icon\s*\{[^}]*grid-column:\s*3/
    );
  });

  it("insets chapter dividers without narrowing hover targets", () => {
    const chaptersRule = experienceStyles.match(/\.experience-card__chapters\s*\{[^}]*}/s)?.[0] ?? "";
    const chapterRule = experienceStyles.match(/\.experience-chapter\s*\{[^}]*}/s)?.[0] ?? "";
    const dividerRule =
      experienceStyles.match(
        /\.experience-card__chapters::before,\s*\.experience-chapter::before\s*\{[^}]*}/s
      )?.[0] ?? "";
    const accentDividerRule = experienceStyles.match(/\.experience-chapter::after\s*\{[^}]*}/s)?.[0] ?? "";

    expect(chaptersRule).toMatch(/border-top:\s*1px solid transparent/);
    expect(chapterRule).toMatch(/border-bottom:\s*1px solid transparent/);
    expect(dividerRule).toMatch(/right:\s*var\(--space-1\)/);
    expect(dividerRule).toMatch(/left:\s*var\(--space-1\)/);
    expect(accentDividerRule).toMatch(/right:\s*var\(--space-1\)/);
    expect(accentDividerRule).toMatch(/left:\s*var\(--space-1\)/);
  });
});
