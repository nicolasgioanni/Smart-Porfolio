import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { applicationJobs, securityJobs } from "./plan.mjs";
import { gateDependencies, validateWorkflowGraph, workflowEvents } from "./workflowGraph.mjs";
import { validateWorkflowYaml } from "./workflowYaml.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const workflowPath = path.join(projectRoot, ".github", "workflows", "ci.yml");
const deployEligibility = "${{ !cancelled() && github.event_name != 'pull_request' && needs.verify.result == 'success' && needs.verify.outputs.deploy == 'true' }}";

function workflow() {
  return { name: "CI", on: { push: {}, pull_request: {}, schedule: [], workflow_dispatch: {} }, jobs: {
    "resolve-candidate": {}, "prepare-content": { needs: "resolve-candidate" },
    ...Object.fromEntries([...securityJobs, "dependency-review"].map((name) => [name, { needs: "resolve-candidate" }])),
    ...Object.fromEntries(applicationJobs.map((name) => [name, { needs: ["resolve-candidate", "prepare-content", ...(name === "export-check" ? ["build-and-package"] : [])] }])),
    "browser-e2e": { needs: ["resolve-candidate", "prepare-content"], strategy: { matrix: { shard: ["1/2", "2/2"] }, "fail-fast": false } },
    verify: { name: "verify", needs: [...gateDependencies], if: "always()" },
    deploy: { needs: ["verify", "prepare-content", "build-and-package"], if: deployEligibility, concurrency: { group: "deployment-target", "cancel-in-progress": false } },
    heartbeat: {}
  } };
}

describe("CI graph responsibilities", () => {
  it("permits arbitrary job and step ordering while retaining acceptance edges", () => {
    const value = workflow(); value.jobs = Object.fromEntries(Object.entries(value.jobs).reverse());
    expect(validateWorkflowGraph(value)).toBe(true);
  });
  it("detects every omitted required dependency and every disconnected new job", () => {
    for (const job of gateDependencies) {
      const value = workflow(); value.jobs.verify.needs = value.jobs.verify.needs.filter((name) => name !== job);
      expect(() => validateWorkflowGraph(value)).toThrow("directly depend");
    }
    const added = workflow(); added.jobs["forgotten-validator"] = {};
    expect(() => validateWorkflowGraph(added)).toThrow("registered");
  });
  it("rejects missing shards and short-circuited evidence", () => {
    for (const patch of [{ matrix: { shard: ["1/2"] }, "fail-fast": false }, { matrix: { shard: ["1/2", "2/2"] }, "fail-fast": true }]) {
      const value = workflow(); value.jobs["browser-e2e"].strategy = patch;
      expect(() => validateWorkflowGraph(value)).toThrow("both native shards");
    }
    const value = workflow(); value.jobs.verify.if = "success()";
    expect(() => validateWorkflowGraph(value)).toThrow("lightweight");
  });
  it("keeps source security and maintenance independent and build/export ordered", () => {
    for (const change of [
      (value) => value.jobs.codeql.needs.push("quality"),
      (value) => { value.jobs.heartbeat.needs = "verify"; },
      (value) => { value.jobs["export-check"].needs = ["resolve-candidate", "prepare-content"]; },
      (value) => { value.jobs["build-and-package"].needs.push("unit-integration"); }
    ]) {
      const value = workflow(); value.jobs.codeql.needs = ["resolve-candidate"]; change(value);
      expect(() => validateWorkflowGraph(value)).toThrow();
    }
  });
  it("rejects deployment cancellation, bypass paths and broad privilege", () => {
    for (const change of [
      (value) => { value.jobs.deploy.needs = ["build-and-package"]; },
      (value) => { value.jobs.deploy.concurrency["cancel-in-progress"] = true; },
      (value) => { value.concurrency = { "cancel-in-progress": true }; },
      (value) => { value.concurrency = { "cancel-in-progress": "${{ true }}" }; },
      (value) => { value.on.workflow_run = {}; },
      (value) => { value.jobs.quality["continue-on-error"] = true; },
      (value) => { value.jobs.quality.environment = "production"; },
      (value) => { value.jobs.quality.secrets = "inherit"; }
    ]) {
      const value = workflow(); change(value); expect(() => validateWorkflowGraph(value)).toThrow();
    }
  });
  it("requires every parsed deployment eligibility guard and rejects status bypasses", async () => {
    const source = await readFile(workflowPath, "utf8");
    expect(validateWorkflowYaml(source).jobs.deploy.if).toBe(deployEligibility);

    const cases = [
      [deployEligibility.replace("!cancelled() && ", ""), "block cancellation"],
      [deployEligibility.replace("github.event_name != 'pull_request' && ", ""), "exclude pull requests"],
      [deployEligibility.replace("needs.verify.result == 'success' && ", ""), "explicit verify success"],
      [deployEligibility.replace(" && needs.verify.outputs.deploy == 'true'", ""), "exact deploy output"],
      [deployEligibility.replace("!cancelled() && ", "always() && "), "must not use always"],
      [deployEligibility.replace(" && ", " || "), "must not use an OR bypass"]
    ];
    for (const [guard, message] of cases) {
      expect(() => validateWorkflowYaml(source.replace(deployEligibility, guard))).toThrow(message);
    }
  });
  it("admits only reviewed events across every YAML on representation", () => {
    expect(workflowEvents("push")).toEqual(["push"]);
    expect(workflowEvents(["push", "pull_request"])).toEqual(["push", "pull_request"]);
    for (const on of ["pull_request_target", ["push", "pull_request_target"], { push: null, pull_request_target: null }, { workflow_run: null }]) {
      expect(() => validateWorkflowGraph({ ...workflow(), on })).toThrow("Unreviewed event");
    }
    for (const on of [null, [], ["push", "push"], [null]]) expect(() => workflowEvents(on)).toThrow("malformed");
    expect(() => validateWorkflowGraph({ ...workflow(), on: { push: null } })).toThrow("Every reviewed event");
  });
});
