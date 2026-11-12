import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { artifactManifestFileName } from "./artifactIntegrity.mjs";
import {
  assertFunctionHeaders,
  assertNoCacheMetadataHeaders,
  assertRootResponse,
  assertStaticHeaders,
  compareDeployedContent,
  compareProducerGeneration,
  decideDeployment,
  smokeDeployment
} from "./checkDeployedContent.mjs";

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
const rootHtml = '<!doctype html><html><head><title>Portfolio</title><link rel="canonical" href="https://nicolasmgioanni.dev"></head></html>';
const staticHeaders = {
  "Content-Type": "text/html; charset=utf-8",
  "Content-Security-Policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'sha256-reviewed-home' https://challenges.cloudflare.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Content-Type-Options": "nosniff",
  "X-Frame-Options": "DENY"
};
const metadataHeaders = {
  "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
  Pragma: "no-cache"
};
const functionHeaders = {
  "Content-Security-Policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
  "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Strict-Transport-Security": "max-age=31536000",
  "X-Frame-Options": "DENY",
  "Cache-Control": "no-store, max-age=0",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff"
};
const rootHeadersContract = `/*
  Permissions-Policy: ${staticHeaders["Permissions-Policy"]}
  Referrer-Policy: ${staticHeaders["Referrer-Policy"]}
  Strict-Transport-Security: ${staticHeaders["Strict-Transport-Security"]}
  X-Content-Type-Options: ${staticHeaders["X-Content-Type-Options"]}
  X-Frame-Options: ${staticHeaders["X-Frame-Options"]}
  Content-Security-Policy: default-src 'none'

/
  ! Content-Security-Policy
  Content-Security-Policy: ${staticHeaders["Content-Security-Policy"]}

/content-version.json
  Cache-Control: ${metadataHeaders["Cache-Control"]}
  Pragma: ${metadataHeaders.Pragma}

/artifact-integrity.json
  Cache-Control: ${metadataHeaders["Cache-Control"]}
  Pragma: ${metadataHeaders.Pragma}
`;
const deployedV2 = {
  schemaVersion: 2,
  contentHash,
  commitSha,
  generatedAt: "2026-08-27T12:00:00.000Z",
  deployedAt: "2026-08-27T12:01:00.000Z",
  target: "production",
  publicBuildInputDigest: "d".repeat(64),
  producer: { kind: "github-actions", runId: "101", runNumber: 50, attempt: 1 }
};

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

  it("rejects redirects for deployment identity metadata", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 302, headers: { Location: "https://substitute.example/content-version.json" } })));
    await expect(compareDeployedContent("https://smart-portfolio-bds.pages.dev", contentHash, commitSha, "redirect")).rejects.toThrow("redirected");
  });
});

describe("deployment identity decisions", () => {
  it("uses run number then producer attempt and permits only exact v2 smoke-only retries", () => {
    expect(compareProducerGeneration({ ...deployedV2, producer: { ...deployedV2.producer, attempt: 2 } }, deployedV2)).toBe(1);
    expect(decideDeployment(deployedV2, deployedV2)).toEqual({ action: "smoke-only", reason: "exact-deployed-identity" });
    expect(decideDeployment({ ...deployedV2, producer: { ...deployedV2.producer, attempt: 2 } }, deployedV2)).toEqual({ action: "full-verification", reason: "candidate-generation-is-newer" });
  });

  it("prevents older or ambiguous candidates from overwriting a newer release", () => {
    expect(decideDeployment({ ...deployedV2, contentHash: "e".repeat(64), producer: { ...deployedV2.producer, runNumber: 49 } }, deployedV2)).toEqual({ action: "fail-closed", reason: "candidate-generation-is-older" });
    expect(decideDeployment({ ...deployedV2, publicBuildInputDigest: "e".repeat(64) }, deployedV2)).toEqual({ action: "fail-closed", reason: "same-generation-has-different-identity" });
    expect(decideDeployment(deployedV2, version)).toEqual({ action: "full-verification", reason: "legacy-deployed-identity" });
    expect(decideDeployment(deployedV2, { invalid: true })).toEqual({ action: "fail-closed", reason: "deployed-identity-malformed" });
  });
});

