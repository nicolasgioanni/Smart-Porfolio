// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { summarizeTimings, reportTimings } from "./metrics.mjs";
import { repository, workflowPath } from "./plan.mjs";
const sha = "a".repeat(40), ref = "refs/heads/main";
const candidate = { schemaVersion: 1, repository, event: "push", ref, workflowRef: `${repository}/${workflowPath}@${ref}`,
  workflowSha: sha, sourceSha: sha, eventSha: sha, runHeadSha: sha, branchTip: sha, pullNumber: null, baseBranch: null,
  force: false, runId: 10, runNumber: 20, producerAttempt: 1 };
const at = (second) => new Date(Date.UTC(2026, 9, 12, 0, 0, second)).toISOString();
const step = (number, name, start, end) => ({ number, name, status: "completed", conclusion: "success", started_at: at(start), completed_at: at(end) });
function job(name = "quality", patch = {}) { return { id: 1, name, run_id: 10, run_attempt: 1, status: "completed", conclusion: "success",
  started_at: at(1), completed_at: at(61), steps: [step(1, "Install locked dependencies", 1, 11), step(2, "Restore and verify the accepted content snapshot", 11, 13),
    step(9, "Upload immutable receipt", 58, 61)], ...patch }; }
function attempt(attemptNumber, second = (attemptNumber - 1) * 100) {
  return { attempt: attemptNumber, run: {
    id: candidate.runId, run_number: candidate.runNumber, event: candidate.event, head_sha: candidate.runHeadSha,
    path: workflowPath, run_attempt: attemptNumber, run_started_at: at(second), created_at: at(0)
  } };
}
function attemptsThrough(currentAttempt) {
  return Array.from({ length: currentAttempt }, (_, index) => attempt(index + 1));
}
function rerun(name, id, attemptNumber, conclusion = "success") {
  const start = (attemptNumber - 1) * 100 + 1;
  return job(name, { id, run_attempt: attemptNumber, conclusion, started_at: at(start), completed_at: at(start + 60),
    steps: [step(1, "Install locked dependencies", start, start + 10), step(2, "Restore and verify the accepted content snapshot", start + 10, start + 12),
      step(9, "Upload immutable receipt", start + 57, start + 60)] });
}
function summarize(jobs, patch = {}) {
  const currentAttempt = patch.currentAttempt ?? 1;
  return summarizeTimings({ candidate, currentAttempt, attempts: attemptsThrough(currentAttempt), jobs, runCreatedAt: at(0), ...patch });
}

describe("CI timing observations", () => {
  it("reports overlapping elapsed work and runner usage as different measures", () => {
    const value = summarize([job(), job("chromium-1-of-2", { id: 2 })]);
    expect(value.elapsedFromRunCreationMs).toBe(61_000);
    expect(value.totalObservedRunnerMinutes).toBe(2);
    expect(value.jobs[0]).toMatchObject({ setupMs: 10_000, snapshotRestoreMs: 2000, artifactUploadMs: 3000 });
    expect(value).not.toHaveProperty("accepted");
    expect(value).not.toHaveProperty("deploy");
  });
  it("counts failed older attempts in total usage and attaches browser counts only to the latest", () => {
    const value = summarize([job("chromium-1-of-2", { conclusion: "failure" }), rerun("chromium-1-of-2", 2, 2)],
      { currentAttempt: 2, summaries: { "chromium-1-of-2": { tests: 90, retries: 1, skips: 0 } } });
    expect(value.totalObservedRunnerMinutes).toBe(2);
    expect(value.currentAttemptObservedRunnerMinutes).toBe(1);
    expect(value.jobs[0]).not.toHaveProperty("tests");
    expect(value.jobs[1]).toMatchObject({ tests: 90, retries: 1, skips: 0 });
  });
  it("collapses copied rows and attaches current summaries to their physical execution", () => {
    const original = job("quality");
    const copied = { ...structuredClone(original), id: 2, run_attempt: 2 };
    const value = summarize([original, copied], {
      currentAttempt: 2,
      summaries: { quality: { tests: 45, retries: 0, skips: 0 } }
    });
    expect(value.totalObservedRunnerMinutes).toBe(1);
    expect(value.currentAttemptObservedRunnerMinutes).toBe(0);
    expect(value.jobs).toEqual([expect.objectContaining({ job: "quality", attempt: 1, tests: 45 })]);
  });
  it("rejects malformed physical timing instead of reporting zero-cost work", () => {
    expect(() => summarize([job("quality", { completed_at: null, steps: null })])).toThrow("incomplete or malformed");
  });
  it("does not expose untrusted labels, runner details, commands or deployment jobs", () => {
    const value = summarize([job("quality", { runner_name: "private", steps: [step(1, "private command", 1, 2)] }), job("deploy-production", { id: 2 })]);
    expect(value.jobs).toHaveLength(1);
    expect(JSON.stringify(value)).not.toContain("private");
    expect(value.jobs[0].otherStepMs).toBe(1000);
  });
  it("rejects cross-run, future-attempt and duplicate observations", () => {
    for (const patch of [{ run_id: 11 }, { run_attempt: 2 }]) expect(() => summarize([job("quality", patch)])).toThrow("identity");
    expect(() => summarize([job("quality", { id: 0 })])).toThrow("incomplete or malformed");
    expect(() => summarize([job(), job()])).toThrow("duplicate IDs");
    expect(() => summarize([])).toThrow("absent");
  });
  it("measures preparation plus discovery and ignores explicitly skipped steps", () => {
    const value = summarize([job("prepare-content", { steps: [step(1, "Prepare one accepted content snapshot and validated execution plan", 1, 31),
      { number: 2, name: "Upload immutable discovery", status: "completed", conclusion: "skipped", started_at: at(31), completed_at: at(31) }] })]);
    expect(value.jobs[0]).toMatchObject({ contentPreparationAndDiscoveryMs: 30_000, missingStepTimings: 0 });
  });
  it("ignores malformed skipped optional rows rather than treating them as executed work", () => {
    const skipped = { id: 2, name: "dependency-review", run_id: 10, run_attempt: 2, status: "completed", conclusion: "skipped",
      started_at: "not-a-provider-time", completed_at: "not-a-provider-time", steps: null };
    const value = summarize([job(), skipped]);
    expect(value.jobs).toHaveLength(1);
    expect(value.jobs[0].job).toBe("quality");
  });
  it("keeps unavailable observations nonblocking and emits no raw error", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => {});
    try {
      await expect(reportTimings({ CI_CANDIDATE: "private invalid input" })).resolves.toBeUndefined();
      expect(log).toHaveBeenCalledWith(expect.stringContaining("Optional CI timing observations are unavailable"));
      expect(JSON.stringify(log.mock.calls)).not.toContain("private invalid input");
    } finally { log.mockRestore(); }
  });
});
