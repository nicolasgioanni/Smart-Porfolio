import { describe, expect, it } from "vitest";
import { parseAuditCommandResult, unresolvedAuditAdvisories, validateAuditExceptions, validateAuditReport } from "./checkDependencyAudit.mjs";

const exception = { advisory: "GHSA-vfj7-8cjw-p6xm", owner: "nicolasgioanni", expires: "2026-11-07", exposure: "dev", remediation: "upgrade", package: "braces", version: "3.0.3", path: "node_modules/braces" };
const lock = { packages: { "node_modules/braces": { version: "3.0.3", dev: true } } };
const counters = { info: 0, low: 0, moderate: 0, high: 2, critical: 0, total: 2 };
const audit = { auditReportVersion: 2, metadata: { vulnerabilities: counters }, vulnerabilities: { braces: { severity: "high", via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm", title: "braces" }] }, parent: { severity: "high", via: ["braces"] } } };

describe("dependency audit gate", () => {
  it("permits only the current exact development-only exception", () => {
    validateAuditExceptions([exception], lock);
    expect(unresolvedAuditAdvisories(audit, [exception], new Date("2026-10-07"))).toEqual([]);
    expect(unresolvedAuditAdvisories(audit, [exception], new Date("2026-12-01"))).toHaveLength(2);
  });
  it("fails closed for malformed, error, missing, and failed audit command reports", () => {
    for (const report of [{}, { auditReportVersion: 2, metadata: { vulnerabilities: { total: 0 } } }, { auditReportVersion: 2, metadata: { vulnerabilities: { ...counters, total: 0 } }, vulnerabilities: {}, error: { message: "registry" } }]) expect(() => parseAuditCommandResult({ status: 1, stdout: JSON.stringify(report) })).toThrow();
    expect(() => parseAuditCommandResult({ status: 2, stdout: JSON.stringify(audit) })).toThrow();
    expect(() => parseAuditCommandResult({ status: 1, signal: "SIGTERM", stdout: JSON.stringify(audit) })).toThrow();
    expect(() => parseAuditCommandResult({ status: 1, stdout: "not json" })).toThrow();
    expect(() => parseAuditCommandResult({ status: 0, stdout: JSON.stringify(audit) })).toThrow("exit status");
    const empty = { auditReportVersion: 2, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 0, critical: 0, total: 0 } }, vulnerabilities: {} };
    expect(() => parseAuditCommandResult({ status: 1, stdout: JSON.stringify(empty) })).toThrow("exit status");
  });
  it("rejects a future production scope or a mismatched locked path", () => {
    expect(() => validateAuditExceptions([{ ...exception, path: "node_modules/other/braces" }], lock)).toThrow();
    expect(() => validateAuditExceptions([{ ...exception, version: "3.0.4" }], lock)).toThrow();
    expect(() => validateAuditExceptions([{ ...exception, owner: "Maintainer" }], lock)).toThrow();
    expect(() => validateAuditExceptions([{ ...exception, expires: "2026-99-99" }], lock)).toThrow();
    expect(() => validateAuditExceptions([exception, { ...exception, path: "node_modules/second/braces" }], lock)).toThrow();
  });
  it("rejects cyclic, missing, empty, and malformed advisory graphs", () => {
    expect(() => validateAuditReport({ ...audit, metadata: { vulnerabilities: { ...counters, total: 1 } } })).toThrow();
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { braces: { severity: "high", via: [] } }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } } })).toThrow();
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { braces: { severity: "high", via: ["missing"] } }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } } })).toThrow();
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { braces: { severity: "high", via: ["parent"] }, parent: { severity: "high", via: ["braces"] } } })).toThrow();
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { braces: { severity: "high", via: [{}] } }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } } })).toThrow();
  });
  it("rejects partial, contradictory, and unrecognized vulnerability severities", () => {
    expect(() => validateAuditReport({ ...audit, metadata: { vulnerabilities: { total: 2, high: 2 } } })).toThrow("severity counters");
    expect(() => validateAuditReport({ ...audit, metadata: { vulnerabilities: { ...counters, high: 1, critical: 1 } } })).toThrow("severity counters do not match");
    expect(() => validateAuditReport({ ...audit, metadata: { vulnerabilities: { ...counters, high: 1.5 } } })).toThrow("severity counters");
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { ...audit.vulnerabilities, braces: { ...audit.vulnerabilities.braces, severity: "unknown" } } })).toThrow("usable advisory path");
  });
  it("does not allow the same advisory for a different reported package", () => {
    const renamed = { ...audit, vulnerabilities: { other: { severity: "high", via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm", title: "other" }] } }, metadata: { vulnerabilities: { info: 0, low: 0, moderate: 0, high: 1, critical: 0, total: 1 } } };
    validateAuditReport(renamed);
    expect(unresolvedAuditAdvisories(renamed, [exception], new Date("2026-10-07"))).toHaveLength(1);
  });
});
