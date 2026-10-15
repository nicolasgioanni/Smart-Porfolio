// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { collectAttemptHistory, maximumAttemptHistory, normalizeEffectiveExecutions } from "./effectiveExecution.mjs";
import { repository, workflowPath } from "./plan.mjs";

const sha = "a".repeat(40);
const candidate = {
  schemaVersion: 1,
  repository,
  event: "push",
  ref: "refs/heads/main",
  workflowRef: `${repository}/${workflowPath}@refs/heads/main`,
  workflowSha: sha,
  sourceSha: sha,
  eventSha: sha,
  runHeadSha: sha,
  branchTip: sha,
  pullNumber: null,
  baseBranch: null,
  force: false,
  runId: 741,
  runNumber: 18,
  producerAttempt: 1
};

function at(second) {
  return new Date(Date.UTC(2026, 9, 15, 0, 0, second)).toISOString().replace(".000", "");
}

function run(attempt, second) {
  return {
    id: candidate.runId,
    run_number: candidate.runNumber,
    event: candidate.event,
    head_sha: candidate.runHeadSha,
    path: workflowPath,
    run_attempt: attempt,
    run_started_at: at(second)
  };
}

let nextId = 1;
function job(name, attempt, start, end, { conclusion = "success", step = "Validate" } = {}) {
  return {
    id: nextId++,
    name,
    run_id: candidate.runId,
    run_attempt: attempt,
    status: "completed",
    conclusion,
    started_at: at(start),
    completed_at: at(end),
    steps: [{ number: 1, name: step, status: "completed", conclusion, started_at: at(start), completed_at: at(end) }]
  };
}

function copied(value, attempt) {
  return { ...structuredClone(value), id: nextId++, run_attempt: attempt };
}

function normalize({ currentAttempt, attempts, jobs, names, startAttempt = 1 }) {
  return normalizeEffectiveExecutions({ candidate, currentAttempt, startAttempt, attempts, jobs, names });
}

