#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..");
const exceptionPath = path.join(projectRoot, "security", "audit-exceptions.json");
const auditTimeoutMs = 15_000;
const auditMaxBytes = 1_000_000;
const severityCounters = ["info", "low", "moderate", "high", "critical"];

function advisoryId(url) {
  return typeof url === "string" ? url.match(/GHSA-[a-z0-9-]+$/i)?.[0]?.toUpperCase() : undefined;
}

function isCanonicalDate(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;
}

export function validateAuditReport(audit) {
  if (!audit || typeof audit !== "object" || audit.error || audit.auditReportVersion !== 2 || !audit.metadata?.vulnerabilities || !audit.vulnerabilities || typeof audit.vulnerabilities !== "object" || Array.isArray(audit.vulnerabilities)) {
    throw new Error("npm audit returned an incomplete or malformed report.");
  }
  const counters = audit.metadata.vulnerabilities;
  if (Object.keys(counters).sort().join(",") !== [...severityCounters, "total"].sort().join(",") || Object.values(counters).some((count) => !Number.isInteger(count) || count < 0)) {
    throw new Error("npm audit vulnerability severity counters are malformed.");
  }
  const names = Object.keys(audit.vulnerabilities);
  if (counters.total !== names.length || severityCounters.reduce((sum, severity) => sum + counters[severity], 0) !== counters.total) {
    throw new Error("npm audit metadata does not match its vulnerability graph.");
  }
  const graphCounters = Object.fromEntries(severityCounters.map((severity) => [severity, 0]));
  const visited = new Set();
  const visit = (name, visiting = new Set()) => {
    if (visiting.has(name)) throw new Error("npm audit vulnerability graph contains a cycle.");
    if (visited.has(name)) return;
    const vulnerability = audit.vulnerabilities[name];
    if (!vulnerability || !severityCounters.includes(vulnerability.severity) || !Array.isArray(vulnerability.via) || vulnerability.via.length === 0) throw new Error("npm audit vulnerability entry has no usable advisory path.");
    graphCounters[vulnerability.severity] += 1;
    visiting.add(name);
    for (const entry of vulnerability.via) {
      if (typeof entry === "string") {
        if (!audit.vulnerabilities[entry]) throw new Error("npm audit vulnerability graph references a missing node.");
        visit(entry, visiting);
      } else if (!entry || typeof entry !== "object" || !advisoryId(entry.url) || typeof entry.title !== "string" || !entry.title) {
        throw new Error("npm audit vulnerability entry is malformed.");
      }
    }
    visiting.delete(name);
    visited.add(name);
  };
  for (const name of names) visit(name);
  if (severityCounters.some((severity) => graphCounters[severity] !== counters[severity])) {
    throw new Error("npm audit severity counters do not match its vulnerability graph.");
  }
}

export function validateAuditExceptions(exceptions, lock) {
  const advisoryIds = new Set();
  const packagePaths = new Set();
  for (const exception of exceptions) {
    if (!/^GHSA-[a-z0-9-]+$/i.test(exception.advisory) || exception.owner !== "nicolasgioanni" || !isCanonicalDate(exception.expires) || !exception.exposure || !exception.remediation || !exception.package || !exception.version || !exception.path) {
      throw new Error("Each audit exception requires its exact advisory, owner, canonical expiry, exposure, remediation, package, version, and path.");
    }
    const advisory = exception.advisory.toUpperCase();
    if (advisoryIds.has(advisory) || packagePaths.has(exception.path)) throw new Error("Audit exceptions may not duplicate an advisory or locked package path.");
    advisoryIds.add(advisory);
    packagePaths.add(exception.path);
    const entry = lock?.packages?.[exception.path];
    if (!entry || entry.version !== exception.version || entry.dev !== true || path.basename(exception.path) !== exception.package) throw new Error(`Audit exception ${exception.advisory} does not match a development-only locked package.`);
    const paths = Object.keys(lock.packages).filter((packagePath) => path.basename(packagePath) === exception.package);
    if (paths.length !== 1 || paths[0] !== exception.path) throw new Error(`Audit exception ${exception.advisory} cannot cover additional ${exception.package} package paths.`);
  }
}

export function unresolvedAuditAdvisories(audit, exceptions, now = new Date()) {
  const allowed = new Map(exceptions.map((entry) => [entry.advisory.toUpperCase(), entry]));
  const resolve = (name) => audit.vulnerabilities[name].via.flatMap((entry) => {
    if (typeof entry === "string") return resolve(entry);
    return [{ name, advisory: advisoryId(entry.url), title: entry.title }];
  });
  return Object.keys(audit.vulnerabilities).flatMap(resolve).filter(({ name, advisory }) => {
    const exception = advisory && allowed.get(advisory);
    return !exception || exception.package !== name || new Date(`${exception.expires}T23:59:59.999Z`) < now;
  });
}

export function parseAuditCommandResult(result) {
  if (result.error || result.signal || ![0, 1].includes(result.status) || typeof result.stdout !== "string" || Buffer.byteLength(result.stdout) > auditMaxBytes) throw new Error("npm audit failed to produce a bounded report.");
  let audit;
  try { audit = JSON.parse(result.stdout); } catch { throw new Error("npm audit returned invalid JSON."); }
  validateAuditReport(audit);
  const hasFindings = audit.metadata.vulnerabilities.total > 0;
  if ((result.status === 1) !== hasFindings) throw new Error("npm audit exit status does not match its vulnerability report.");
  return audit;
}

async function main() {
  const [exceptionsDocument, lock] = await Promise.all([readFile(exceptionPath, "utf8").then(JSON.parse), readFile(path.join(projectRoot, "package-lock.json"), "utf8").then(JSON.parse)]);
  if (exceptionsDocument.schemaVersion !== 1 || !Array.isArray(exceptionsDocument.exceptions)) throw new Error("Invalid audit exception document.");
  validateAuditExceptions(exceptionsDocument.exceptions, lock);
  const npmEntry = process.env.npm_execpath;
  const result = spawnSync(npmEntry ? process.execPath : "npm", npmEntry ? [npmEntry, "audit", "--json"] : ["audit", "--json"], { cwd: projectRoot, encoding: "utf8", timeout: auditTimeoutMs, maxBuffer: auditMaxBytes });
  const audit = parseAuditCommandResult(result);
  const unresolved = unresolvedAuditAdvisories(audit, exceptionsDocument.exceptions);
  if (unresolved.length > 0) throw new Error(`Dependency audit has unapproved or expired advisories: ${[...new Set(unresolved.map((entry) => entry.advisory ?? entry.name))].join(", ")}`);
  console.log("Dependency audit contains no unapproved or expired advisories.");
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main().catch((error) => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; });
