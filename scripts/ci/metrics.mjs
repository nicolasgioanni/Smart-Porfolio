import { appendFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkedCandidate } from "./context.mjs";
import { readRunAttemptEvidence, readRunCollection, readRunEvidence } from "./githubEvidence.mjs";
import { applicationJobs, parseCandidate, positiveInteger, securityJobs } from "./plan.mjs";
import { collectAttemptHistory, normalizeEffectiveExecutions } from "./effectiveExecution.mjs";

const measuredJobs = new Set(["resolve-candidate", "prepare-content", ...applicationJobs.filter((name) => name !== "browser-e2e"),
  "chromium-1-of-2", "chromium-2-of-2", ...securityJobs, "dependency-review"]);
const conclusions = new Set(["success", "failure", "cancelled", "skipped", "timed_out", "action_required", "neutral", "stale"]);
const milliseconds = (value) => typeof value === "string" && /^\d{4}-\d\d-\d\dT/.test(value) ? Date.parse(value) : NaN;
function duration(start, end) {
  const value = milliseconds(end) - milliseconds(start);
  return Number.isFinite(value) && value >= 0 ? value : null;
}
function category(name) {
  if (/^(?:Set up|Check out|Install|Post )/.test(name)) return "setupMs";
  if (/^Upload immutable /.test(name)) return "artifactUploadMs";
  if (name === "Restore and verify the accepted content snapshot") return "snapshotRestoreMs";
  if (name === "Prepare one accepted content snapshot and validated execution plan") return "contentPreparationAndDiscoveryMs";
  return "otherStepMs";
}

// Observational data only. Timing omissions are explicit; this record is never
// parsed by acceptance or deployment and cannot turn a failed check green.
export function summarizeTimings({ candidate: input, currentAttempt, attempts, jobs, runCreatedAt, summaries = {} }) {
  const candidate = parseCandidate(input);
  positiveInteger(currentAttempt, "Metrics run attempt");
  if (!Array.isArray(jobs) || !Array.isArray(attempts)) throw new Error("Timing observations are unavailable.");
  // Skipped optional rows may contain provider timestamps inherited from a
  // prior attempt. They consumed no runner time and are intentionally outside
  // the strict physical-execution parser used for completed work.
  const observed = jobs.filter((job) => measuredJobs.has(job?.name) && job.conclusion !== "skipped");
  const names = [...new Set(observed.map((job) => job.name))];
  if (names.length === 0) throw new Error("Required-job timings are absent.");
  const normalized = normalizeEffectiveExecutions({
    candidate,
    currentAttempt,
    startAttempt: 1,
    attempts,
    jobs: observed,
    names,
    requireCurrent: false
  });
  const currentByName = new Map([...normalized.current].map(([name, execution]) => [name, execution.attempt]));
  const rows = [];
  for (const { name, attempt, job } of normalized.physical) {
    const row = { job: name, attempt,
      outcome: conclusions.has(job.conclusion) ? job.conclusion : "unavailable",
      elapsedMs: job.status === "completed" ? duration(job.started_at, job.completed_at) : null,
      setupMs: 0, artifactUploadMs: 0, snapshotRestoreMs: 0, contentPreparationAndDiscoveryMs: 0, otherStepMs: 0, missingStepTimings: 0 };
    if (!Array.isArray(job.steps)) row.missingStepTimings += 1;
    for (const step of job.steps ?? []) {
      if (step.conclusion === "skipped") continue;
      const elapsed = step.status === "completed" ? duration(step.started_at, step.completed_at) : null;
      if (elapsed === null || typeof step.name !== "string") row.missingStepTimings += 1;
      else row[category(step.name)] += elapsed;
    }
    const counts = Object.hasOwn(summaries, name) ? summaries[name] : null;
    // Counts describe the effective current execution, not a relabelled copy.
    if (attempt === currentByName.get(name) && counts && ["tests", "retries", "skips"].every((key) => Number.isSafeInteger(counts[key]) && counts[key] >= 0)) {
      row.tests = counts.tests; row.retries = counts.retries; row.skips = counts.skips;
    }
    rows.push(row);
  }
  if (rows.length === 0) throw new Error("Required-job timings are absent.");
  const current = rows.filter((row) => row.attempt === currentAttempt);
  const complete = rows.every((row) => row.elapsedMs !== null);
  const ends = normalized.physical.map(({ job }) => milliseconds(job.completed_at));
  const lastEnd = ends.length && ends.every(Number.isFinite) ? new Date(Math.max(...ends)).toISOString() : null;
  return { schemaVersion: 1, observationOnly: true, sourceSha: candidate.sourceSha, event: candidate.event,
    runId: candidate.runId, runNumber: candidate.runNumber, attempt: currentAttempt,
    elapsedFromRunCreationMs: lastEnd ? duration(runCreatedAt, lastEnd) : null,
    totalObservedRunnerMinutes: rows.reduce((sum, row) => sum + (row.elapsedMs ?? 0), 0) / 60_000,
    currentAttemptObservedRunnerMinutes: current.reduce((sum, row) => sum + (row.elapsedMs ?? 0), 0) / 60_000,
    runnerTimingComplete: complete, jobs: rows.sort((a, b) => a.attempt - b.attempt || a.job.localeCompare(b.job)) };
}

export async function reportTimings(environment = process.env) {
  try {
    const candidate = checkedCandidate(environment);
    if (!/^[1-9]\d*$/.test(environment.GITHUB_RUN_ATTEMPT ?? "")) throw new Error("Invalid metrics attempt.");
    const options = { token: environment.GH_TOKEN };
    const currentAttempt = Number(environment.GITHUB_RUN_ATTEMPT);
    const [run, jobs] = await Promise.all([readRunEvidence(candidate, options), readRunCollection(candidate.runId, "jobs", options)]);
    const attempts = await collectAttemptHistory({
      candidate,
      currentAttempt,
      startAttempt: 1,
      currentRun: run,
      readAttempt: readRunAttemptEvidence,
      options
    });
    const acceptance = environment.CI_ACCEPTANCE ? JSON.parse(environment.CI_ACCEPTANCE) : null;
    const summary = summarizeTimings({ candidate, currentAttempt, attempts, jobs,
      // The generic run record retains the original creation time across
      // consumer reruns. Attempt records describe execution windows only.
      runCreatedAt: run.created_at, summaries: acceptance?.summaries ?? {} });
    const output = JSON.stringify(summary, null, 2);
    console.log(output);
    if (environment.GITHUB_STEP_SUMMARY) await appendFile(environment.GITHUB_STEP_SUMMARY,
      `\n### CI timing observations\n\nRunner minutes include all observed validation attempts, exclude deployment and the still-running aggregate, and are elapsed usage rather than billing. Restore timing includes download, extraction and verification; content timing includes discovery. Compare identical inputs across at least three trials before changing shard count. Missing timing remains unknown.\n\n\`\`\`json\n${output}\n\`\`\`\n`);
  } catch {
    console.log("Optional CI timing observations are unavailable. Validation and deployment decisions are unchanged.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await reportTimings();