describe("effective GitHub Actions executions", () => {
  it("maps copied dependencies and independently rerun shards to their physical attempts", () => {
    const quality = job("quality", 3, 301, 309);
    const chromiumOne = job("chromium-1-of-2", 3, 310, 320);
    const chromiumTwo = job("chromium-2-of-2", 3, 321, 330);
    const rerunShard = job("chromium-1-of-2", 4, 401, 412);
    const normalized = normalize({
      currentAttempt: 4,
      attempts: [{ attempt: 3, run: run(3, 300) }, { attempt: 4, run: run(4, 400) }],
      jobs: [quality, chromiumOne, chromiumTwo, rerunShard, copied(quality, 4), copied(chromiumTwo, 4)],
      names: ["quality", "chromium-1-of-2", "chromium-2-of-2"],
      startAttempt: 3
    });

    expect(normalized.current.get("quality").attempt).toBe(3);
    expect(normalized.current.get("chromium-1-of-2").attempt).toBe(4);
    expect(normalized.current.get("chromium-2-of-2").attempt).toBe(3);
    expect(normalized.physical.map(({ name, attempt }) => [name, attempt])).toEqual([
      ["chromium-1-of-2", 3],
      ["chromium-2-of-2", 3],
      ["quality", 3],
      ["chromium-1-of-2", 4]
    ]);
  });

  it("collapses repeated copied records to the unique original physical execution", () => {
    const quality = job("quality", 3, 301, 309);
    const normalized = normalize({
      currentAttempt: 5,
      attempts: [3, 4, 5].map((attempt) => ({ attempt, run: run(attempt, attempt * 100) })),
      jobs: [quality, copied(quality, 4), copied(quality, 5)],
      names: ["quality"],
      startAttempt: 3
    });

    expect(normalized.current.get("quality")).toMatchObject({ attempt: 3, copied: true });
    expect(normalized.physical).toHaveLength(1);
  });

  it("preserves ordered provider step numbers even when post-action steps leave gaps", () => {
    const quality = job("quality", 1, 101, 109);
    quality.steps.push({
      number: 9,
      name: "Post Validate",
      status: "completed",
      conclusion: "success",
      started_at: at(109),
      completed_at: at(109)
    });
    const normalized = normalize({
      currentAttempt: 2,
      attempts: [{ attempt: 1, run: run(1, 100) }, { attempt: 2, run: run(2, 200) }],
      jobs: [quality, copied(quality, 2)],
      names: ["quality"]
    });

    expect(normalized.current.get("quality").attempt).toBe(1);
  });

  it("admits a skipped no-op step without provider timestamps while preserving its exact copy fingerprint", () => {
    const quality = job("quality", 1, 101, 109);
    quality.steps.push({ number: 9, name: "Upload optional receipt", status: "completed", conclusion: "skipped",
      started_at: null, completed_at: null });
    const normalized = normalize({
      currentAttempt: 2,
      attempts: [{ attempt: 1, run: run(1, 100) }, { attempt: 2, run: run(2, 200) }],
      jobs: [quality, copied(quality, 2)],
      names: ["quality"]
    });
    expect(normalized.current.get("quality").attempt).toBe(1);

    const changedNullability = copied(quality, 2);
    delete changedNullability.steps[1].started_at;
    delete changedNullability.steps[1].completed_at;
    expect(() => normalize({
      currentAttempt: 2,
      attempts: [{ attempt: 1, run: run(1, 100) }, { attempt: 2, run: run(2, 200) }],
      jobs: [quality, changedNullability],
      names: ["quality"]
    })).toThrow("unique physical origin");
  });

  it("rejects a copied earlier green execution when a newer physical failure exists", () => {
    const green = job("quality", 1, 101, 109);
    const failed = job("quality", 2, 201, 209, { conclusion: "failure" });
    expect(() => normalize({
      currentAttempt: 3,
      attempts: [1, 2, 3].map((attempt) => ({ attempt, run: run(attempt, attempt * 100) })),
      jobs: [green, failed, copied(green, 3)],
      names: ["quality"]
    })).toThrow("latest physical");
  });

  it("rejects altered copies, malformed calendars, step ordering, window escapes, duplicate names, and missing origins", () => {
    const attempts = [{ attempt: 1, run: run(1, 100) }, { attempt: 2, run: run(2, 200) }];
    const physicalCurrent = () => job("quality", 2, 201, 209);

    const original = job("quality", 1, 101, 109);
    const alteredCopy = copied(original, 2);
    alteredCopy.steps[0] = { ...alteredCopy.steps[0], name: "Changed" };
    expect(() => normalize({ currentAttempt: 2, attempts, jobs: [original, alteredCopy], names: ["quality"] }))
      .toThrow("unique physical origin");

    const invalidCalendar = job("quality", 1, 101, 109);
    invalidCalendar.started_at = "2026-02-30T00:00:01Z";
    expect(() => normalize({ currentAttempt: 2, attempts, jobs: [invalidCalendar, physicalCurrent()], names: ["quality"] }))
      .toThrow("start is missing or malformed");

    const unorderedSteps = job("quality", 1, 101, 109);
    unorderedSteps.steps.push({ ...unorderedSteps.steps[0], number: 1, name: "Repeated number" });
    expect(() => normalize({ currentAttempt: 2, attempts, jobs: [unorderedSteps, physicalCurrent()], names: ["quality"] }))
      .toThrow("step evidence is malformed");

    const escapedWindow = job("quality", 1, 201, 209);
    expect(() => normalize({ currentAttempt: 2, attempts, jobs: [escapedWindow, physicalCurrent()], names: ["quality"] }))
      .toThrow("outside its attempt window");

    const duplicate = copied(original, 2);
    expect(() => normalize({ currentAttempt: 2, attempts, jobs: [original, duplicate, { ...duplicate, id: original.id }], names: ["quality"] }))
      .toThrow("duplicate IDs");
    expect(() => normalize({ currentAttempt: 2, attempts, jobs: [copied(original, 2)], names: ["quality"] }))
      .toThrow("unique physical origin");
  });

  it("uses no historical read for the first physical attempt and bounds later histories", async () => {
    const reader = vi.fn();
    await expect(collectAttemptHistory({
      candidate,
      currentAttempt: 1,
      startAttempt: 1,
      currentRun: run(1, 100),
      readAttempt: reader,
      options: {}
    })).resolves.toEqual([{ attempt: 1, run: run(1, 100) }]);
    expect(reader).not.toHaveBeenCalled();

    await expect(collectAttemptHistory({
      candidate,
      currentAttempt: maximumAttemptHistory + 1,
      startAttempt: 1,
      currentRun: run(maximumAttemptHistory + 1, 2_100),
      readAttempt: reader,
      options: {}
    })).rejects.toThrow("full affected rerun");
    expect(reader).not.toHaveBeenCalled();
  });
});
