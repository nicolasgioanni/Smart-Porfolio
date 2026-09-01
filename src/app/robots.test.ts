import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createCanonicalUrl } from "@/lib/seo/siteConfig";

const robotsPath = resolve(process.cwd(), "src/app/robots.txt");

describe("robots static metadata", () => {
  it("keeps the static metadata file aligned with the approved crawler policy", async () => {
    const robots = await readFile(robotsPath, "utf8");
    const lines = robots.trimEnd().split(/\r?\n/);

    expect(lines).toEqual([
      "User-Agent: *",
      "Allow: /",
      "Disallow: /api/",
      "Disallow: /content-version.json",
      "Disallow: /artifact-integrity.json",
      "",
      `Sitemap: ${createCanonicalUrl("/sitemap.xml")}`
    ]);
    expect(robots).not.toContain("/contact");
    expect(robots).not.toContain("/_next/");
  });
});
