import { execFileSync } from "node:child_process";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSha, parseBoolean, parseCandidate, positiveInteger, repository, workflowPath } from "./plan.mjs";

function integerEnvironment(value, name) {
  if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) throw new Error(`Missing or invalid ${name}.`);
  return positiveInteger(Number(value), name);
}

export async function readBranchTip(branch, { token = process.env.GH_TOKEN, fetchImpl = fetch } = {}) {
  if (!["main", "develop"].includes(branch)) throw new Error("Only permanent branch observations are allowed.");
  const response = await fetchImpl(`https://api.github.com/repos/${repository}/git/ref/heads/${branch}`, {
    headers: { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    redirect: "error", signal: AbortSignal.timeout(15_000)
  });
  if (!response.ok) throw new Error(`GitHub branch observation failed with HTTP ${response.status}.`);
  const reader = response.body?.getReader();
  if (!reader) throw new Error("GitHub branch observation returned no body.");
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > 64 * 1024) throw new Error("GitHub branch observation exceeded its response budget.");
      chunks.push(part.value);
    }
  } finally {
    // Cancellation is best effort; an uncooperative body must not stall errors.
    void reader.cancel().catch(() => {});
  }
  let value;
  try { value = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new Error("GitHub branch observation was not valid JSON."); }
  if (value.ref !== `refs/heads/${branch}` || value.object?.type !== "commit") throw new Error("GitHub returned the wrong branch observation.");
  return assertSha(value.object.sha, "Observed branch revision");
}

export async function resolveCandidate({ environment, event, checkoutSha, getBranchTip = readBranchTip }) {
  const eventName = environment.GITHUB_EVENT_NAME;
  const ref = environment.GITHUB_REF;
  if (environment.GITHUB_REPOSITORY !== repository || event?.repository?.full_name !== repository) throw new Error("CI repository identity is not approved.");
  if (!["pull_request", "push", "schedule", "workflow_dispatch"].includes(eventName)) throw new Error("Unsupported CI event.");
  if (environment.GITHUB_WORKFLOW_REF !== `${repository}/${workflowPath}@${ref}`) throw new Error("Workflow ref differs from its triggering ref.");
  if (["schedule", "workflow_dispatch"].includes(eventName) && ref !== "refs/heads/main") throw new Error("Scheduled or manual execution must use the trusted main workflow ref.");
  const eventSha = assertSha(environment.GITHUB_SHA, "Event revision");
  if (checkoutSha !== eventSha) throw new Error("Checkout differs from the exact event candidate.");
  const isPr = eventName === "pull_request";
  let branchTip = null;
  if (!isPr) {
    if (!["refs/heads/main", "refs/heads/develop"].includes(ref)) throw new Error("Trusted candidates must use permanent branches.");
    branchTip = await getBranchTip(ref.slice("refs/heads/".length));
  }
  return parseCandidate({ schemaVersion: 1, repository, event: eventName, ref,
    workflowRef: environment.GITHUB_WORKFLOW_REF, workflowSha: environment.GITHUB_WORKFLOW_SHA,
    sourceSha: checkoutSha, eventSha, runHeadSha: isPr ? event.pull_request?.head?.sha : eventSha,
    branchTip, pullNumber: isPr ? event.number : null, baseBranch: isPr ? event.pull_request?.base?.ref : null,
    force: eventName === "workflow_dispatch" ? parseBoolean(environment.CI_FORCE_DEPLOY, "force_deploy") : false,
    runId: integerEnvironment(environment.GITHUB_RUN_ID, "run ID"),
    runNumber: integerEnvironment(environment.GITHUB_RUN_NUMBER, "run number"),
    producerAttempt: integerEnvironment(environment.GITHUB_RUN_ATTEMPT, "run attempt") });
}

export async function writeOutputs(values, destination = process.env.GITHUB_OUTPUT) {
  if (!destination) throw new Error("GitHub output destination is missing.");
  const lines = Object.entries(values).map(([name, value]) => {
    if (!/^[a-z][a-z0-9_]*$/.test(name) || typeof value !== "string" || /[\r\n\0]/.test(value)) throw new Error("Unsafe workflow output.");
    return `${name}=${value}\n`;
  });
  await appendFile(destination, lines.join(""));
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, "utf8"));
    const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding: "utf8", maxBuffer: 1024 }).trim();
    const candidate = await resolveCandidate({ environment: process.env, event, checkoutSha });
    await writeOutputs({ candidate: JSON.stringify(candidate), candidate_sha: candidate.sourceSha,
      obsolete: String(candidate.event !== "pull_request" && candidate.sourceSha !== candidate.branchTip) });
  } catch (error) {
    console.error(error instanceof Error ? error.message : "Candidate resolution failed.");
    process.exitCode = 1;
  }
}
