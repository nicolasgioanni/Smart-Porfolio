import { describe, expect, it } from "vitest";
import { pullRequestPaths, selectPreflightChecks, runPreflightChecks } from "./dependencyPreflight.mjs";
import { repository } from "./plan.mjs";

const base = "a".repeat(40), head = "b".repeat(40), merge = "c".repeat(40);
const candidate = { event: "pull_request", pullNumber: 7, baseBranch: "main", sourceSha: merge, runHeadSha: head };
const environment = { GITHUB_EVENT_NAME: "pull_request" };
const event = { repository: { full_name: repository }, number: 7, pull_request: { number: 7,
  base: { sha: base, ref: "main", repo: { full_name: repository } }, head: { sha: head } } };
function runGit(root, ...args) {
  if (args[0] === "rev-list") return Buffer.from(`${merge} ${base} ${head}\n`);
  expect(args).toContain("--no-renames");
  expect(args.slice(-3)).toEqual([base, merge, "--"]);
  return Buffer.from("package-lock.json\0other.txt\0");
}

describe("dependency preflight selection", () => {
  it("selects dependency and workflow changes including removed rename names", () => {
    expect(selectPreflightChecks(pullRequestPaths({ candidate, environment, event, projectRoot: ".", runGit }))).toEqual(["npm"]);
    for (const name of ["package.json", ".github/workflows/ci.yml", "infra/states/x/main.tf", "scripts/security/tools.json"]) expect(selectPreflightChecks([name])).not.toEqual([]);
    expect(selectPreflightChecks(["src/page.tsx", "package.json.bak"])).toEqual([]);
  });
  it("selects only affected ecosystems and gives children a positive environment allowlist", () => {
    expect(selectPreflightChecks(["package-lock.json"])).toEqual(["npm"]);
    expect(selectPreflightChecks([".github/workflows/ci.yml", "scripts/circleci/workflow.test.mjs"])).toEqual(["workflow"]);
    expect(selectPreflightChecks(["infra/states/x/main.tf"])).toEqual(["infrastructure"]);
    const calls = [];
    runPreflightChecks(["npm"], { projectRoot: ".", environment: { PATH: "/bin", GITHUB_OUTPUT: "private", GITHUB_ENV: "private", CUSTOM_SECRET: "secret" }, execute: (binary, args, options) => {
      calls.push({ args, options }); return Buffer.from(JSON.stringify({ numPassedTests: 3, numFailedTests: 0, testResults: [{ assertionResults: [
        "package and CI deployment automation pins local Wrangler and writes content-version metadata after both build modes",
        "scoped dependency compatibility preserves the minimatch API used by typescript-estree's project service",
        "workbook dependency boundary pins ExcelJS directly and includes no Google API, OAuth, Drive, or Sheets clients"
      ].map((fullName) => ({ fullName, status: "passed" })) }] }));
    } });
    expect(calls).toHaveLength(2);
    expect(calls[1].args).toContain("workbook dependency boundary");
    expect(calls[0].options.env).toEqual({ PATH: "/bin" });
  });
  it("requires the Dependabot contract and avoids repeating shared tests", () => {
    const names = [
      "package and CI deployment automation pins local Wrangler and writes content-version metadata after both build modes",
      "scoped dependency compatibility preserves the minimatch API used by typescript-estree's project service",
      "package and CI deployment automation pins every action and confines write authority to its required boundary",
      "workbook dependency boundary pins ExcelJS directly and includes no Google API, OAuth, Drive, or Sheets clients",
      "skeleton visual baseline capture workflow pins its complete action allowlist and executes only the expected steps",
      "CircleCI evidence workflow runs trusted default-branch code with inputs and secret only in the verifier step",
      "dependency update configuration schedules weekly reviews for npm, actions, and every Terraform state root"
    ];
    const report = (entries) => Buffer.from(JSON.stringify({ numPassedTests: entries.length, numFailedTests: 0, testResults: [{ assertionResults: entries.map((fullName) => ({ fullName, status: "passed" })) }] }));
    const calls = [];
    runPreflightChecks(["npm", "workflow"], { projectRoot: ".", environment: {}, execute: (binary, args) => { calls.push(args); return report(names); } });
    expect(calls.filter((args) => args.includes("scripts/packageScripts.test.mjs"))).toHaveLength(1);
    expect(() => runPreflightChecks(["workflow"], { projectRoot: ".", environment: {}, execute: () => report(names.slice(0, -1)) })).toThrow(/workflow checks failed/);
  });
  it("fails closed when selected pin, workflow, or infrastructure checks fail or run no tests", () => {
    for (const check of ["npm", "workflow", "infrastructure"]) {
      expect(() => runPreflightChecks([check], { projectRoot: ".", environment: {}, execute: () => { throw new Error("untrusted output"); } })).toThrow(`Dependency preflight ${check} checks failed.`);
    }
    expect(() => runPreflightChecks(["npm"], { projectRoot: ".", environment: {}, execute: () => Buffer.from('{"numPassedTests":0,"numFailedTests":0}') })).toThrow(/npm checks failed/);
  });
  it("fails closed on mismatched merge parents or malformed diff", () => {
    expect(() => pullRequestPaths({ candidate, environment, event, projectRoot: ".", runGit: () => Buffer.from(`${merge} ${head}\n`) })).toThrow(/complete pull request diff/);
    expect(() => pullRequestPaths({ candidate, environment, event, projectRoot: ".", runGit: (root, ...args) => args[0] === "rev-list" ? Buffer.from(`${merge} ${base} ${head}\n`) : Buffer.from("truncated") })).toThrow(/complete pull request diff/);
  });
});
