import { execFileSync } from "node:child_process";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { checkedCandidate } from "./context.mjs";
import { repository } from "./plan.mjs";

const sha = /^[a-f0-9]{40}$/;
const git = (root, ...args) => execFileSync("git", args, { cwd: root, timeout: 30_000, maxBuffer: 8 * 1024 * 1024, stdio: ["ignore", "pipe", "ignore"] });
const decode = (bytes) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
const fail = () => { throw new Error("Dependency preflight could not establish the complete pull request diff."); };

export function selectPreflightChecks(paths) {
  const checks = [];
  if (paths.some((name) => /^(?:package(?:-lock)?\.json|\.npmrc|\.nvmrc|scripts\/(?:packageScripts|dependencyCompatibility)\.test\.mjs|scripts\/portfolioContentGeneration\.test\.ts)$/.test(name))) checks.push("npm");
  if (paths.some((name) => /^(?:\.github\/workflows\/|\.github\/dependabot\.ya?ml$|scripts\/security\/|scripts\/skeletonBaselineWorkflow\.test\.mjs$|scripts\/circleci\/workflow\.test\.mjs$)/.test(name))) checks.push("workflow");
  if (paths.some((name) => name.startsWith("infra/"))) checks.push("infrastructure");
  return checks;
}

export function runPreflightChecks(checks, { environment, projectRoot, execute = execFileSync }) {
  const cleanEnv = Object.fromEntries(["PATH", "HOME", "TMPDIR", "LANG", "CI"].filter((key) => environment[key] !== undefined).map((key) => [key, environment[key]]));
  const options = { cwd: projectRoot, env: cleanEnv, stdio: ["ignore", "pipe", "pipe"], timeout: 120_000, maxBuffer: 8 * 1024 * 1024 };
  const vitest = (files, pattern, requiredNames) => {
    const args = ["node_modules/vitest/vitest.mjs", "run", ...files, ...(pattern ? ["-t", pattern] : []), "--reporter=json"];
    const report = JSON.parse(execute(process.execPath, args, options).toString("utf8"));
    if (!Number.isSafeInteger(report.numPassedTests) || report.numPassedTests < 1 || report.numFailedTests !== 0 || !Array.isArray(report.testResults)) throw new Error("No passing tests or failed tests.");
    const passed = report.testResults.flatMap((suite) => suite.assertionResults ?? []).filter((result) => result.status === "passed").map((result) => result.fullName);
    if (requiredNames.some((name) => passed.filter((actual) => actual === name).length !== 1)) throw new Error("Required test missing.");
  };
  for (const check of checks) {
    try {
      if (check === "npm") {
        vitest(["scripts/packageScripts.test.mjs", "scripts/dependencyCompatibility.test.mjs"], null, [
          "package and CI deployment automation pins local Wrangler and writes content-version metadata after both build modes",
          "scoped dependency compatibility preserves the minimatch API used by typescript-estree's project service",
          ...(checks.includes("workflow") ? ["package and CI deployment automation pins every action and confines write authority to its required boundary"] : [])
        ]);
        vitest(["scripts/portfolioContentGeneration.test.ts"], "workbook dependency boundary", [
          "workbook dependency boundary pins ExcelJS directly and includes no Google API, OAuth, Drive, or Sheets clients"
        ]);
      } else if (check === "workflow") {
        vitest([...(checks.includes("npm") ? [] : ["scripts/packageScripts.test.mjs"]), "scripts/skeletonBaselineWorkflow.test.mjs", "scripts/dependabotConfig.test.mjs", "scripts/circleci/workflow.test.mjs"], null, [
          ...(checks.includes("npm") ? [] : ["package and CI deployment automation pins every action and confines write authority to its required boundary"]),
          "skeleton visual baseline capture workflow pins its complete action allowlist and executes only the expected steps",
          "dependency update configuration schedules weekly reviews for npm, actions, and every Terraform state root",
          "CircleCI evidence workflow runs trusted default-branch code with inputs and secret only in the verifier step"
        ]);
      } else if (check === "infrastructure") {
        execute(process.execPath, ["infra/validate-ownership.mjs"], options);
      } else throw new Error("Unknown check.");
    } catch { throw new Error(`Dependency preflight ${check} checks failed.`); }
  }
}

export function pullRequestPaths({ candidate, environment, event, projectRoot, runGit = git }) {
  const pr = event?.pull_request;
  const base = pr?.base?.sha;
  if (candidate.event !== "pull_request" || environment.GITHUB_EVENT_NAME !== "pull_request" ||
      event?.repository?.full_name !== repository || event.number !== candidate.pullNumber ||
      pr?.number !== candidate.pullNumber || pr?.base?.repo?.full_name !== repository ||
      pr?.base?.ref !== candidate.baseBranch || pr?.head?.sha !== candidate.runHeadSha || !sha.test(base ?? "")) fail();
  const parents = decode(runGit(projectRoot, "rev-list", "--parents", "-n", "1", candidate.sourceSha)).trim().split(" ");
  if (parents.length !== 3 || parents[0] !== candidate.sourceSha || parents[1] !== base || parents[2] !== candidate.runHeadSha) fail();
  // Comparing the verified base parent to the accepted merge tree captures the
  // complete effect of the PR. Disable rename detection so both names appear.
  const bytes = runGit(projectRoot, "diff", "--name-only", "-z", "--no-renames", "--no-ext-diff", "--no-textconv", base, candidate.sourceSha, "--");
  if (!Buffer.isBuffer(bytes) || bytes.length > 8 * 1024 * 1024) fail();
  const parts = decode(bytes).split("\0");
  if (parts.pop() !== "" || parts.length > 20_000 || parts.some((name) => !name || name.startsWith("/") || name.split("/").includes(".."))) fail();
  return parts;
}

export async function dependencyPreflight({ environment = process.env, projectRoot = process.cwd(), execute = execFileSync } = {}) {
  const candidate = checkedCandidate(environment, projectRoot);
  if (candidate.event !== "pull_request") return { selected: false };
  if (!environment.GITHUB_EVENT_PATH || (await stat(environment.GITHUB_EVENT_PATH)).size > 2 * 1024 * 1024) fail();
  const event = JSON.parse(await readFile(environment.GITHUB_EVENT_PATH, "utf8"));
  const checks = selectPreflightChecks(pullRequestPaths({ candidate, environment, event, projectRoot }));
  const selected = checks.length > 0;
  runPreflightChecks(checks, { environment, projectRoot, execute });
  return { selected };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  dependencyPreflight().then(({ selected }) => console.log(`Dependency preflight ${selected ? "passed" : "not selected"}.`)).catch((error) => {
    console.error(error instanceof Error && /^Dependency preflight (?:npm|workflow|infrastructure) checks failed\.$/.test(error.message) ? error.message : "Dependency preflight could not validate this candidate.");
    process.exitCode = 1;
  });
}
