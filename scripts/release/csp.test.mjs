// @vitest-environment node
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createStaticCsp, cspForHashes, hashesForInlineScripts, pagesHeaderLimit } from "./csp.mjs";

const temporaryDirectories = [];
afterEach(async () => Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true }))));

async function makeOutput(routeCount = 0) {
  const out = await mkdtemp(path.join(os.tmpdir(), "release-csp-test-"));
  temporaryDirectories.push(out);
  await writeFile(path.join(out, "index.html"), "<script>window.home = true;</script>");
  for (let index = 0; index < routeCount; index += 1) {
    const directory = path.join(out, `route-${index}`);
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, "index.html"), `<script>window.route = ${index};</script>`);
  }
  return out;
}

describe("static Pages CSP generation", () => {
  it("hashes only each route's inline scripts and preserves metadata no-cache rules", async () => {
    const out = await makeOutput();
    const result = await createStaticCsp(out);
    const headers = await readFile(path.join(out, "_headers"), "utf8");
    expect(result.routes["/"]).toContain(hashesForInlineScripts("<script>window.home = true;</script>")[0]);
    expect(headers).not.toContain("script-src 'self' 'unsafe-inline'");
    expect(headers).toContain("/content-version.json");
  });

  it("fails closed at header and rule limits", async () => {
    const hashes = Array.from({ length: 40 }, (_, index) => `'sha256-${`${index}`.padEnd(44, "a")}'`);
    expect(() => cspForHashes(hashes)).toThrow("exceeds Cloudflare Pages");
    expect(Buffer.byteLength(`Content-Security-Policy: ${cspForHashes([])}`, "utf8")).toBeLessThanOrEqual(pagesHeaderLimit);
    await expect(createStaticCsp(await makeOutput(33))).rejects.toThrow("100-rule limit");
  });
});
