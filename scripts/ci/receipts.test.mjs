import { describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { mkdtemp, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { createPlan, recordDigest, repository, workflowPath } from "./plan.mjs";
import { selectCompletedJob, testIdentity, verifyDiscoveryCoverage, verifyReceipt } from "./receipts.mjs";

const sha = "a".repeat(40), digest = "b".repeat(64);
const candidate = { schemaVersion: 1, repository, event: "push", ref: "refs/heads/main", workflowRef: `${repository}/${workflowPath}@refs/heads/main`, workflowSha: sha, sourceSha: sha, eventSha: sha, runHeadSha: sha, branchTip: sha, pullNumber: null, baseBranch: null, force: false, runId: 12345, runNumber: 350, producerAttempt: 1 };
const plan = createPlan(candidate, { snapshotDigest: digest });
const identities = ["navigation", "contact", "skeleton"].map((title) => testIdentity({ project: "chromium", file: `tests/e2e/${title}.spec.ts`, titlePath: [title] }));
const expected = { plan, validator: "chromium-1-of-2", job: "browser-e2e", assignment: identities };
function receipt() { return { schemaVersion: 1, validator: expected.validator, planDigest: recordDigest(plan), snapshotDigest: digest,
  artifactRecordDigest: null, producer: { runId: 12345, runNumber: 350, attempt: 1, job: "browser-e2e" },
  discoveryDigest: recordDigest([...identities].sort()), cases: identities.map((identity) => ({ identity, attempts: [{ status: "passed", durationMs: 5, retry: 0 }], skipReason: null })), durationMs: 15, outcome: "success" }; }

describe("browser discovery and execution evidence", () => {
  it("requires exact disjoint coverage and discovers additional tests automatically", () => {
    expect(verifyDiscoveryCoverage(identities, [[identities[0]], [identities[1]], [identities[2]]])).toBe(recordDigest([...identities].sort()));
    expect(() => verifyDiscoveryCoverage(identities, [[identities[0]], [identities[1]]])).toThrow("omit");
    expect(() => verifyDiscoveryCoverage(identities, [[identities[0]], identities])).toThrow("duplicate");
    expect(() => verifyDiscoveryCoverage([], [])).toThrow("empty");
    const added = testIdentity({ project: "chromium", file: "new.spec.ts", titlePath: ["new coverage"] });
    expect(() => verifyDiscoveryCoverage([...identities, added], identities.map((id) => [id]))).toThrow("omit");
    expect(() => verifyDiscoveryCoverage(identities, [...identities.map((id) => [id]), [added]])).toThrow("unexpected");
  });

  it("qualifies identities by project and repetition, not source line numbers", () => {
    expect(testIdentity({ project: "firefox", file: "test.spec.ts", titlePath: ["same"] })).not.toBe(testIdentity({ project: "chromium", file: "test.spec.ts", titlePath: ["same"] }));
    expect(() => testIdentity({ project: "chromium", file: "../outside.spec.ts", titlePath: ["unsafe"] })).toThrow();
  });

  it("requires execution for every assigned identity and exposes bounded retries", () => {
    expect(verifyReceipt(receipt(), expected)).toEqual({ tests: 3, retries: 0, skips: 0, durationMs: 15 });
    const retried = receipt(); retried.cases[0].attempts[0].retry = 1; retried.cases[0].attempts.unshift({ status: "failed", durationMs: 3, retry: 0 });
    expect(verifyReceipt(retried, expected).retries).toBe(1);
    retried.cases[0].attempts.unshift({ status: "failed", durationMs: 3, retry: 0 });
    expect(() => verifyReceipt(retried, expected)).toThrow("one-retry");
    const missing = receipt(); missing.cases.pop(); expect(() => verifyReceipt(missing, expected)).toThrow("omits");
    const duplicate = receipt(); duplicate.cases[1] = duplicate.cases[0]; expect(() => verifyReceipt(duplicate, expected)).toThrow("duplicated");
  });

  it("accepts a complete native serial-group retry but rejects missing, reordered or interrupted attempts", () => {
    const serial = receipt();
    for (const [index, status] of ["passed", "failed", "skipped"].entries()) {
      serial.cases[index].attempts = [{ status, durationMs: 1, retry: 0 }, { status: "passed", durationMs: 2, retry: 1 }];
    }
    expect(verifyReceipt(serial, expected).retries).toBe(3);
    for (const attempts of [
      [{ status: "passed", durationMs: 2, retry: 1 }],
      [{ status: "failed", durationMs: 1, retry: 1 }, { status: "passed", durationMs: 2, retry: 0 }],
      [{ status: "interrupted", durationMs: 1, retry: 0 }, { status: "passed", durationMs: 2, retry: 1 }]
    ]) {
      const invalid = receipt(); invalid.cases[0].attempts = attempts;
      expect(() => verifyReceipt(invalid, expected)).toThrow();
    }
  });

  it("verifies the real Playwright reporter output for a recovered serial group", async () => {
    const root = await realpath(await mkdtemp(path.join(os.tmpdir(), "portfolio-serial-retry-")));
    try {
      const packageRoot = path.resolve(import.meta.dirname, "../..");
      const entry = pathToFileURL(path.join(packageRoot, "node_modules/@playwright/test/index.mjs")).href;
      const config = path.join(root, "playwright.config.mjs"), output = path.join(root, "report.json");
      await writeFile(config, "export default {testDir: '.', retries: 1, workers: 1, projects: [{name: 'chromium'}]};\n");
      await writeFile(path.join(root, "serial.spec.mjs"), `import {test, expect} from ${JSON.stringify(entry)};
        test.describe.configure({mode: 'serial'});
        test('before', async () => {});
        test('once flaky', async ({}, info) => {expect(info.retry).toBe(1);});
        test('after', async () => {});\n`);
      const result = spawnSync(process.execPath, [path.join(packageRoot, "node_modules/playwright/cli.js"), "test", "--config", config,
        `--reporter=${path.join(import.meta.dirname, "browserReporter.mjs")}`], {
        cwd: root, encoding: "utf8", timeout: 15_000,
        env: { ...process.env, CI_BROWSER_ROOT: root, CI_BROWSER_REPORT: output, CI_BROWSER_REPORT_MODE: "execution" }
      });
      expect(result.status).toBe(0);
      const report = JSON.parse(await readFile(output, "utf8"));
      expect(report.status).toBe("passed");
      expect(report.cases.map((item) => item.attempts.map((attempt) => [attempt.status, attempt.retry]))).toEqual([
        [["passed", 0], ["passed", 1]], [["failed", 0], ["passed", 1]], [["skipped", 0], ["passed", 1]]
      ]);
      const value = { ...receipt(), cases: report.cases, discoveryDigest: recordDigest([...report.identities].sort()) };
      expect(verifyReceipt(value, { ...expected, assignment: report.identities })).toMatchObject({ tests: 3, retries: 3, skips: 0 });
    } finally { await rm(root, { recursive: true, force: true }); }
  }, 20_000);

  it("rejects failure, interruption and unregistered skips even with a success summary", () => {
    for (const status of ["failed", "timedOut", "interrupted", "skipped"]) {
      const value = receipt(); value.cases[0].attempts[0].status = status;
      expect(() => verifyReceipt(value, expected)).toThrow();
    }
    const skipped = receipt(); skipped.cases[0].attempts[0].status = "skipped"; skipped.cases[0].skipReason = "Optional workbook detail is absent";
    expect(() => verifyReceipt(skipped, expected)).toThrow("Unexplained");
    expect(verifyReceipt(skipped, { ...expected, allowedSkips: { [identities[0]]: [skipped.cases[0].skipReason] } }).skips).toBe(1);
  });

  it("invalidates evidence for other inputs, producer generations or shard assignments", () => {
    for (const patch of [{ planDigest: "c".repeat(64) }, { snapshotDigest: "c".repeat(64) }, { validator: "chromium-2-of-2" }, { discoveryDigest: "c".repeat(64) }, { outcome: "skipped" }, { producer: { ...receipt().producer, runId: 99 } }]) {
      expect(() => verifyReceipt({ ...receipt(), ...patch }, expected)).toThrow();
    }
    const regenerated = { ...plan, snapshotDigest: "c".repeat(64) };
    expect(() => verifyReceipt(receipt(), { ...expected, plan: regenerated })).toThrow("different inputs");
  });

  it("uses the most recent execution including failure, never an older success", () => {
    const job = { id: 1, name: "browser-e2e (1/2)", run_id: 12345, run_attempt: 1, status: "completed", conclusion: "success" };
    const selector = { name: job.name, runId: job.run_id, currentAttempt: 2 };
    expect(selectCompletedJob([job], selector)).toEqual(job);
    for (const conclusion of ["failure", "cancelled", "skipped", null]) {
      expect(() => selectCompletedJob([job, { ...job, id: 2, run_attempt: 2, conclusion }], selector)).toThrow("unsuccessful");
    }
    expect(() => selectCompletedJob([job, job], selector)).toThrow("ambiguous");
    expect(() => selectCompletedJob([], selector)).toThrow("missing");
    for (const patch of [{ currentAttempt: 0 }, { currentAttempt: "2" }, { runId: null }, { name: "" }]) {
      expect(() => selectCompletedJob([job], { ...selector, ...patch })).toThrow();
    }
  });
});
