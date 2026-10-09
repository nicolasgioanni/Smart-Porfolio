import { execFile } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import {
  aggregateSecurityScans,
  createScanSummary,
  scanIdentityForLane,
  scanLanes,
  summarizeReport,
  validateSuppressionConfiguration
} from "./securityScanSummary.mjs";

const execFileAsync = promisify(execFile);
const summaryScript = path.resolve(import.meta.dirname, "securityScanSummary.mjs");

function identity(lane) {
  return scanIdentityForLane(lane);
}

function summaryFor(lane, overrides = {}) {
  return createScanSummary({
    lane,
    ...identity(lane),
    targetCount: 1,
    findings: 0,
    status: "clean",
    ...overrides
  });
}

function cleanSummary(lane) {
  return JSON.stringify(summaryFor(lane));
}

function aggregateFixture(overrides = {}) {
  return aggregateSecurityScans({
    preflightResult: "success",
    lanes: Object.fromEntries(scanLanes.map((lane) => [lane, {
      result: "success",
      summary: cleanSummary(lane)
    }])),
    ...overrides
  });
}

function codeqlReport(overrides = {}) {
  return {
    version: "2.1.0",
    runs: [{
      tool: {
        driver: {
          name: "CodeQL command-line toolchain",
          organization: "GitHub",
          version: "2.27.1"
        },
        extensions: [{
          name: "javascript-queries",
          rules: [{ id: "js/example" }]
        }]
      },
      results: []
    }],
    ...overrides
  };
}

function trivyReport(overrides = {}) {
  return {
    expectedTargets: [{ kind: "terraform-module", path: "." }],
    scan: {
      SchemaVersion: 2,
      Trivy: { Version: "0.75.0" },
      ArtifactType: "filesystem",
      Results: [{
        Target: ".",
        Class: "config",
        Type: "terraform",
        MisconfSummary: { Successes: 53, Failures: 0 },
        Misconfigurations: []
      }]
    },
    ...overrides
  };
}

