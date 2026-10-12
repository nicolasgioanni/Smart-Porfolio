import { describe, expect, it } from "vitest";
import { parseAuditCommandResult, unresolvedAuditAdvisories, validateAuditExceptions, validateAuditReport } from "./checkDependencyAudit.mjs";

const exception = { advisory: "GHSA-vfj7-8cjw-p6xm", owner: "nicolasgioanni", expires: "2026-11-07", exposure: "dev", remediation: "upgrade", package: "braces", version: "3.0.3", path: "node_modules/braces" };
const lock = { packages: { "node_modules/braces": { version: "3.0.3", dev: true } } };
const audit = { auditReportVersion: 2, metadata: { vulnerabilities: { total: 2 } }, vulnerabilities: { braces: { via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm", title: "braces" }] }, parent: { via: ["braces"] } } };

describe("dependency audit gate", () => {
  it("permits only the current exact development-only exception", () => {
    validateAuditExceptions([exception], lock);
    expect(unresolvedAuditAdvisories(audit, [exception], new Date("2026-10-07"))).toEqual([]);
    expect(unresolvedAuditAdvisories(audit, [exception], new Date("2026-12-01"))).toHaveLength(2);
  });
  it("fails closed for malformed, error, missing, and failed audit command reports", () => {
    for (const report of [{}, { auditReportVersion: 2, metadata: { vulnerabilities: { total: 0 } } }, { auditReportVersion: 2, metadata: { vulnerabilities: { total: 0 } }, vulnerabilities: {}, error: { message: "registry" } }]) expect(() => parseAuditCommandResult({ status: 1, stdout: JSON.stringify(report) })).toThrow();
    expect(() => parseAuditCommandResult({ status: 2, stdout: JSON.stringify(audit) })).toThrow();
    expect(() => parseAuditCommandResult({ status: 1, signal: "SIGTERM", stdout: JSON.stringify(audit) })).toThrow();
    expect(() => parseAuditCommandResult({ status: 1, stdout: "not json" })).toThrow();
  });
  it("rejects a future production scope or a mismatched locked path", () => {
    expect(() => validateAuditExceptions([{ ...exception, path: "node_modules/other/braces" }], lock)).toThrow();
    expect(() => validateAuditExceptions([{ ...exception, version: "3.0.4" }], lock)).toThrow();
    expect(() => validateAuditExceptions([{ ...exception, owner: "Maintainer" }], lock)).toThrow();
    expect(() => validateAuditExceptions([{ ...exception, expires: "2026-99-99" }], lock)).toThrow();
    expect(() => validateAuditExceptions([exception, { ...exception, path: "node_modules/second/braces" }], lock)).toThrow();
  });
  it("rejects cyclic, missing, empty, and malformed advisory graphs", () => {
    expect(() => validateAuditReport({ ...audit, metadata: { vulnerabilities: { total: 1 } } })).toThrow();
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { braces: { via: [] } }, metadata: { vulnerabilities: { total: 1 } } })).toThrow();
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { braces: { via: ["missing"] } }, metadata: { vulnerabilities: { total: 1 } } })).toThrow();
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { braces: { via: ["parent"] }, parent: { via: ["braces"] } } })).toThrow();
    expect(() => validateAuditReport({ ...audit, vulnerabilities: { braces: { via: [{}] } }, metadata: { vulnerabilities: { total: 1 } } })).toThrow();
  });
  it("does not allow the same advisory for a different reported package", () => {
    const renamed = { ...audit, vulnerabilities: { other: { via: [{ url: "https://github.com/advisories/GHSA-vfj7-8cjw-p6xm", title: "other" }] } }, metadata: { vulnerabilities: { total: 1 } } };
    validateAuditReport(renamed);
    expect(unresolvedAuditAdvisories(renamed, [exception], new Date("2026-10-07"))).toHaveLength(1);
  });
});
