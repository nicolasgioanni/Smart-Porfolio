import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const templateDirectory = path.join(projectRoot, "src", "content", "templates");
const generatedContentPath = path.join(
  projectRoot,
  "src",
  "content",
  "generated",
  "portfolio.generated.json",
);

const requiredLocalAssets = ["/favicon/favicon.png"];

function readTemplateText() {
  const templateFiles = [
    "profile.csv",
    "links.csv",
    "research.csv",
    "projects.csv",
    "experience.csv",
    "recommendations.csv",
    "education.csv",
    "skills.csv",
    "resume.csv",
    "site_settings.csv",
  ];

  return templateFiles
    .map((fileName) => readFileSync(path.join(templateDirectory, fileName), "utf8"))
    .join("\n");
}

function collectLocalAssetReferences(text) {
  const rootRelativePathPattern = /\/(?:images|favicon|resume)\/[^\s,"|]+/g;
  const matches = text.match(rootRelativePathPattern) ?? [];

  return [...new Set(matches)];
}

describe("demo asset references", () => {
  it("keeps local assets available for template and generated content", () => {
    const templateReferences = collectLocalAssetReferences(readTemplateText());
    const generatedReferences = existsSync(generatedContentPath)
      ? collectLocalAssetReferences(readFileSync(generatedContentPath, "utf8"))
      : [];
    const references = [...new Set([...templateReferences, ...generatedReferences])];

    expect(references).toEqual(expect.arrayContaining(requiredLocalAssets));

    for (const assetPath of references) {
      const publicPath = path.join(projectRoot, "public", assetPath.slice(1));

      expect(existsSync(publicPath), `${assetPath} should exist under public`).toBe(true);
      expect(statSync(publicPath).size, `${assetPath} should not be empty`).toBeGreaterThan(0);
    }
  });
});
