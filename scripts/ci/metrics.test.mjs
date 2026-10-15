// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { summarizeTimings, reportTimings } from "./metrics.mjs";
import { repository, workflowPath } from "./plan.mjs";
const sha = "a".repeat(40), ref = "refs/heads/main";
const candidate = { schemaVersion: 1, repository, event: "push", ref, workflowRef: `${repository}/${workflowPath}@${ref}`,
  workflowSha: sha, sourceSha: sha, eventSha: sha, runHeadSha: sha, branchTip: sha, pullNumber: null, baseBranch: null,
  force: false, runId: 10, runNumber: 20, producerAttempt: 1 };
const at = (second) => new Date(Date.UTC(2026, 9, 12, 0, 0, second)).toISOString();
const step = (name, start, end) => ({ name, status: "completed", conclusion: "success", started_at: at(start), completed_at: at(end) });
function job(name = "quality", patch = {}) { return { id: 1, name, run_id: 10, run_attempt: 1, status: "completed", conclusion: "success",
  started_at: at(1), completed_at: at(61), steps: [step("Install locked dependencies", 1, 11), step("Restore and verify the accepted content snapshot", 11, 13),
    step("Upload immutable receipt", 58, 61)], ...patch }; }
function summarize(jobs, patch = {}) { return summarizeTimings({ candidate, currentAttempt: 1, jobs, runCreatedAt: at(0), ...patch }); }

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
    const value = summarize([job("chromium-1-of-2", { conclusion: "failure" }), job("chromium-1-of-2", { id: 2, run_attempt: 2 })],
      { currentAttempt: 2, summaries: { "chromium-1-of-2": { tests: 90, retries: 1, skips: 0 } } });
    expect(value.totalObservedRunnerMinutes).toBe(2);
    expect(value.currentAttemptObservedRunnerMinutes).toBe(1);
    expect(value.jobs[0]).not.toHaveProperty("tests");
    expect(value.jobs[1]).toMatchObject({ tests: 90, retries: 1, skips: 0 });
  });
  it("keeps missing timing unknown and never reports it as complete zero-cost work", () => {
    const value = summarize([job("quality", { completed_at: null, steps: null })]);
    expect(value.runnerTimingComplete).toBe(false);
    expect(value.jobs[0].elapsedMs).toBeNull();
    expect(value.jobs[0].missingStepTimings).toBe(1);
    expect(value.elapsedFromRunCreationMs).toBeNull();
  });
  it("does not expose untrusted labels, runner details, commands or deployment jobs", () => {
    const value = summarize([job("quality", { runner_name: "private", steps: [step("private command", 1, 2)] }), job("deploy-production", { id: 2 })]);
    expect(value.jobs).toHaveLength(1);
    expect(JSON.stringify(value)).not.toContain("private");
    expect(value.jobs[0].otherStepMs).toBe(1000);
  });
  it("rejects cross-run, future-attempt and duplicate observations", () => {
    for (const patch of [{ run_id: 11 }, { run_attempt: 2 }, { id: 0 }]) expect(() => summarize([job("quality", patch)])).toThrow("identity");
    expect(() => summarize([job(), job()])).toThrow("identity");
    expect(() => summarize([])).toThrow("absent");
  });
  it("measures preparation plus discovery and ignores explicitly skipped steps", () => {
    const value = summarize([job("prepare-content", { steps: [step("Prepare one accepted content snapshot and validated execution plan", 1, 31),
      { name: "Upload immutable discovery", conclusion: "skipped" }] })]);
    expect(value.jobs[0]).toMatchObject({ contentPreparationAndDiscoveryMs: 30_000, missingStepTimings: 0 });
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
