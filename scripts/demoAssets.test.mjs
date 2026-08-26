import { existsSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
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
const profileFaviconPath = path.join(projectRoot, "public", "favicon", "favicon.png");
const rootFaviconPath = path.join(projectRoot, "public", "favicon.ico");
const expectedProfileFaviconSha256 = "24e6115767710a44e7a7d27947d1fb0c822b3a9b6c8892475c7d089c762054a1";
const expectedRootFaviconSha256 = "e7a8e31c3c178392b8bc87f5b27c41520f507b71ea9212bf2b33e14e3d9fefc0";
const expectedRootFaviconSizes = [16, 32, 48, 64, 128, 256];
const privateResumeAssets = [
  path.join(projectRoot, "public", "resume", "Nicolas-Gioanni-Resume.pdf"),
  path.join(projectRoot, "public", "resume", "demo-resume.pdf"),
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

function collectLocalAssetReferences(text) {
  const rootRelativePathPattern = /\/(?:images|favicon|resume)\/[^\s,"|]+/g;
  const matches = text.match(rootRelativePathPattern) ?? [];

  return [...new Set(matches)];
}

function sha256(content) {
  return createHash("sha256").update(content).digest("hex");
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

  it("does not publish resume PDF assets", () => {
    const templateText = readTemplateText();
    const resumeTemplateText = readFileSync(path.join(templateDirectory, "resume.csv"), "utf8").trim();
    const generatedText = existsSync(generatedContentPath)
      ? readFileSync(generatedContentPath, "utf8")
      : "";

    expect(`${templateText}\n${generatedText}`).not.toMatch(/\/resume\/[^\s,"|]+\.pdf/i);
    expect(resumeTemplateText).toBe("section,key,value,order");
    expect(JSON.parse(generatedText).resume).toEqual([]);

    for (const privateResumeAsset of privateResumeAssets) {
      expect(existsSync(privateResumeAsset), `${privateResumeAsset} should not be published`).toBe(false);
    }
  });

  it("ships a valid root favicon fallback with a search-compatible size", () => {
    const favicon = readFileSync(rootFaviconPath);
    const profileFavicon = readFileSync(profileFaviconPath);

    expect(sha256(profileFavicon)).toBe(expectedProfileFaviconSha256);
    expect(sha256(favicon)).toBe(expectedRootFaviconSha256);
    const imageCount = favicon.readUInt16LE(4);
    const entries = Array.from({ length: imageCount }, (_, index) => {
      const entryOffset = 6 + index * 16;
      const widthByte = favicon.readUInt8(entryOffset);
      const heightByte = favicon.readUInt8(entryOffset + 1);

      return {
        width: widthByte === 0 ? 256 : widthByte,
        height: heightByte === 0 ? 256 : heightByte,
        colorCount: favicon.readUInt8(entryOffset + 2),
        reserved: favicon.readUInt8(entryOffset + 3),
        bitDepth: favicon.readUInt16LE(entryOffset + 6),
        byteLength: favicon.readUInt32LE(entryOffset + 8),
        imageOffset: favicon.readUInt32LE(entryOffset + 12)
      };
    });

    expect([...favicon.subarray(0, 4)]).toEqual([0, 0, 1, 0]);
    expect(imageCount).toBe(expectedRootFaviconSizes.length);
    expect(entries.map(({ width, height }) => [width, height])).toEqual(
      expectedRootFaviconSizes.map((size) => [size, size])
    );

    let expectedImageOffset = 6 + imageCount * 16;
    for (const entry of entries) {
      expect(entry).toMatchObject({
        colorCount: 0,
        reserved: 0,
        bitDepth: 32,
        imageOffset: expectedImageOffset
      });

      const imageEnd = entry.imageOffset + entry.byteLength;
      const image = favicon.subarray(entry.imageOffset, imageEnd);

      expect(imageEnd).toBeLessThanOrEqual(favicon.length);
      expect([...image.subarray(0, 8)]).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
      expect(image.toString("ascii", 12, 16)).toBe("IHDR");
      expect(image.readUInt32BE(16)).toBe(entry.width);
      expect(image.readUInt32BE(20)).toBe(entry.height);
      expectedImageOffset = imageEnd;
    }

    expect(expectedImageOffset).toBe(favicon.length);
  });
});
