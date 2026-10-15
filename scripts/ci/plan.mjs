import { createHash } from "node:crypto";

export const repository = "nicolasgioanni/Smart-Porfolio";
export const workflowPath = ".github/workflows/ci.yml";
export const applicationJobs = Object.freeze([
  "quality", "unit-integration", "browser-e2e", "visual-regression",
  "cross-browser", "build-and-package", "export-check"
]);
export const securityJobs = Object.freeze(["security-tools", "security-scans", "codeql", "infrastructure"]);
export const chromiumShards = Object.freeze(["1/2", "2/2"]);

export function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) {
    throw new Error(`${label} must contain exactly the supported fields.`);
  }
}

export function assertSha(value, label = "Source revision") {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

export function assertDigest(value, label = "Digest") {
  if (typeof value !== "string" || !/^[a-f0-9]{64}$/.test(value)) throw new Error(`${label} is invalid.`);
  return value;
}

export function positiveInteger(value, label) {
  if (!Number.isSafeInteger(value) || value < 1) throw new Error(`${label} must be a positive safe integer.`);
  return value;
}

// CLI/environment conversion is deliberately separate from the strict record schema.
export function parseBoolean(value, label) {
  if (value !== "true" && value !== "false") throw new Error(`${label} must be true or false.`);
  return value === "true";
}

export function recordDigest(value) {
  const canonical = (item) => Array.isArray(item) ? item.map(canonical) :
    item && typeof item === "object" ? Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])])) : item;
  return createHash("sha256").update(JSON.stringify(canonical(value))).digest("hex");
}

const candidateKeys = ["schemaVersion", "repository", "event", "ref", "workflowRef", "workflowSha",
  "sourceSha", "eventSha", "runHeadSha", "branchTip", "pullNumber", "baseBranch", "force", "runId", "runNumber", "producerAttempt"];

export function parseCandidate(value) {
  exactKeys(value, candidateKeys, "CI candidate");
  if (value.schemaVersion !== 1 || value.repository !== repository) throw new Error("Unsupported candidate schema or repository.");
  for (const key of ["workflowSha", "sourceSha", "eventSha", "runHeadSha"]) assertSha(value[key], key);
  for (const key of ["runId", "runNumber", "producerAttempt"]) positiveInteger(value[key], key);
  if (typeof value.force !== "boolean") throw new Error("Candidate force must be a boolean.");
  if (!["pull_request", "push", "schedule", "workflow_dispatch"].includes(value.event)) throw new Error("Unsupported CI event.");
  const expectedWorkflow = `${repository}/${workflowPath}@${value.ref}`;
  if (value.workflowRef !== expectedWorkflow) throw new Error("Workflow ref does not match the eligible event ref.");
  if (value.event === "pull_request") {
    positiveInteger(value.pullNumber, "Pull request number");
    if (value.ref !== `refs/pull/${value.pullNumber}/merge` || !["main", "develop"].includes(value.baseBranch) ||
        value.sourceSha !== value.eventSha || value.branchTip !== null || value.force) {
      throw new Error("Pull requests require the exact event merge candidate and credential-free template inputs.");
    }
  } else {
    assertSha(value.branchTip, "Protected branch tip");
    if (value.runHeadSha !== value.eventSha || value.sourceSha !== value.eventSha || value.workflowSha !== value.eventSha) throw new Error("Trusted source and workflow candidates must match the triggering run revision.");
    if (value.pullNumber !== null || value.baseBranch !== null) throw new Error("Trusted events cannot carry pull-request metadata.");
    if (value.event === "push") {
      if (!["refs/heads/main", "refs/heads/develop"].includes(value.ref) || value.sourceSha !== value.eventSha || value.force) {
        throw new Error("Push candidates must match their permanent-branch event revision.");
      }
    } else if (value.ref !== "refs/heads/main" || (value.event === "schedule" && value.force)) {
      throw new Error("Scheduled and manual runs must execute the trusted main workflow.");
    }
  }
  return structuredClone(value);
}

export function candidateTarget(candidate) {
  parseCandidate(candidate);
  return candidate.event === "pull_request" ? "local" : candidate.ref === "refs/heads/develop" ? "preview" : "production";
}

export function requiredJobs(candidate, mode) {
  parseCandidate(candidate);
  if (!["full", "obsolete", "unchanged"].includes(mode)) throw new Error("Unknown execution mode.");
  return ["resolve-candidate", "prepare-content", ...securityJobs,
    ...(candidate.event === "pull_request" ? ["dependency-review"] : []),
    ...(mode === "full" ? applicationJobs : [])];
}

// A comparison is produced by the versioned deployed-identity reader. Missing or
// malformed observations must fail there, never be coerced into an unchanged plan.
export function createPlan(candidateValue, { snapshotDigest = null, comparison = null } = {}) {
  const candidate = parseCandidate(candidateValue);
  const stale = candidate.event !== "pull_request" && candidate.sourceSha !== candidate.branchTip;
  let mode = "full";
  if (stale) {
    if (snapshotDigest !== null || comparison !== null) throw new Error("Obsolete candidates cannot carry prepared inputs.");
    mode = "obsolete";
  } else {
    assertDigest(snapshotDigest, "Snapshot record digest");
    const canCompare = candidate.event === "schedule" || (candidate.event === "workflow_dispatch" && !candidate.force);
    if (canCompare) {
      exactKeys(comparison, ["schemaVersion", "equivalent", "identityDigest"], "Deployment comparison");
      if (comparison.schemaVersion !== 1 || typeof comparison.equivalent !== "boolean") throw new Error("Deployment comparison is invalid.");
      if (comparison.identityDigest !== null) assertDigest(comparison.identityDigest, "Deployed identity digest");
      if (comparison.equivalent && comparison.identityDigest === null) throw new Error("Unchanged plans need validated deployed identity evidence.");
      if (comparison.equivalent) mode = "unchanged";
    } else if (comparison !== null) throw new Error("This event cannot use unchanged-content optimization.");
  }
  return {
    schemaVersion: 1, candidate, target: candidateTarget(candidate),
    sourceMode: candidate.event === "pull_request" ? "templates" : "remote",
    mode, snapshotDigest, comparison, tier: mode === "full" ? "full" : "none",
    deploy: mode === "full" && candidate.event !== "pull_request",
    requiredJobs: requiredJobs(candidate, mode),
    chromiumShards: mode === "full" ? [...chromiumShards] : []
  };
}

export function parsePlan(value) {
  exactKeys(value, ["schemaVersion", "candidate", "target", "sourceMode", "mode", "snapshotDigest", "comparison", "tier", "deploy", "requiredJobs", "chromiumShards"], "CI plan");
  const expected = createPlan(value.candidate, value);
  if (recordDigest(value) !== recordDigest(expected)) throw new Error("CI plan contradicts its validated candidate or evidence.");
  return expected;
}

export function evaluateResults(planValue, results) {
  const plan = parsePlan(planValue);
  const knownJobs = [...new Set([...requiredJobs(plan.candidate, "full"), "dependency-review"])];
  exactKeys(results, knownJobs, "CI aggregate dependencies");
  const failures = [];
  for (const job of knownJobs) {
    const expected = plan.requiredJobs.includes(job) ? "success" : "skipped";
    if (results[job]?.result !== expected) failures.push(`${job}=${results[job]?.result ?? "missing"} (expected ${expected})`);
  }
  return { accepted: failures.length === 0, deploy: failures.length === 0 && plan.deploy, failures };
}
