// @vitest-environment node
import { readFile } from "node:fs/promises";
import path from "node:path";
import { load } from "js-yaml";
import { beforeAll, describe, expect, it } from "vitest";
import { evaluateCiGate, requiredJobsForEvent } from "./ciGate.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const workflowPath = path.join(projectRoot, ".github", "workflows", "ci.yml");
const permittedDeployTerms = new Map([
  ["!cancelled()", ({ cancelled }) => !cancelled],
  ["github.event_name != 'pull_request'", ({ eventName }) => eventName !== "pull_request"],
  ["needs.verify.result == 'success'", ({ verifyResult }) => verifyResult === "success"],
  ["needs.verify.outputs.should_deploy == 'true'", ({ shouldDeploy }) => shouldDeploy === "true"]
]);

function successfulResults(eventName) {
  return Object.fromEntries(
    requiredJobsForEvent(eventName).map((job) => [job, { result: "success" }])
  );
}

function deployGuardTerms(expression) {
  if (typeof expression !== "string") throw new Error("Deploy job must have a string eligibility expression.");
  const match = expression.trim().match(/^\$\{\{\s*(.*?)\s*\}\}$/s);
  if (!match) throw new Error("Deploy eligibility must be an explicit GitHub Actions expression.");

  const terms = match[1].split(/\s*&&\s*/).map((term) => term.trim());
  const unknownTerms = terms.filter((term) => !permittedDeployTerms.has(term));
  if (unknownTerms.length > 0 || new Set(terms).size !== permittedDeployTerms.size || terms.length !== permittedDeployTerms.size) {
    throw new Error("Deploy eligibility must contain each permitted guard exactly once.");
  }
  return terms;
}

function parsedDeployTerms(source) {
  const workflow = load(source);
  expect(workflow?.jobs?.deploy?.needs).toBe("verify");
  return deployGuardTerms(workflow?.jobs?.deploy?.if);
}

function deploymentDecision(terms, { eventName, results, cancelled = false, shouldDeploy = "true" }) {
  const gate = evaluateCiGate({ eventName, results });
  const verifyResult = gate.accepted ? "success" : "failure";
  return {
    gate,
    verifyResult,
    deploys: terms.every((term) => permittedDeployTerms.get(term)({
      cancelled,
      eventName,
      shouldDeploy,
      verifyResult
    }))
  };
}

let workflowSource;
let terms;

beforeAll(async () => {
  workflowSource = await readFile(workflowPath, "utf8");
  terms = parsedDeployTerms(workflowSource);
});

describe("deploy workflow eligibility", () => {
  it("uses each explicit non-cancelled aggregate-success guard instead of implicit success propagation", () => {
    expect(new Set(terms)).toEqual(new Set(permittedDeployTerms.keys()));
  });

  it("rejects weakened or substituted eligibility expressions in parsed workflow fixtures", () => {
    const expression = (value) => `\${{ ${value} }}`;
    const rejected = [
      "github.event_name != 'pull_request' && needs.verify.result == 'success' && needs.verify.outputs.should_deploy == 'true'",
      "always() && github.event_name != 'pull_request' && needs.verify.result == 'success' && needs.verify.outputs.should_deploy == 'true'",
      "!cancelled() && github.event_name != 'pull_request' && needs.verify.outputs.should_deploy == 'true'",
      "!cancelled() && needs.verify.result == 'success' && needs.verify.outputs.should_deploy == 'true'",
      "!cancelled() && github.event_name != 'pull_request' && needs.verify.result == 'success'"
    ];

    for (const guard of rejected) {
      const fixture = workflowSource.replace(terms.join(" && "), guard);
      expect(() => parsedDeployTerms(fixture)).toThrow("permitted guard");
    }
    expect(() => deployGuardTerms(expression("!cancelled() || needs.verify.result == 'success'"))).toThrow("permitted guard");
  });

  it("allows a green push aggregate when its PR-only dependency review is skipped", () => {
    const results = {
      ...successfulResults("push"),
      "dependency-review": { result: "skipped" }
    };
    const decision = deploymentDecision(terms, { eventName: "push", results });

    expect(decision.gate).toMatchObject({ accepted: true });
    expect(decision.verifyResult).toBe("success");
    expect(decision.deploys).toBe(true);
  });

  it("blocks required failures, cancellations, missing jobs, and unexpected skips", () => {
    for (const outcome of ["failure", "cancelled", "missing", "skipped"]) {
      const results = successfulResults("push");
      if (outcome === "missing") delete results.codeql;
      else results.codeql = { result: outcome };
      const decision = deploymentDecision(terms, { eventName: "push", results });

      expect(decision.gate).toMatchObject({ accepted: false });
      expect(decision.verifyResult).toBe("failure");
      expect(decision.deploys).toBe(false);
    }
  });

  it("blocks workflow cancellation, pull requests, stale candidates, and exact no-ops", () => {
    const pushResults = successfulResults("push");
    const prResults = successfulResults("pull_request");
    const cases = [
      { name: "workflow cancellation", eventName: "push", results: pushResults, cancelled: true },
      { name: "pull request with a false deploy decision", eventName: "pull_request", results: prResults, shouldDeploy: "false" },
      { name: "pull request with an erroneous deploy decision", eventName: "pull_request", results: prResults, shouldDeploy: "true" },
      { name: "stale candidate", eventName: "push", results: pushResults, shouldDeploy: "false" },
      { name: "exact no-op", eventName: "schedule", results: successfulResults("schedule"), shouldDeploy: "false" }
    ];

    for (const scenario of cases) {
      expect(deploymentDecision(terms, scenario).deploys, scenario.name).toBe(false);
    }
  });
});
