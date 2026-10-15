import { lstat, readdir } from "node:fs/promises";
import path from "node:path";
import { exactKeys, parseCandidate, parsePlan, recordDigest, securityJobs } from "./plan.mjs";
import { parseProducer } from "./snapshot.mjs";
import { parseBrowserReport } from "./browserDiscovery.mjs";
import { allowedBrowserSkips, validateSkipRegistry } from "./browserSkips.mjs";
import { verifyDiscoveryCoverage, verifyReceipt } from "./receipts.mjs";
import { readRegularFile } from "../lib/readRegularFile.mjs";

export function parseChromiumDiscovery(value) {
  exactKeys(value, ["schemaVersion", "project", "discoveryDigest", "assignments"], "Chromium discovery");
  if (value.schemaVersion !== 1 || value.project !== "chromium") throw new Error("Unexpected discovery version or project.");
  const names = ["full", "chromium-1-of-2", "chromium-2-of-2", "visual-regression"];
  exactKeys(value.assignments, names, "Chromium assignments");
  for (const name of names) {
    const entry = value.assignments[name];
    exactKeys(entry, ["identities", "digest"], "Browser assignment");
    if (!Array.isArray(entry.identities) || entry.digest !== recordDigest([...entry.identities].sort())) throw new Error("Browser assignment digest does not match.");
  }
  const assignments = value.assignments;
  const full = assignments.full.identities;
  if (full.some((identity) => JSON.parse(identity)[0] !== "chromium") ||
      verifyDiscoveryCoverage(full, names.slice(1).map((name) => assignments[name].identities)) !== value.discoveryDigest) {
    throw new Error("Chromium discovery coverage changed.");
  }
  validateSkipRegistry(full);
  return value;
}

export function createValidationReceipt({ plan: input, validator, job, producer, assignment = null,
  browserReport = null, artifactRecordDigest = null, durationMs }) {
  const plan = parsePlan(input);
  let report = null;
  if (assignment !== null) {
    report = parseBrowserReport(browserReport, "execution");
    if (recordDigest([...report.identities].sort()) !== recordDigest([...assignment].sort())) throw new Error("Browser execution changed its assigned discovery.");
  } else if (browserReport !== null) throw new Error("Source validation cannot use browser evidence.");
  const receipt = {
    schemaVersion: 1, validator, planDigest: recordDigest(plan), snapshotDigest: plan.snapshotDigest,
    artifactRecordDigest, producer: parseProducer(producer, job),
    discoveryDigest: assignment === null ? null : recordDigest([...assignment].sort()),
    cases: report?.cases ?? [], durationMs, outcome: "success"
  };
  verifyReceipt(receipt, { plan, validator, job, assignment, artifactRecordDigest, allowedSkips: allowedBrowserSkips });
  return receipt;
}

// Source-only scanners are independent of content preparation. Bind their
// receipts to the candidate/workflow, never invent a content-dependent plan.
const sourceValidators = new Set([...securityJobs, "dependency-review"]);
export function createSourceReceipt({ candidate, validator, producer }) {
  parseCandidate(candidate);
  if (!sourceValidators.has(validator)) throw new Error("Unknown independent source validator.");
  const identity = parseProducer(producer, validator);
  if (identity.runId !== candidate.runId || identity.runNumber !== candidate.runNumber || identity.attempt < candidate.producerAttempt) throw new Error("Source evidence belongs to another generation.");
  return { schemaVersion: 1, validator, candidateDigest: recordDigest(candidate), producer: identity, outcome: "success" };
}

export function verifySourceReceipt(value, { candidate, validator }) {
  exactKeys(value, ["schemaVersion", "validator", "candidateDigest", "producer", "outcome"], "Source receipt");
  const expected = createSourceReceipt({ candidate, validator, producer: value.producer });
  if (recordDigest(value) !== recordDigest(expected)) throw new Error("Independent source validation evidence is unsuccessful or mismatched.");
  return expected;
}

export async function readEvidenceArtifact(directory, file) {
  if (!["receipt.json", "discovery.json"].includes(file)) throw new Error("Unexpected evidence filename.");
  const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink() || (await readdir(directory)).join(",") !== file) throw new Error("Evidence artifact contains missing, extra or unsafe entries.");
  let bytes;
  try { bytes = await readRegularFile(path.join(directory, file), { minimumBytes: 1, maximumBytes: 8 * 1024 * 1024 }); }
  catch { throw new Error("Evidence file is unsafe or outside its size budget."); }
  try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("Evidence file is malformed."); }
}
