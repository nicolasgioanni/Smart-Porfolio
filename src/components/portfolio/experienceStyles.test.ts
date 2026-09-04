import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const experienceStyles = readFileSync(path.join(process.cwd(), "src", "styles", "experience.css"), "utf8");

describe("experience chapter styles", () => {
  it("keeps desktop signals and disclosure icons in dedicated grid columns", () => {
    const signalRule = experienceStyles.match(/\.experience-chapter__signal\s*\{[^}]*}/s)?.[0] ?? "";
    const iconRule = experienceStyles.match(/\.experience-chapter__icon\s*\{[^}]*}/s)?.[0] ?? "";

    expect(signalRule).toMatch(/grid-column:\s*3/);
    expect(iconRule).toMatch(/grid-column:\s*4/);
    expect(experienceStyles).toMatch(
      /@media \(max-width: 620px\)[\s\S]*\.experience-chapter__signal\s*\{[^}]*grid-column:\s*2[\s\S]*\.experience-chapter__icon\s*\{[^}]*grid-column:\s*3/
    );
  });
});