describe("security scan summaries", () => {
  it("records lockfile audit findings without exposing report details", () => {
    const summary = summarizeReport({
      lane: "npm-audit-full",
      ...identity("npm-audit-full"),
      exitCode: 1,
      source: JSON.stringify({
        auditReportVersion: 2,
        metadata: { vulnerabilities: { total: 3 } },
        vulnerabilities: { private: "do-not-log" }
      })
    });

    expect(summary).toMatchObject({ status: "findings", findings: 3, targetCount: 1 });
    expect(JSON.stringify(summary)).not.toContain("do-not-log");
  });

  it("accepts only real pinned CodeQL SARIF and counts suppressed results", () => {
    const accepted = summarizeReport({
      lane: "codeql",
      ...identity("codeql"),
      exitCode: 0,
      source: JSON.stringify(codeqlReport())
    });
    const suppressedFinding = summarizeReport({
      lane: "codeql",
      ...identity("codeql"),
      exitCode: 0,
      source: JSON.stringify(codeqlReport({
        runs: [{
          tool: {
            driver: {
              name: "CodeQL command-line toolchain",
              organization: "GitHub",
              version: "2.27.1"
            },
            extensions: [{ rules: [{ id: "js/example" }] }]
          },
          invocations: [{ executionSuccessful: true }],
          results: [{ ruleId: "js/example", suppressions: [{ kind: "inSource" }] }]
        }]
      }))
    });
    const partialExecution = summarizeReport({
      lane: "codeql",
      ...identity("codeql"),
      exitCode: 0,
      source: JSON.stringify(codeqlReport({
        runs: [{
          ...codeqlReport().runs[0],
          invocations: [{ executionSuccessful: true }, { executionSuccessful: false }]
        }]
      }))
    });
    const errorDiagnostic = summarizeReport({
      lane: "codeql",
      ...identity("codeql"),
      exitCode: 0,
      source: JSON.stringify(codeqlReport({
        runs: [{
          ...codeqlReport().runs[0],
          invocations: [{
            executionSuccessful: true,
            toolExecutionNotifications: [{ level: "error" }]
          }]
        }]
      }))
    });
    const malformedCatalog = summarizeReport({
      lane: "codeql",
      ...identity("codeql"),
      exitCode: 0,
      source: JSON.stringify(codeqlReport({
        runs: [{
          tool: {
            driver: {
              name: "CodeQL command-line toolchain",
              organization: "GitHub",
              version: "2.27.1",
              rules: [{ id: "js/example" }]
            },
            extensions: []
          },
          results: []
        }]
      }))
    });

    expect(accepted).toMatchObject({ status: "clean", targetCount: 1 });
    expect(suppressedFinding).toMatchObject({ status: "findings", findings: 1 });
    expect(partialExecution).toMatchObject({ status: "error" });
    expect(errorDiagnostic).toMatchObject({ status: "error" });
    expect(malformedCatalog).toMatchObject({ status: "error" });
  });

  it("requires actual Trivy config coverage instead of a target-shaped clean result", () => {
    const accepted = summarizeReport({
      lane: "trivy-config",
      ...identity("trivy-config"),
      exitCode: 0,
      source: JSON.stringify(trivyReport())
    });
    const findings = summarizeReport({
      lane: "trivy-config",
      ...identity("trivy-config"),
      exitCode: 0,
      source: JSON.stringify(trivyReport({
        scan: {
          ...trivyReport().scan,
          Results: [
            ...trivyReport().scan.Results,
            {
              Target: "main.tf",
              Class: "config",
              Type: "terraform",
              MisconfSummary: { Successes: 0, Failures: 1 },
              Misconfigurations: [{ Status: "FAIL" }]
            }
          ]
        }
      }))
    });
    const noAggregateCoverage = summarizeReport({
      lane: "trivy-config",
      ...identity("trivy-config"),
      exitCode: 0,
      source: JSON.stringify(trivyReport({
        scan: {
          ...trivyReport().scan,
          Results: [{
            Target: "main.tf",
            Class: "config",
            Type: "terraform",
            MisconfSummary: { Successes: 1, Failures: 0 },
            Misconfigurations: []
          }]
        }
      }))
    });
    const malformedTarget = summarizeReport({
      lane: "trivy-config",
      ...identity("trivy-config"),
      exitCode: 0,
      source: JSON.stringify(trivyReport({
        scan: {
          ...trivyReport().scan,
          Results: [{
            ...trivyReport().scan.Results[0],
            Target: "../private.tf"
          }]
        }
      }))
    });

    expect(accepted).toMatchObject({ status: "clean", targetCount: 1 });
    expect(findings).toMatchObject({ status: "findings", findings: 1, targetCount: 1 });
    expect(noAggregateCoverage).toMatchObject({ status: "error" });
    expect(malformedTarget).toMatchObject({ status: "error" });
  });

  it("fails closed for missing reports and operational exit codes without including their contents", () => {
    const missing = summarizeReport({
      lane: "actionlint",
      ...identity("actionlint"),
      exitCode: 0,
      source: "[]",
      reportExists: false,
      expectedTargetCount: 1
    });
    const malformed = summarizeReport({
      lane: "gitleaks",
      ...identity("gitleaks"),
      exitCode: 2,
      source: "private scanner stderr"
    });
    const emptyActionlintFailure = summarizeReport({
      lane: "actionlint",
      ...identity("actionlint"),
      exitCode: 1,
      source: "[]",
      expectedTargetCount: 1
    });
    const operationalAuditFailure = summarizeReport({
      lane: "npm-audit-full",
      ...identity("npm-audit-full"),
      exitCode: 127,
      source: JSON.stringify({ auditReportVersion: 2, metadata: { vulnerabilities: { total: 3 } } })
    });
    const zizmorFindingExit = summarizeReport({
      lane: "zizmor",
      ...identity("zizmor"),
      exitCode: 14,
      source: JSON.stringify([{ fixture: "finding" }]),
      expectedTargetCount: 1
    });
    const zizmorClean = summarizeReport({
      lane: "zizmor",
      ...identity("zizmor"),
      exitCode: 0,
      source: "[]",
      expectedTargetCount: 2
    });

    expect(missing).toMatchObject({ status: "error", findings: 0, targetCount: 0 });
    expect(malformed).toMatchObject({ status: "error", findings: 0, targetCount: 0 });
    expect(emptyActionlintFailure).toMatchObject({ status: "error", findings: 0, targetCount: 0 });
    expect(operationalAuditFailure).toMatchObject({ status: "error", findings: 0, targetCount: 0 });
    expect(zizmorFindingExit).toMatchObject({ status: "error", findings: 0, targetCount: 0 });
    expect(zizmorClean).toMatchObject({ status: "clean", targetCount: 2 });
    expect(JSON.stringify(malformed)).not.toContain("private scanner stderr");
  });

  it("permits N/A only for successful zero-target Terraform and Trivy reports", () => {
    const terraformNotApplicable = summarizeReport({
      lane: "terraform-validate",
      ...identity("terraform-validate"),
      exitCode: 0,
      source: JSON.stringify({ roots: [] })
    });
    const failedTerraform = summarizeReport({
      lane: "terraform-validate",
      ...identity("terraform-validate"),
      exitCode: 1,
      source: JSON.stringify({ roots: [] })
    });
    const trivyNotApplicable = summarizeReport({
      lane: "trivy-config",
      ...identity("trivy-config"),
      exitCode: 0,
      source: JSON.stringify({
        expectedTargets: [],
        scan: {
          SchemaVersion: 2,
          Trivy: { Version: "0.75.0" },
          ArtifactType: "filesystem",
          Results: []
        }
      })
    });

    expect(terraformNotApplicable).toMatchObject({
      status: "not-applicable",
      reason: "no-terraform-targets",
      targetCount: 0
    });
    expect(trivyNotApplicable).toMatchObject({
      status: "not-applicable",
      reason: "no-config-targets",
      targetCount: 0
    });
    expect(failedTerraform).toMatchObject({ status: "error" });
    expect(() => createScanSummary({
      lane: "gitleaks",
      ...identity("gitleaks"),
      targetCount: 0,
      findings: 0,
      status: "clean"
    })).toThrow(/at least one target/);
  });

  it("inventories nested tracked configuration files before Trivy covers the checkout root", async () => {
    const root = await mkdtemp(path.join(tmpdir(), "portfolio-trivy-inventory-"));
    await mkdir(path.join(root, "infra"), { recursive: true });
    await mkdir(path.join(root, "ops"), { recursive: true });
    await writeFile(path.join(root, "main.tf"), "terraform {}\n", "utf8");
    await writeFile(path.join(root, "infra", "Dockerfile"), "FROM scratch\n", "utf8");
    await writeFile(path.join(root, "ops", "compose.yaml"), "services: {}\n", "utf8");
    await execFileAsync("git", ["init", "--quiet", root]);
    await execFileAsync("git", ["-C", root, "add", "."]);

    const inventoryPath = path.join(root, "inventory.json");
    await execFileAsync(process.execPath, [summaryScript, "trivy-targets", root, inventoryPath]);
    const inventory = JSON.parse(await readFile(inventoryPath, "utf8"));

    expect(inventory).toEqual(expect.arrayContaining([
      { kind: "terraform-module", path: "." },
      { kind: "file", path: "infra/Dockerfile" },
      { kind: "file", path: "ops/compose.yaml" }
    ]));
  });

  it("requires exact, owned, unexpired registry entries and rejects native bypass files", () => {
    expect(validateSuppressionConfiguration({ schemaVersion: 1, suppressions: [] })).toEqual([]);
    expect(validateSuppressionConfiguration(
      { schemaVersion: 1, suppressions: [] },
      new Date("2026-10-08T00:00:00.000Z"),
      [".gitleaksignore"]
    )).toEqual(expect.arrayContaining([
      "tool-native scanner suppression configuration is not permitted"
    ]));
    expect(validateSuppressionConfiguration({
      schemaVersion: 1,
      suppressions: [{
        lane: "gitleaks",
        rule: "generic-*",
        fingerprint: "*",
        reason: "fixture",
        owner: "security",
        expiresAt: "2000-01-01",
        bypass: true
      }]
    }, new Date("2026-10-08T00:00:00.000Z"))).toEqual(expect.arrayContaining([
      expect.stringContaining("rule must be exact"),
      expect.stringContaining("fingerprint must be exact"),
      expect.stringContaining("expiry must be a future ISO date"),
      expect.stringContaining("unsupported field")
    ]));
  });

  it("fails closed for findings, missing summaries, skipped jobs, errors, and wrong identities", () => {
    const baseline = aggregateFixture();
    expect(baseline).toMatchObject({ ok: true, errors: [] });

    const findingResult = aggregateSecurityScans({
      preflightResult: "success",
      lanes: Object.fromEntries(scanLanes.map((lane) => [lane, {
        result: "success",
        summary: lane === "npm-audit-full"
          ? JSON.stringify(summaryFor(lane, { findings: 1, status: "findings" }))
          : cleanSummary(lane)
      }]))
    });
    expect(findingResult.ok).toBe(false);
    expect(findingResult.errors).toEqual(expect.arrayContaining([
      "security scan npm-audit-full reported findings"
    ]));

    const skipped = aggregateFixture({
      lanes: {
        ...Object.fromEntries(scanLanes.map((lane) => [lane, {
          result: "success",
          summary: cleanSummary(lane)
        }])),
        gitleaks: { result: "skipped", summary: "" },
        zizmor: { result: "success", summary: "not-json" },
        codeql: {
          result: "success",
          summary: JSON.stringify({
            schemaVersion: 1,
            lane: "codeql",
            tool: "wrong-tool",
            version: "2.27.1",
            targetCount: 1,
            findings: 0,
            status: "clean"
          })
        }
      }
    });
    expect(skipped.ok).toBe(false);
    expect(skipped.errors).toEqual(expect.arrayContaining([
      "security scan gitleaks did not succeed",
      "security scan zizmor summary is missing or malformed",
      "security scan codeql summary is missing or malformed"
    ]));
  });
});
