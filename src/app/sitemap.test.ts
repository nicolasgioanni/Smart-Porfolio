import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { indexableSiteRoutePaths } from "@/lib/routing/siteRoutes";
import { createCanonicalUrl } from "@/lib/seo/siteConfig";

const sitemapPath = resolve(process.cwd(), "src/app/sitemap.xml");

describe("sitemap static metadata", () => {
  it("keeps the static metadata file aligned with every indexable canonical route", async () => {
    const sitemap = await readFile(sitemapPath, "utf8");
    const urls = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]!);
    const approvedUrls = indexableSiteRoutePaths.map(createCanonicalUrl);

    expect(urls).toEqual(approvedUrls);
    expect(new Set(urls).size).toBe(urls.length);
    expect(urls).toHaveLength(9);

    for (const urlValue of urls) {
      const url = new URL(urlValue);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("nicolasmgioanni.dev");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
    }

    expect(sitemap).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(sitemap).toContain('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">');
    expect(urls.join("\n")).not.toMatch(/contact|\/api\/|content-version|artifact-integrity|pages\.dev|www\./);
    expect(sitemap).not.toMatch(/<priority>|<changefreq>|<lastmod>/);
  });
});