describe("deployment smoke checks", () => {
  it("matches sealed root bytes, effective response headers, metadata, SEO artifacts, and Function GET contracts", async () => {
    artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-smoke-"));
    await Promise.all([
      writeFile(path.join(artifactDirectory, "index.html"), rootHtml, "utf8"),
      writeFile(path.join(artifactDirectory, "_headers"), rootHeadersContract, "utf8"),
      writeFile(path.join(artifactDirectory, artifactManifestFileName), JSON.stringify(manifest), "utf8"),
      writeFile(path.join(artifactDirectory, "robots.txt"), robotsText, "utf8"),
      writeFile(path.join(artifactDirectory, "sitemap.xml"), sitemapXml, "utf8")
    ]);

    const requestedPaths = [];
    const redirectModes = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input, init) => {
        const url = input instanceof URL ? input : new URL(String(input));
        requestedPaths.push(url.pathname);
        redirectModes.push(init?.redirect);

        if (url.pathname === "/") {
          return new Response(rootHtml, { headers: staticHeaders });
        }
        if (url.pathname === "/content-version.json") return Response.json(version, { headers: metadataHeaders });
        if (url.pathname === `/${artifactManifestFileName}`) return Response.json(manifest, { headers: metadataHeaders });
        if (url.pathname === "/robots.txt") {
          return new Response(robotsText, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
        }
        if (url.pathname === "/sitemap.xml") {
          return new Response(sitemapXml, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
        }
        if (url.pathname === "/api/contact/verify" || url.pathname === "/api/contact") {
          return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405, headers: functionHeaders });
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
    expect(redirectModes).toEqual(Array(7).fill("manual"));
  });

  it("rejects substituted root bytes and a static CSP that bypasses a route replacement", async () => {
    artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-smoke-"));
    await Promise.all([
      writeFile(path.join(artifactDirectory, "index.html"), rootHtml, "utf8"),
      writeFile(path.join(artifactDirectory, "_headers"), rootHeadersContract, "utf8")
    ]);
    await expect(assertRootResponse(new Response(`${rootHtml}<!-- substituted -->`, { headers: staticHeaders }), artifactDirectory))
      .rejects.toThrow("root content does not match");
    const sealedBytes = Buffer.concat([Buffer.from(rootHtml), Buffer.from([0xc3, 0x28])]);
    const substitutedBytes = Buffer.concat([Buffer.from(rootHtml), Buffer.from([0xef, 0xbf, 0xbd, 0x28])]);
    await writeFile(path.join(artifactDirectory, "index.html"), sealedBytes);
    await expect(assertRootResponse(new Response(substitutedBytes, { headers: staticHeaders }), artifactDirectory))
      .rejects.toThrow("root content does not match");
    await expect(assertStaticHeaders(new Response(rootHtml, {
      headers: { ...staticHeaders, "Content-Security-Policy": "default-src 'none'" }
    }), artifactDirectory)).rejects.toThrow("Content-Security-Policy");
  });

  it("rejects cacheable metadata and Function responses without restrictive headers", () => {
    expect(() => assertFunctionHeaders(new Response(null, { headers: functionHeaders }), "api/contact")).not.toThrow();
    for (const name of Object.keys(functionHeaders)) {
      const headers = new Headers(functionHeaders);
      headers.delete(name);
      expect(() => assertFunctionHeaders(new Response(null, { headers }), "api/contact")).toThrow();
    }
    expect(() => assertNoCacheMetadataHeaders(Response.json(version), "content-version.json")).toThrow("disable caching");
    expect(() => assertNoCacheMetadataHeaders(new Response(null, { headers: { "Cache-Control": "no-store" } }), "content-version.json"))
      .toThrow("Pragma");
    expect(() => assertFunctionHeaders(Response.json({ ok: false }, { status: 405 }), "api/contact"))
      .toThrow("disable caching");
    expect(() => assertFunctionHeaders(new Response(null, {
      headers: { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }
    }), "api/contact")).toThrow("content sniffing");
  });
});
