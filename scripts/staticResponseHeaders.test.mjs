import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  assertCloudflareHeaderLimits,
  cloudflareHeaderLineLimit,
  cloudflareHeaderRuleLimit,
  writeStaticResponseHeaders
} from "./staticResponseHeaders.mjs";

const temporaryDirectories = [];
const headerTemplate = `/*
  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY

/content-version.json
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0

/artifact-integrity.json
  Cache-Control: no-store, no-cache, must-revalidate, max-age=0
`;

function hash(value) {
  return `'sha256-${createHash("sha256").update(value, "utf8").digest("base64")}'`;
}

function policyForRoute(headers, route) {
  const escapedRoute = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = headers.match(new RegExp(`^${escapedRoute}\\n  Content-Security-Policy: (.+)$`, "m"));
  if (!match?.[1]) throw new Error(`Expected a generated CSP rule for ${route}.`);
  return match[1];
}

async function createExportDirectory() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-csp-"));
  temporaryDirectories.push(directory);
  await writeFile(path.join(directory, "_headers"), headerTemplate, "utf8");
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { force: true, recursive: true })));
});

describe("static response header generation", () => {
  it("derives per-page CSP hashes from final HTML without allowing inline scripts", async () => {
    const exportDirectory = await createExportDirectory();
    const bootstrap = "window.bootstrap = true;";
    const structuredData = '{"@context":"https://schema.org","@type":"Person"}';
    const contactScript = "window.contactReady = true;";
    await writeFile(
      path.join(exportDirectory, "index.html"),
      `<script>${bootstrap}</script><script type="application/ld+json">${structuredData}</script><script src="/_next/app.js"></script>`,
      "utf8"
    );
    await writeFile(path.join(exportDirectory, "contact.html"), `<script>${contactScript}</script>`, "utf8");

    await expect(writeStaticResponseHeaders(exportDirectory)).resolves.toEqual({ htmlFileCount: 2, ruleCount: 5 });
    const headers = await readFile(path.join(exportDirectory, "_headers"), "utf8");
    const fallbackPolicy = policyForRoute(headers, "/*");
    const homePolicy = policyForRoute(headers, "/");
    const contactPolicy = policyForRoute(headers, "/contact");
    const homeScriptSource = homePolicy.match(/script-src ([^;]+)/)?.[1] ?? "";

    expect(homePolicy).toContain(hash(bootstrap));
    expect(homePolicy).toContain(hash(structuredData));
    expect(homePolicy).not.toContain(hash(contactScript));
    expect(contactPolicy).toContain(hash(contactScript));
    expect(fallbackPolicy).toContain(hash(bootstrap));
    expect(fallbackPolicy).toContain(hash(structuredData));
    expect(fallbackPolicy).toContain(hash(contactScript));
    expect(homeScriptSource).not.toContain("unsafe-inline");
    expect(homeScriptSource).toContain("https://challenges.cloudflare.com");
    expect(headers).toContain("/index.html\n  Content-Security-Policy:");
    expect(headers).toContain("/contact.html\n  Content-Security-Policy:");
    expect(headers.split("\n").filter((line) => line.startsWith("  ")).every(
      (line) => Buffer.byteLength(line, "utf8") <= cloudflareHeaderLineLimit
    )).toBe(true);
  });

  it("replaces hashes when final inline HTML changes", async () => {
    const exportDirectory = await createExportDirectory();
    const oldScript = "window.bootstrap = true;";
    const updatedScript = "window.bootstrap = false;";
    const indexPath = path.join(exportDirectory, "index.html");
    await writeFile(indexPath, `<script>${oldScript}</script>`, "utf8");
    await writeStaticResponseHeaders(exportDirectory);

    await writeFile(indexPath, `<script>${updatedScript}</script>`, "utf8");
    await writeStaticResponseHeaders(exportDirectory);

    const headers = await readFile(path.join(exportDirectory, "_headers"), "utf8");
    expect(policyForRoute(headers, "/")).toContain(hash(updatedScript));
    expect(policyForRoute(headers, "/")).not.toContain(hash(oldScript));
    expect(headers.match(/# Generated static CSP rules/g)).toHaveLength(1);
  });

  it("fails when a generated CSP line would exceed Cloudflare Pages' limit", async () => {
    const exportDirectory = await createExportDirectory();
    const scripts = Array.from({ length: 50 }, (_, index) => `<script>window.script${index} = ${index};</script>`).join("");
    await writeFile(path.join(exportDirectory, "index.html"), scripts, "utf8");

    await expect(writeStaticResponseHeaders(exportDirectory)).rejects.toThrow(
      new RegExp(`exceeds ${cloudflareHeaderLineLimit.toLocaleString("en-US")} bytes`)
    );
  });

  it("fails when a generated route line would exceed Cloudflare Pages' limit", () => {
    const route = `/${"a".repeat(cloudflareHeaderLineLimit)}`;

    expect(() => assertCloudflareHeaderLimits(`${route}\n  X-Content-Type-Options: nosniff\n`)).toThrow(
      new RegExp(`exceeds ${cloudflareHeaderLineLimit.toLocaleString("en-US")} bytes`)
    );
  });

  it("fails when generated route rules exceed Cloudflare Pages' limit", async () => {
    const exportDirectory = await createExportDirectory();
    await Promise.all(Array.from(
      { length: 49 },
      (_, index) => writeFile(path.join(exportDirectory, `page-${index}.html`), "<main>Static page</main>", "utf8")
    ));

    await expect(writeStaticResponseHeaders(exportDirectory)).rejects.toThrow(
      new RegExp(`exceed the ${cloudflareHeaderRuleLimit} rule limit`)
    );
  });
});
