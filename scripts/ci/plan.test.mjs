import { describe, expect, it } from "vitest";
import { applicationJobs, createPlan, evaluateResults, parseBoolean, parseCandidate, parsePlan, repository, requiredJobs, workflowPath } from "./plan.mjs";

const sha = "a".repeat(40);
const snapshotDigest = "c".repeat(64);
function candidate(event = "push", branch = "main", overrides = {}) {
  const ref = event === "pull_request" ? "refs/pull/123/merge" : `refs/heads/${branch}`;
  return { schemaVersion: 1, repository, event, ref, workflowRef: `${repository}/${workflowPath}@${ref}`,
    workflowSha: sha, sourceSha: sha, eventSha: sha, runHeadSha: sha, branchTip: event === "pull_request" ? null : sha,
    pullNumber: event === "pull_request" ? 123 : null, baseBranch: event === "pull_request" ? branch : null,
    force: false, runId: 12345, runNumber: 350, producerAttempt: 1, ...overrides };
}
function results(plan) {
  const all = [...new Set([...requiredJobs(plan.candidate, "full"), "dependency-review"])];
  return Object.fromEntries(all.map((job) => [job, { result: plan.requiredJobs.includes(job) ? "success" : "skipped" }]));
}

describe("CI event and result contract", () => {
  it.each(["main", "develop"])("keeps %s PRs full and credential-free", (branch) => {
    const plan = createPlan(candidate("pull_request", branch), { snapshotDigest });
    expect(plan).toMatchObject({ target: "local", sourceMode: "templates", tier: "full", deploy: false });
    expect(plan.requiredJobs).toContain("dependency-review");
    expect(plan.chromiumShards).toEqual(["1/2", "2/2"]);
    expect(evaluateResults(plan, results(plan))).toMatchObject({ accepted: true, deploy: false });
  });

  it.each([["main", "production"], ["develop", "preview"]])("checks fresh %s pushes before %s deployment", (branch, target) => {
    const plan = createPlan(candidate("push", branch), { snapshotDigest });
    expect(plan).toMatchObject({ target, sourceMode: "remote", tier: "full", deploy: true });
    expect(evaluateResults(plan, results(plan))).toMatchObject({ accepted: true, deploy: true });
  });

  it.each(["schedule", "workflow_dispatch"])("optimizes only a proven equivalent %s candidate", (event) => {
    const input = candidate(event);
    const unchanged = createPlan(input, { snapshotDigest, comparison: { schemaVersion: 1, equivalent: true, identityDigest: snapshotDigest } });
    expect(unchanged).toMatchObject({ mode: "unchanged", tier: "none", deploy: false });
    expect(unchanged.requiredJobs).toContain("security-scans");
    expect(evaluateResults(unchanged, results(unchanged))).toMatchObject({ accepted: true, deploy: false });
    expect(createPlan(input, { snapshotDigest, comparison: { schemaVersion: 1, equivalent: false, identityDigest: null } }).deploy).toBe(true);
    for (const comparison of [null, {}, { schemaVersion: 1, equivalent: true, identityDigest: null }]) {
      expect(() => createPlan(input, { snapshotDigest, comparison })).toThrow();
    }
  });

  it("force bypasses only the content comparison", () => {
    const plan = createPlan(candidate("workflow_dispatch", "main", { force: true }), { snapshotDigest });
    expect(plan.mode).toBe("full");
    expect(plan.requiredJobs).toEqual(requiredJobs(plan.candidate, "full"));
    expect(() => createPlan(plan.candidate, { snapshotDigest, comparison: { schemaVersion: 1, equivalent: true, identityDigest: snapshotDigest } })).toThrow();
  });

  it.each(["push", "schedule", "workflow_dispatch"])("makes an obsolete %s candidate explicitly non-deployable", (event) => {
    const plan = createPlan(candidate(event, "main", { branchTip: "b".repeat(40) }));
    expect(plan).toMatchObject({ mode: "obsolete", snapshotDigest: null, deploy: false, tier: "none" });
    expect(evaluateResults(plan, results(plan))).toMatchObject({ accepted: true, deploy: false });
    expect(() => createPlan(plan.candidate, { snapshotDigest })).toThrow();
  });

  it("rejects untrusted workflow refs, source revisions and contradictory flags", () => {
    const bad = [
      candidate("workflow_run"), candidate("merge_group"), candidate("push", "feature"),
      candidate("workflow_dispatch", "develop"), candidate("schedule", "develop"),
      candidate("push", "main", { workflowRef: `${repository}/${workflowPath}@refs/heads/feature` }),
      candidate("push", "main", { sourceSha: "b".repeat(40) }),
      candidate("workflow_dispatch", "main", { workflowSha: "b".repeat(40) }),
      candidate("pull_request", "main", { sourceSha: "b".repeat(40) }),
      candidate("pull_request", "feature"), candidate("pull_request", "main", { force: true }),
      candidate("schedule", "main", { force: true }), candidate("push", "main", { force: "false" }),
      candidate("push", "main", { runNumber: 0 }), candidate("push", "main", { extra: true })
    ];
    for (const value of bad) expect(() => parseCandidate(value)).toThrow();
    for (const flag of [undefined, null, "", "1", "yes", true, false]) expect(() => parseBoolean(flag, "force")).toThrow();
    expect(parseBoolean("false", "force")).toBe(false);
  });

  it("rejects missing preparation and contradictory plan metadata", () => {
    expect(() => createPlan(candidate())).toThrow();
    const plan = createPlan(candidate(), { snapshotDigest });
    for (const patch of [{ tier: "priority" }, { target: "preview" }, { deploy: "true" }, { requiredJobs: [] }, { chromiumShards: ["1/2"] }, { mode: "unchanged" }]) {
      expect(() => parsePlan({ ...plan, ...patch })).toThrow();
    }
  });

  it("blocks every failed, cancelled, skipped or missing required job", () => {
    const plan = createPlan(candidate("pull_request"), { snapshotDigest });
    for (const job of plan.requiredJobs) {
      for (const result of ["failure", "cancelled", "skipped", "unknown", undefined]) {
        const outcome = results(plan); outcome[job] = { result };
        expect(evaluateResults(plan, outcome).accepted, `${job}=${result}`).toBe(false);
      }
      const missing = results(plan); delete missing[job];
      expect(() => evaluateResults(plan, missing)).toThrow("dependencies");
    }
    expect(() => evaluateResults(plan, { ...results(plan), "new-disconnected-validator": { result: "success" } })).toThrow("dependencies");
  });

  it("never accepts an unexpected application result on a no-op", () => {
    const plan = createPlan(candidate("push", "main", { branchTip: "b".repeat(40) }));
    for (const job of applicationJobs) {
      const outcome = results(plan); outcome[job] = { result: "success" };
      expect(evaluateResults(plan, outcome).accepted).toBe(false);
    }
  });
});
