import { assertDigest, exactKeys, parsePlan, positiveInteger, recordDigest } from "./plan.mjs";
import { parseProducer } from "./snapshot.mjs";

export function testIdentity({ project, file, titlePath, repeatEachIndex = 0 }) {
  if (typeof project !== "string" || !/^[a-z][a-z0-9-]*$/.test(project) ||
      typeof file !== "string" || file.startsWith("/") || file.includes("\\") ||
      file.split("/").some((part) => !part || part === "." || part === "..") ||
      !Array.isArray(titlePath) || titlePath.length === 0 || titlePath.some((title) => typeof title !== "string" || !title) ||
      !Number.isSafeInteger(repeatEachIndex) || repeatEachIndex < 0) throw new Error("Invalid project-qualified test identity.");
  return JSON.stringify([project, file, titlePath, repeatEachIndex]);
}

export function parseTestIdentity(identity) {
  let value;
  try { value = JSON.parse(identity); } catch { throw new Error("Invalid test identity JSON."); }
  if (!Array.isArray(value) || value.length !== 4 ||
      testIdentity({ project: value[0], file: value[1], titlePath: value[2], repeatEachIndex: value[3] }) !== identity) throw new Error("Noncanonical test identity.");
  return value;
}

function identitySet(identities, label) {
  if (!Array.isArray(identities) || identities.length === 0) throw new Error(`${label} cannot be empty.`);
  identities.forEach(parseTestIdentity);
  const set = new Set(identities);
  if (set.size !== identities.length) throw new Error(`${label} contains duplicate tests.`);
  return set;
}

export function verifyDiscoveryCoverage(full, selections) {
  const expected = identitySet(full, "Full discovery");
  if (!Array.isArray(selections) || selections.length === 0) throw new Error("Missing shard discovery.");
  const seen = new Set();
  for (const selection of selections) {
    for (const id of identitySet(selection, "Shard discovery")) {
      if (!expected.has(id)) throw new Error("Shard discovered an unexpected test.");
      if (seen.has(id)) throw new Error("Browser selections duplicate a test.");
      seen.add(id);
    }
  }
  if (seen.size !== expected.size) throw new Error("Browser selections omit required tests.");
  return recordDigest([...expected].sort());
}

const receiptKeys = ["schemaVersion", "validator", "planDigest", "snapshotDigest", "artifactRecordDigest", "producer", "discoveryDigest", "cases", "durationMs", "outcome"];
const statusNames = new Set(["passed", "failed", "timedOut", "skipped", "interrupted"]);

export function verifyReceipt(value, { plan: planValue, validator, job, assignment = null, allowedSkips = {}, artifactRecordDigest = null }) {
  const plan = parsePlan(planValue);
  exactKeys(value, receiptKeys, "Validation receipt");
  if (value.schemaVersion !== 1 || value.validator !== validator || value.outcome !== "success") throw new Error("Validation receipt has the wrong validator or a non-success outcome.");
  assertDigest(value.planDigest, "Receipt plan digest");
  if (value.planDigest !== recordDigest(plan) || value.snapshotDigest !== plan.snapshotDigest ||
      value.artifactRecordDigest !== artifactRecordDigest) throw new Error("Validation receipt belongs to different inputs. Rerun all affected validators.");
  if (artifactRecordDigest !== null) assertDigest(artifactRecordDigest, "Accepted artifact record digest");
  const producer = parseProducer(value.producer, job);
  if (producer.runId !== plan.candidate.runId || producer.runNumber !== plan.candidate.runNumber ||
      producer.attempt < plan.candidate.producerAttempt) throw new Error("Validation receipt belongs to another run or obsolete producer.");
  if (!Number.isFinite(value.durationMs) || value.durationMs < 0 || !Array.isArray(value.cases)) throw new Error("Validation receipt timing or cases are invalid.");
  if (assignment === null) {
    if (value.cases.length !== 0 || value.discoveryDigest !== null) throw new Error("Source validator cannot claim browser discovery.");
    return { tests: 0, retries: 0, skips: 0, durationMs: value.durationMs };
  }
  const assigned = identitySet(assignment, "Assigned test discovery");
  if (value.discoveryDigest !== recordDigest([...assigned].sort())) throw new Error("Validation discovery differs from its assignment.");
  const observed = new Set();
  let retries = 0, skips = 0;
  for (const item of value.cases) {
    exactKeys(item, ["identity", "attempts", "skipReason"], "Executed test");
    parseTestIdentity(item.identity);
    if (!assigned.has(item.identity) || observed.has(item.identity)) throw new Error("Executed test is duplicated or unassigned.");
    observed.add(item.identity);
    if (!Array.isArray(item.attempts) || item.attempts.length < 1 || item.attempts.length > 2) throw new Error("Test evidence is missing or exceeds the existing one-retry budget.");
    for (const [index, attempt] of item.attempts.entries()) {
      exactKeys(attempt, ["status", "durationMs", "retry"], "Test attempt");
      if (attempt.retry !== index || !statusNames.has(attempt.status) || !Number.isFinite(attempt.durationMs) || attempt.durationMs < 0) throw new Error("Invalid or incomplete native test attempt sequence.");
    }
    const terminal = item.attempts.at(-1).status;
    retries += item.attempts.length - 1;
    if (terminal === "skipped") {
      if (item.attempts.length !== 1 || typeof item.skipReason !== "string" || !item.skipReason ||
          !Object.hasOwn(allowedSkips, item.identity) || !Array.isArray(allowedSkips[item.identity]) ||
          !allowedSkips[item.identity].includes(item.skipReason)) throw new Error("Unexplained or interrupted test skip.");
      skips += 1;
    } else if (terminal !== "passed" || item.skipReason !== null || item.attempts.slice(0, -1).some((attempt) => !["passed", "failed", "timedOut", "skipped"].includes(attempt.status))) {
      throw new Error("Test did not complete successfully under the existing retry policy.");
    }
    // A serial group's single native retry repeats earlier passed tests and
    // runs cases skipped after the first failure. Every final case must pass;
    // interruption and unexplained terminal skips are still rejected above.
  }
  if (observed.size !== assigned.size) throw new Error("Validation receipt omits assigned tests.");
  return { tests: observed.size, retries, skips, durationMs: value.durationMs };
}

// Query all attempts of this same run. Never select the latest *successful* job:
// a later failure/cancellation supersedes earlier success and blocks acceptance.
export function selectCompletedJob(jobs, { name, runId, currentAttempt }) {
  positiveInteger(runId, "Job run ID");
  positiveInteger(currentAttempt, "Job run attempt");
  if (typeof name !== "string" || !name || name.length > 100) throw new Error("Job name is invalid.");
  if (!Array.isArray(jobs)) throw new Error("Job evidence is unavailable.");
  const matching = jobs.filter((job) => job.name === name && job.run_id === runId);
  if (matching.length === 0 || matching.some((job) => !Number.isSafeInteger(job.run_attempt) || job.run_attempt < 1 || job.run_attempt > currentAttempt)) throw new Error("Job evidence is missing or has an invalid attempt.");
  const attempt = Math.max(...matching.map((job) => job.run_attempt));
  const latest = matching.filter((job) => job.run_attempt === attempt);
  if (latest.length !== 1 || latest[0].status !== "completed" || latest[0].conclusion !== "success") throw new Error("Latest job execution is ambiguous, incomplete or unsuccessful.");
  return latest[0];
}
