// @vitest-environment node
import { describe, expect, it } from "vitest";
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { assertNoCodeqlFindings, parseCodeqlSarif } from "./checkSarif.mjs";

const execFileAsync = promisify(execFile);

function report(results = [], overrides = {}) {
  return {
    version: "2.1.0",
    runs: [{
      tool: { driver: { name: "CodeQL", semanticVersion: "2.23.3", rules: [{ id: "js/sql-injection", defaultConfiguration: { level: "error" }, properties: { "security-severity": "9.1" } }] } },
      invocations: [{ executionSuccessful: true, toolExecutionNotifications: [] }],
      results,
      ...overrides
    }]
  };
}

describe("CodeQL SARIF security gate", () => {
  it("accepts a strict empty CodeQL report", () => {
    expect(assertNoCodeqlFindings(report())).toEqual([]);
  });

  it("resolves a result level and severity from the driver defaults before failing the finding", () => {
    const findings = parseCodeqlSarif(report([{ ruleId: "js/sql-injection" }]));
    expect(findings).toEqual([{ ruleId: "js/sql-injection", level: "error", securitySeverity: 9.1 }]);
    expect(() => assertNoCodeqlFindings(report([{ ruleId: "js/sql-injection" }]))).toThrow("1 finding");
  });

  it("fails closed for malformed reports, absent results, and incomplete finding policy fields", () => {
    expect(() => parseCodeqlSarif({ version: "2.1.0", runs: [] })).toThrow();
    expect(() => parseCodeqlSarif(report(undefined, { results: undefined }))).toThrow("results are missing");
    expect(() => parseCodeqlSarif(report([{ ruleId: "js/sql-injection", level: "invalid" }]))).toThrow("valid level");
    expect(() => parseCodeqlSarif(report([{ ruleId: "js/sql-injection", properties: { "security-severity": "eleven" } }]))).toThrow("security severity");
    expect(() => parseCodeqlSarif(report([{ ruleId: "js/sql-injection" }], {
      tool: { driver: { name: "CodeQL", semanticVersion: "2.23.3", rules: [{ id: "js/sql-injection", properties: { "security-severity": "9.1" } }] } }
    }))).toThrow("valid level");
  });

  it("fails when the scanner reports execution or tool errors", () => {
    expect(() => parseCodeqlSarif(report([], { invocations: [{ executionSuccessful: false }] }))).toThrow("unsuccessful");
    expect(() => parseCodeqlSarif(report([], { invocations: [{ executionSuccessful: true, toolExecutionNotifications: [{ level: "error", message: { text: "database failed" } }] }] }))).toThrow("error notification");
  });

  it("rejects empty invocations, malformed notifications, and duplicate driver rules", () => {
    expect(() => parseCodeqlSarif(report([], { invocations: [] }))).toThrow("invocations are missing");
    expect(() => parseCodeqlSarif(report([], { invocations: [{ executionSuccessful: true, toolExecutionNotifications: "error" }] }))).toThrow("notifications are malformed");
    expect(() => parseCodeqlSarif(report([], { tool: { driver: { name: "CodeQL", semanticVersion: "2.23.3", rules: [{ id: "duplicate" }, { id: "duplicate" }] } } }))).toThrow("duplicate");
  });

  it("never publishes SARIF finding or scanner-error text through the CLI", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-sarif-"));
    const reportPath = path.join(directory, "scanner.sarif");
    const sentinel = "PRIVATE_SCANNER_DETAIL_MUST_NOT_APPEAR";
    try {
      await writeFile(reportPath, JSON.stringify(report([], {
        invocations: [{ executionSuccessful: true, toolExecutionNotifications: [{ level: "error", message: { text: sentinel } }] }],
      })), "utf8");
      const symlinkedGate = path.join(directory, "check-sarif-link.mjs");
      await symlink(path.join(import.meta.dirname, "checkSarif.mjs"), symlinkedGate);
      const failure = await execFileAsync(process.execPath, [symlinkedGate, reportPath], { cwd: path.resolve(import.meta.dirname, "..", "..") }).then(
        () => null,
        (error) => error,
      );
      expect(failure).toBeTruthy();
      expect(`${failure.stdout}${failure.stderr}`).not.toContain(sentinel);
      expect(`${failure.stdout}${failure.stderr}`).toContain("without publishing scanner details");
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
