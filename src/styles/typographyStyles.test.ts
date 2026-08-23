import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const layoutSource = readFileSync(path.join(projectRoot, "src", "app", "layout.tsx"), "utf8");
const tokenStyles = readFileSync(path.join(projectRoot, "src", "styles", "tokens.css"), "utf8");

function customPropertyValue(name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return tokenStyles.match(new RegExp(`${escapedName}:\\s*([^;]+);`))?.[1]?.trim();
}

function cssFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return cssFilesUnder(entryPath);
    return entry.isFile() && entry.name.endsWith(".css") ? [entryPath] : [];
  });
}

describe("site typography contract", () => {
  it("loads Space Grotesk globally through the shared Next font variable", () => {
    expect(layoutSource).toMatch(/import\s*{\s*Space_Grotesk\s*}\s*from\s*"next\/font\/google"/);

    const loader = layoutSource.match(/const\s+(\w+)\s*=\s*Space_Grotesk\(\{([\s\S]*?)\}\);/);
    expect(loader).not.toBeNull();
    expect(loader?.[2]).toMatch(/display:\s*"swap"/);
    expect(loader?.[2]).toMatch(/subsets:\s*\[\s*"latin"\s*]/);
    expect(loader?.[2]).toMatch(/variable:\s*"--font-space-grotesk"/);
    expect(loader?.[2]).toMatch(/weight:\s*\[\s*"400",\s*"500",\s*"600",\s*"700"\s*]/);
    expect(layoutSource).toContain(`${loader?.[1]}.className`);
    expect(layoutSource).toContain(`${loader?.[1]}.variable`);
    expect(customPropertyValue("--font-sans")).toMatch(
      /^var\(--font-space-grotesk,\s*"Space Grotesk",[\s\S]*sans-serif\)$/
    );
    expect(customPropertyValue("--font-display")).toBe("var(--font-sans)");
  });

  it("keeps the CytoCV-inspired weight, size, line-height, and tracking scale centralized", () => {
    const expectedTokens = {
      "--font-weight-regular": "400",
      "--font-weight-medium": "500",
      "--font-weight-semibold": "600",
      "--font-weight-bold": "600",
      "--font-weight-heavy": "700",
      "--font-size-eyebrow": "0.6875rem",
      "--font-size-caption": "0.75rem",
      "--font-size-small": "0.8125rem",
      "--font-size-body": "0.875rem",
      "--font-size-body-large": "0.9375rem",
      "--font-size-lead": "1.0625rem",
      "--font-size-card-title": "1.25rem",
      "--font-size-section-title": "1.375rem",
      "--font-size-page-title": "1.625rem",
      "--font-size-hero-title": "clamp(1.875rem, 4.4vw, 2.75rem)",
      "--font-size-resume-title": "1.625rem",
      "--font-size-placeholder": "2.625rem",
      "--font-size-quote": "0.9375rem",
      "--font-size-inline-code": "0.92em",
      "--line-height-tight": "1.06",
      "--line-height-heading": "1.15",
      "--line-height-ui": "1.35",
      "--line-height-control": "1.2",
      "--line-height-normal": "1.55",
      "--line-height-relaxed": "1.65",
      "--letter-spacing-normal": "0",
      "--letter-spacing-heading": "0.01em",
      "--letter-spacing-label": "0.12em",
      "--letter-spacing-wide": "0.16em",
      "--letter-spacing-status": "0.06em"
    } as const;

    for (const [name, expectedValue] of Object.entries(expectedTokens)) {
      expect(customPropertyValue(name), name).toBe(expectedValue);
    }
  });

  it("uses semantic size tokens for every font-size declaration outside tokens.css", () => {
    const tokenPath = path.join(projectRoot, "src", "styles", "tokens.css");
    const violations = cssFilesUnder(path.join(projectRoot, "src"))
      .filter((filePath) => filePath !== tokenPath)
      .flatMap((filePath) => {
        const source = readFileSync(filePath, "utf8");
        return Array.from(source.matchAll(/^[ \t]*font-size\s*:\s*([^;}{]+);/gm)).flatMap((match) => {
          const value = match[1].trim();
          if (/^var\(--font-size-[a-z0-9-]+\)$/.test(value)) return [];

          const line = source.slice(0, match.index).split(/\r?\n/).length;
          return [`${path.relative(projectRoot, filePath)}:${line} -> ${value}`];
        });
      });

    expect(violations).toEqual([]);
  });
});
