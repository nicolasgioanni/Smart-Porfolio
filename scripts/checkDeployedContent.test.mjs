import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { artifactManifestFileName } from "./artifactIntegrity.mjs";
import { smokeDeployment } from "./checkDeployedContent.mjs";

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

let artifactDirectory;

afterEach(async () => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  if (artifactDirectory) await rm(artifactDirectory, { recursive: true, force: true });
  artifactDirectory = undefined;
});

describe("deployment smoke checks", () => {
  it("requires both contact Functions to return the expected JSON method rejection", async () => {
    artifactDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-smoke-"));
    await writeFile(path.join(artifactDirectory, artifactManifestFileName), JSON.stringify(manifest), "utf8");

    const requestedPaths = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input) => {
        const url = input instanceof URL ? input : new URL(String(input));
        requestedPaths.push(url.pathname);

        if (url.pathname === "/") {
          return new Response("<!doctype html><title>Portfolio</title>", {
            headers: { "Content-Type": "text/html; charset=utf-8" }
          });
        }
        if (url.pathname === "/content-version.json") return Response.json(version);
        if (url.pathname === `/${artifactManifestFileName}`) return Response.json(manifest);
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
      "/api/contact/verify",
      "/api/contact"
    ]);
  });
});
