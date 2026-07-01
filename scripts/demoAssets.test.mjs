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

const requiredDemoAssets = [
  "/images/profile/portrait-placeholder.png",
  "/images/projects/project-placeholder.png",
  "/images/research/research-placeholder.png",
  "/favicon/favicon.png",
  "/resume/demo-resume.pdf",
];

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

function collectDemoAssetReferences(text) {
  const rootRelativePathPattern = /\/(?:images|favicon|resume)\/[^\s,"|]+/g;
  const matches = text.match(rootRelativePathPattern) ?? [];

  return [...new Set(matches)].filter(
    (assetPath) =>
      assetPath.includes("placeholder") ||
      assetPath === "/favicon/favicon.png" ||
      assetPath === "/resume/demo-resume.pdf",
  );
}

describe("demo asset references", () => {
  it("keeps local placeholder assets available for template and generated demo content", () => {
    const templateReferences = collectDemoAssetReferences(readTemplateText());
    const generatedReferences = existsSync(generatedContentPath)
      ? collectDemoAssetReferences(readFileSync(generatedContentPath, "utf8"))
      : [];
    const references = [...new Set([...templateReferences, ...generatedReferences])];

    expect(references).toEqual(expect.arrayContaining(requiredDemoAssets));

    for (const assetPath of references) {
      const publicPath = path.join(projectRoot, "public", assetPath.slice(1));

      expect(existsSync(publicPath), `${assetPath} should exist under public`).toBe(true);
      expect(statSync(publicPath).size, `${assetPath} should not be empty`).toBeGreaterThan(0);
    }
  });
});
