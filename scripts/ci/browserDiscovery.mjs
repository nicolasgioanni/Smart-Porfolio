import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { exactKeys, recordDigest } from "./plan.mjs";
import { parseTestIdentity, verifyDiscoveryCoverage } from "./receipts.mjs";

const root = path.resolve(import.meta.dirname, "../..");
const reporter = path.join(import.meta.dirname, "browserReporter.mjs");

export function parseBrowserReport(value, expectedMode) {
  exactKeys(value, ["schemaVersion", "mode", "status", "errorCount", "identities", "cases", "durationMs"], "Browser report");
  if (value.schemaVersion !== 1 || !["discovery", "execution"].includes(expectedMode) || value.mode !== expectedMode ||
      value.status !== "passed" || value.errorCount !== 0 || !Number.isFinite(value.durationMs) || value.durationMs < 0 ||
      !Array.isArray(value.identities) || value.identities.length === 0 || !Array.isArray(value.cases)) {
    throw new Error("Browser discovery/execution failed or its evidence is incomplete.");
  }
  value.identities.forEach(parseTestIdentity);
  if (new Set(value.identities).size !== value.identities.length) throw new Error("Browser report repeats test identities.");
  if (expectedMode === "discovery" && value.cases.length !== 0) throw new Error("Discovery cannot claim execution evidence.");
  return value;
}

export async function discoverBrowserCoverage({ projectRoot = root, config = "playwright.ci.config.ts", execute = spawnSync } = {}) {
  projectRoot = await realpath(projectRoot);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "portfolio-browser-discovery-"));
  const assignments = {};
  try {
    for (const [name, selection, shard] of [
      ["full", "full", null], ["chromium-1-of-2", "functional", "1/2"],
      ["chromium-2-of-2", "functional", "2/2"], ["visual-regression", "visual", null]
    ]) {
      const output = path.join(temporary, `${name}.json`);
      const args = [path.join(root, "node_modules/playwright/cli.js"), "test", "--config", config,
        "--project=chromium", "--list", `--reporter=${reporter}`, ...(shard ? [`--shard=${shard}`] : [])];
      const result = execute(process.execPath, args, {
        cwd: projectRoot,
        env: { ...process.env, CI_BROWSER_SELECTION: selection, CI_BROWSER_ROOT: projectRoot,
          CI_BROWSER_REPORT: output, CI_BROWSER_REPORT_MODE: "discovery" },
        encoding: "utf8", timeout: 60_000, maxBuffer: 1024 * 1024
      });
      // Do not print raw import errors or arbitrary test-module stdout into
      // public CI logs. A local ordinary `playwright test --list` diagnoses it.
      if (result.error || result.status !== 0) throw new Error(`Browser ${name} discovery failed. Run Playwright --list locally to diagnose imports/configuration.`);
      const report = parseBrowserReport(JSON.parse(await readFile(output, "utf8")), "discovery");
      assignments[name] = report.identities.sort();
    }
    const discoveryDigest = verifyDiscoveryCoverage(assignments.full, [assignments["chromium-1-of-2"], assignments["chromium-2-of-2"], assignments["visual-regression"]]);
    return { schemaVersion: 1, project: "chromium", discoveryDigest,
      assignments: Object.fromEntries(Object.entries(assignments).map(([name, identities]) => [name, { identities, digest: recordDigest(identities) }])) };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

export const crossBrowserProjects = Object.freeze(["firefox-critical", "webkit-critical", "webkit-mobile"]);

export async function discoverCompleteBrowserCoverage(options = {}) {
  const projectRoot = await realpath(options.projectRoot ?? root);
  const chromium = await discoverBrowserCoverage({ ...options, projectRoot });
  const temporary = await mkdtemp(path.join(os.tmpdir(), "portfolio-cross-discovery-"));
  try {
    const output = path.join(temporary, "cross-browser.json");
    const result = (options.execute ?? spawnSync)(process.execPath, [
      path.join(root, "node_modules/playwright/cli.js"), "test", "--config", options.config ?? "playwright.ci.config.ts",
      ...crossBrowserProjects.map((project) => `--project=${project}`), "--list", `--reporter=${reporter}`
    ], { cwd: projectRoot, env: { ...process.env, CI_BROWSER_SELECTION: "full", CI_BROWSER_ROOT: projectRoot,
      CI_BROWSER_REPORT: output, CI_BROWSER_REPORT_MODE: "discovery" },
      encoding: "utf8", timeout: 60_000, maxBuffer: 1024 * 1024 });
    if (result.error || result.status !== 0) throw new Error("Cross-browser discovery failed. Run Playwright --list locally to diagnose imports/configuration.");
    const report = parseBrowserReport(JSON.parse(await readFile(output, "utf8")), "discovery");
    const identities = report.identities.sort();
    const discoveredProjects = [...new Set(identities.map((identity) => parseTestIdentity(identity)[0]))].sort();
    if (discoveredProjects.join(",") !== [...crossBrowserProjects].sort().join(",")) throw new Error("Cross-browser discovery omitted or substituted a required project.");
    return { schemaVersion: 1, chromium, crossBrowser: { identities, digest: recordDigest(identities) } };
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/ci/browserDiscovery.mjs OUTPUT.json");
    const result = await discoverCompleteBrowserCoverage();
    await writeFile(process.argv[2], `${JSON.stringify(result, null, 2)}\n`, { flag: "wx" });
    console.log(JSON.stringify(Object.fromEntries(Object.entries(result.chromium.assignments).map(([name, value]) => [name, value.identities.length]))));
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
