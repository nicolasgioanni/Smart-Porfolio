import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const gitShaPattern = /^[a-f0-9]{40}$/;
const deploymentBranches = new Set(["main", "develop"]);

function validateCandidate(branch, candidateSha) {
  if (!deploymentBranches.has(branch)) {
    throw new Error("Deployment candidates must use the main or develop branch");
  }
  if (typeof candidateSha !== "string" || !gitShaPattern.test(candidateSha)) {
    throw new Error("Deployment candidate SHA must be a lowercase full Git SHA");
  }
}

function runGit(args, cwd) {
  const result = spawnSync("git", args, { cwd, encoding: "utf8" });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(result.stderr.trim() || `git ${args.join(" ")} failed`);
  }
  return result.stdout.trim();
}

export function assertCurrentDeploymentCandidate(
  branch,
  candidateSha,
  { cwd = process.cwd(), git = runGit } = {}
) {
  validateCandidate(branch, candidateSha);
  const remoteRef = `refs/remotes/origin/${branch}`;

  git(["fetch", "--no-tags", "origin", `+refs/heads/${branch}:${remoteRef}`], cwd);
  const latestSha = git(["rev-parse", remoteRef], cwd).toLowerCase();
  if (!gitShaPattern.test(latestSha)) throw new Error(`Remote ${branch} did not resolve to a full Git SHA`);
  if (latestSha !== candidateSha) {
    throw new Error(`Refusing to deploy stale ${branch} revision ${candidateSha}; the branch is now ${latestSha}.`);
  }
  return latestSha;
}

function runCli() {
  const [command, branch, candidateSha] = process.argv.slice(2);
  if (command !== "assert" || !branch || !candidateSha || process.argv.length !== 5) {
    throw new Error("Usage: node scripts/deploymentCandidate.mjs assert <main|develop> <candidate-sha>");
  }
  assertCurrentDeploymentCandidate(branch, candidateSha);
  console.log(`Confirmed current ${branch} candidate ${candidateSha}.`);
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  try {
    runCli();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
