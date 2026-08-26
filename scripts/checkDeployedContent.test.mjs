import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { artifactManifestFileName } from "./artifactIntegrity.mjs";
import { compareDeployedContent, smokeDeployment } from "./checkDeployedContent.mjs";

const contentHash = "a".repeat(64);
const commitSha = "b".repeat(40);
const version = {
  schemaVersion: 1,
  contentHash,
  commitSha,
  generatedAt: "2026-08-27T12:00:00.000Z",
  deployedAt: "2026-08-27T12:01:00.000Z"
};
const manifest = {
  schemaVersion: 1,
  algorithm: "sha256",
  commitSha,
  files: [{ path: "index.html", sha256: "c".repeat(64), size: 10 }]
};
const robotsText = `User-Agent: *
Allow: /
Disallow: /api/
Sitemap: https://nicolasmgioanni.dev/sitemap.xml
`;
const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
<url><loc>https://nicolasmgioanni.dev/</loc></url>
</urlset>`;

let artifactDirectory;

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (artifactDirectory) await rm(artifactDirectory, { recursive: true, force: true });
  artifactDirectory = undefined;
});

describe("deployed candidate comparison", () => {
  it("matches only when both the content hash and commit SHA identify the candidate", async () => {
    artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-comparison-"));
    const outputPath = path.join(artifactDirectory, "github-output.txt");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json(version)));
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      compareDeployedContent(
        "https://smart-portfolio-bds.pages.dev",
        contentHash,
        commitSha,
        "matching-candidate",
        { GITHUB_OUTPUT: outputPath }
      )
    ).resolves.toBe(true);
    await expect(readFile(outputPath, "utf8")).resolves.toBe(
      `deployed_content_matches=true\n` +
        `deployed_commit_matches=true\n` +
        `deployed_content_hash=${contentHash}\n` +
        `deployed_commit_sha=${commitSha}\n`
    );
  });

  it("detects a code-only deployment gap when content matches but the deployed commit is stale", async () => {
    artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-comparison-"));
    const outputPath = path.join(artifactDirectory, "github-output.txt");
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ ...version, commitSha: "c".repeat(40) })));
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      compareDeployedContent(
        "https://smart-portfolio-bds.pages.dev",
        contentHash,
        commitSha,
        "stale-code",
        { GITHUB_OUTPUT: outputPath }
      )
    ).resolves.toBe(false);
    const outputs = await readFile(outputPath, "utf8");
    expect(outputs).toContain("deployed_content_matches=true");
    expect(outputs).toContain("deployed_commit_matches=false");
  });

  it("marks both comparisons false when no deployment manifest exists", async () => {
    artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-comparison-"));
    const outputPath = path.join(artifactDirectory, "github-output.txt");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 404 })));
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await expect(
      compareDeployedContent(
        "https://smart-portfolio-bds.pages.dev",
        contentHash,
        commitSha,
        "missing-manifest",
        { GITHUB_OUTPUT: outputPath }
      )
    ).resolves.toBe(false);
    await expect(readFile(outputPath, "utf8")).resolves.toBe(
      "deployed_content_matches=false\ndeployed_commit_matches=false\n"
    );
  });

  it("rejects invalid candidate identity and malformed deployed metadata", async () => {
    const fetchMock = vi.fn(async () => Response.json({ invalid: true }));
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      compareDeployedContent("https://smart-portfolio-bds.pages.dev", contentHash, "not-a-sha", "invalid")
    ).rejects.toThrow(/Expected commit SHA is invalid/);
    expect(fetchMock).not.toHaveBeenCalled();
    await expect(
      compareDeployedContent(
        "https://smart-portfolio-bds.pages.dev",
        contentHash,
        commitSha,
        "malformed-manifest"
      )
    ).rejects.toThrow(/Deployed content-version\.json is invalid/);
  });
});

describe("deployment smoke checks", () => {
  it("matches deployed SEO artifacts and requires both contact Functions to reject GET requests", async () => {
    artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-smoke-"));
    await Promise.all([
      writeFile(path.join(artifactDirectory, artifactManifestFileName), JSON.stringify(manifest), "utf8"),
      writeFile(path.join(artifactDirectory, "robots.txt"), robotsText, "utf8"),
      writeFile(path.join(artifactDirectory, "sitemap.xml"), sitemapXml, "utf8")
    ]);

    const requestedPaths = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = input instanceof URL ? input : new URL(String(input));
        requestedPaths.push(url.pathname);

        if (url.pathname === "/") {
          return new Response(
            '<!doctype html><html><head><title>Portfolio</title><link rel="canonical" href="https://nicolasmgioanni.dev"></head></html>',
            {
              headers: { "Content-Type": "text/html; charset=utf-8" }
            }
          );
        }
        if (url.pathname === "/content-version.json") return Response.json(version);
        if (url.pathname === `/${artifactManifestFileName}`) return Response.json(manifest);
        if (url.pathname === "/robots.txt") {
          return new Response(robotsText, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
        if (url.pathname === "/sitemap.xml") {
          return new Response(sitemapXml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
        }
        if (url.pathname === "/api/contact/verify" || url.pathname === "/api/contact") {
          return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
        }
        throw new Error(`Unexpected smoke-check URL: ${url}`);
      })
    );
    vi.spyOn(console, "log").mockImplementation(() => undefined);

    await smokeDeployment("https://smart-portfolio-bds.pages.dev", artifactDirectory, contentHash, commitSha);

    expect(requestedPaths).toEqual([
      "/",
      "/content-version.json",
      `/${artifactManifestFileName}`,
      "/robots.txt",
      "/sitemap.xml",
      "/api/contact/verify",
      "/api/contact"
    ]);
  });
});
