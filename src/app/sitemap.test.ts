import { describe, expect, it } from "vitest";
import sitemap from "@/app/sitemap";

const approvedUrls = [
  "https://nicolasmgioanni.dev/",
  "https://nicolasmgioanni.dev/experience",
  "https://nicolasmgioanni.dev/research",
  "https://nicolasmgioanni.dev/projects",
  "https://nicolasmgioanni.dev/recommendations",
  "https://nicolasmgioanni.dev/resume",
  "https://nicolasmgioanni.dev/terms",
  "https://nicolasmgioanni.dev/privacy",
  "https://nicolasmgioanni.dev/security"
];

describe("sitemap metadata route", () => {
  it("returns exactly the approved canonical URL set without optional fabricated fields", () => {
    const entries = sitemap();
    const urls = entries.map((entry) => entry.url);

    expect(entries).toHaveLength(9);
    expect(urls).toEqual(approvedUrls);
    expect(new Set(urls).size).toBe(urls.length);
    expect(entries.every((entry) => Object.keys(entry).length === 1)).toBe(true);

    for (const urlValue of urls) {
      const url = new URL(urlValue);
      expect(url.protocol).toBe("https:");
      expect(url.hostname).toBe("nicolasmgioanni.dev");
      expect(url.search).toBe("");
      expect(url.hash).toBe("");
    }

    const serializedEntries = JSON.stringify(entries);
    expect(serializedEntries).not.toMatch(/contact|\/api\/|content-version|artifact-integrity|pages\.dev|www\./);
    expect(serializedEntries).not.toMatch(/priority|changeFrequency|lastModified/);
  });
});
