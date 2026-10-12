// @vitest-environment node
import { describe, expect, it } from "vitest";
import { assertCiGate, evaluateCiGate, requiredJobsForEvent } from "./ciGate.mjs";

const successful = (jobs) => Object.fromEntries(jobs.map((job) => [job, { result: "success" }]));

describe("stable CI gate", () => {
  it("requires the event-specific blocking jobs and accepts only explicit success", () => {
    const prJobs = requiredJobsForEvent("pull_request");
    const scheduleJobs = requiredJobsForEvent("schedule");
    expect(prJobs).toContain("dependency-review");
    expect(prJobs).toContain("security-scans");
    expect(scheduleJobs).toContain("application-validation");
    expect(scheduleJobs).not.toContain("dependency-review");
    expect(evaluateCiGate({ eventName: "pull_request", results: successful(prJobs) })).toMatchObject({ accepted: true });
    expect(evaluateCiGate({ eventName: "schedule", results: successful(scheduleJobs) })).toMatchObject({ accepted: true });
  });

  it("fails closed for failed, skipped, cancelled, and missing required jobs", () => {
    const jobs = requiredJobsForEvent("pull_request");
    for (const outcome of ["failure", "skipped", "cancelled", "missing"]) {
      const results = successful(jobs);
      if (outcome === "missing") delete results["security-scans"];
      else results["security-scans"] = { result: outcome };
      expect(() => assertCiGate({ eventName: "pull_request", results })).toThrow(`security-scans=${outcome}`);
    }
  });

  it("does not treat an unneeded skipped job as a substitute for a required one", () => {
    const jobs = requiredJobsForEvent("push");
    const results = { ...successful(jobs), "dependency-review": { result: "skipped" } };
    expect(assertCiGate({ eventName: "push", results }).accepted).toBe(true);
    results["application-validation"] = { result: "skipped" };
    expect(() => assertCiGate({ eventName: "push", results })).toThrow("application-validation=skipped");
  });

  it("rejects an event that the workflow does not declare", () => {
    expect(() => requiredJobsForEvent("repository_dispatch")).toThrow("not declared");
  });
});
