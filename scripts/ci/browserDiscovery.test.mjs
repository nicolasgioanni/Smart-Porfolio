// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import BrowserEvidenceReporter, { identityForTest } from "./browserReporter.mjs";
import { discoverBrowserCoverage, discoverCompleteBrowserCoverage, parseBrowserReport } from "./browserDiscovery.mjs";
import { testIdentity } from "./receipts.mjs";

const temporary = [];
async function directory() {
  const value = await mkdtemp(path.join(os.tmpdir(), "browser-contract-"));
  temporary.push(value);
  return value;
}
afterEach(async () => { await Promise.all(temporary.splice(0).map((value) => rm(value, { recursive: true, force: true }))); });

function testCase(root) {
  const fileSuite = { type: "file", title: "example.spec.ts" };
  const suite = { type: "describe", title: "Navigation", parent: fileSuite, project: () => ({ name: "chromium" }) };
  return { title: "opens a route", parent: suite, location: { file: path.join(root, "tests/example.spec.ts") },
    repeatEachIndex: 0, annotations: [], results: [{ status: "passed", duration: 15, retry: 0 }] };
}

describe("native Playwright discovery evidence", () => {
  it("records portable identities and sanitized terminal evidence", async () => {
    const root = await directory(), output = path.join(root, "evidence.json");
    const test = testCase(root);
    expect(identityForTest(test, root)).toBe(testIdentity({ project: "chromium", file: "tests/example.spec.ts", titlePath: ["Navigation", "opens a route"] }));
    const reporter = new BrowserEvidenceReporter({ root, output, mode: "execution" });
    reporter.onBegin({}, { allTests: () => [test] });
    await reporter.onEnd({ status: "passed", duration: 20 });
    const body = await readFile(output, "utf8");
    expect(body).not.toContain(root);
    const value = parseBrowserReport(JSON.parse(body), "execution");
    expect(value.cases).toEqual([{ identity: identityForTest(test, root), attempts: [{ status: "passed", durationMs: 15, retry: 0 }], skipReason: null }]);
    await expect(reporter.onEnd({ status: "passed", duration: 20 })).rejects.toMatchObject({ code: "EEXIST" });
  });

  it("does not let a successful summary hide import errors or empty discovery", async () => {
    const root = await directory(), output = path.join(root, "error.json");
    const reporter = new BrowserEvidenceReporter({ root, output, mode: "discovery" });
    reporter.onError({ message: "private diagnostic sentinel" });
    await reporter.onEnd({ status: "passed", duration: 1 });
    const body = await readFile(output, "utf8");
    expect(body).not.toContain("private diagnostic sentinel");
    expect(() => parseBrowserReport(JSON.parse(body), "discovery")).toThrow("incomplete");
    expect(() => parseBrowserReport({ ...JSON.parse(body), errorCount: 0 }, "discovery")).toThrow("incomplete");
  });

  it("rejects failed or missing producers without selecting another report", async () => {
    await expect(discoverBrowserCoverage({ execute: () => ({ status: 1, stderr: "private sentinel" }) })).rejects.toThrow("discovery failed");
    await expect(discoverBrowserCoverage({ execute: () => ({ status: 0 }) })).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("retains all three native cross-browser projects and rejects a missing project", async () => {
    const root = await directory();
    const playwright = pathToFileURL(path.resolve(import.meta.dirname, "../../node_modules/@playwright/test/index.mjs")).href;
    const config = path.join(root, "playwright.config.mjs");
    const configuration = (names) => `export default { testDir: '.', fullyParallel: false, workers: 1,
      projects: ${JSON.stringify(names)}.map(name => ({ name,
      ...(name === 'chromium' && process.env.CI_BROWSER_SELECTION === 'functional' ? { testIgnore: /\\.visual\\.spec\\.mjs$/ } : {}),
      ...(name === 'chromium' && process.env.CI_BROWSER_SELECTION === 'visual' ? { testMatch: /\\.visual\\.spec\\.mjs$/ } : {}) })) };`;
    await writeFile(config, configuration(['chromium', 'firefox-critical', 'webkit-critical', 'webkit-mobile']));
    for (const name of ['one', 'two', 'skeletons.visual']) await writeFile(path.join(root, `${name}.spec.mjs`),
      `import { test } from ${JSON.stringify(playwright)}; test(${JSON.stringify(name)}, async () => {});`);
    const result = await discoverCompleteBrowserCoverage({ projectRoot: root, config });
    expect(result.crossBrowser.identities).toHaveLength(9);
    expect(result.chromium.assignments.full.identities).toHaveLength(3);
    await writeFile(config, configuration(['chromium', 'firefox-critical', 'webkit-critical']));
    await expect(discoverCompleteBrowserCoverage({ projectRoot: root, config })).rejects.toThrow('Cross-browser discovery');
  }, 30_000);

  it("partitions real native shards and fails on invalid imports", async () => {
    const root = await directory();
    const playwright = pathToFileURL(path.resolve(import.meta.dirname, "../../node_modules/@playwright/test/index.mjs")).href;
    const config = path.join(root, "playwright.config.mjs");
    await writeFile(config, `export default {
      testDir: '.', fullyParallel: false, workers: 1, projects: [{ name: 'chromium',
      ...(process.env.CI_BROWSER_SELECTION === 'functional' ? { testIgnore: /\\.visual\\.spec\\.mjs$/ } : {}),
      ...(process.env.CI_BROWSER_SELECTION === 'visual' ? { testMatch: /\\.visual\\.spec\\.mjs$/ } : {}) }] };\n`);
    for (const name of ["one", "two", "skeletons.visual"]) {
      await writeFile(path.join(root, `${name}.spec.mjs`), `import { test } from ${JSON.stringify(playwright)}; test(${JSON.stringify(name)}, async () => {});\n`);
    }
    const result = await discoverBrowserCoverage({ projectRoot: root, config });
    expect(result.assignments.full.identities).toHaveLength(3);
    expect(result.assignments["chromium-1-of-2"].identities).toHaveLength(1);
    expect(result.assignments["chromium-2-of-2"].identities).toHaveLength(1);
    expect(result.assignments["visual-regression"].identities).toHaveLength(1);
    await writeFile(path.join(root, "broken.spec.mjs"), "import './missing-module.mjs';\n");
    await expect(discoverBrowserCoverage({ projectRoot: root, config })).rejects.toThrow("discovery failed");
  }, 30_000);
});
