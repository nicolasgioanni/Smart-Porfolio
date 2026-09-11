import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");

async function readProjectFile(relativePath) {
  return readFile(path.join(projectRoot, relativePath), "utf8");
}

describe("skeleton regression guidance", () => {
  it("keeps the fragile visual and transition contracts discoverable", async () => {
    const [repositoryGuidance, skill, skeletonGuide] = await Promise.all([
      readProjectFile("AGENTS.md"),
      readProjectFile(".agents/skills/portfolio-skeleton-regression/SKILL.md"),
      readProjectFile("docs/SKELETON_LOADING_GUIDELINES.md")
    ]);

    for (const source of [repositoryGuidance, skill]) {
      expect(source).toContain("Ubuntu 24.04");
      expect(source).toContain("React-owned DOM");
      expect(source).toMatch(/static export/i);
    }

    expect(repositoryGuidance).toContain(
      ".agents/skills/portfolio-skeleton-regression/SKILL.md"
    );
    expect(skill.replaceAll("\r\n", "\n")).toMatch(
      /^---\nname: portfolio-skeleton-regression\ndescription: .+\n---/
    );
    expect(skill).toContain("same-origin fixture route");
    expect(skill).toContain("zero-difference screenshots");
    expect(skill).toContain("source body rather than mounting a streamable fallback");
    expect(skill).toContain("canonical local-template detail items");
    expect(skill).toContain("generated-workbook data");
    expect(repositoryGuidance).toContain("intentional control-shaped geometry");
    expect(repositoryGuidance).toContain("real interactive controls");
    expect(repositoryGuidance).toContain("canonical local-template detail items");
    expect(skeletonGuide).toContain("canonical local-template detail items");
    expect(skeletonGuide).toContain("generated-workbook driven");
    expect(skeletonGuide).toContain(
      "[repository skeleton regression skill](../.agents/skills/portfolio-skeleton-regression/SKILL.md)"
    );
  });

  it("retains the established Research media safeguards while adding skeleton guidance", async () => {
    const repositoryGuidance = await readProjectFile("AGENTS.md");

    for (const contract of [
      "ResearchGraphicalAbstractPreview",
      "researchVideos.ts",
      "researchVideoAssets.test.ts",
      "16 MiB video and 64 KiB-per-text-asset read ceilings"
    ]) {
      expect(repositoryGuidance).toContain(contract);
    }
  });
});
