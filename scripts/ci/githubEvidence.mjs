import { assertDigest, parseCandidate, positiveInteger, repository } from "./plan.mjs";
import { parseArtifactReference, parseArtifactTransfer, parseProducer, verifyArtifactTransfer } from "./snapshot.mjs";
import { selectCompletedJob } from "./receipts.mjs";

const apiRoot = `https://api.github.com/repos/${repository}`;
const responseBudget = 8 * 1024 * 1024;

export async function readGithubEvidence(endpoint, { token, fetchImplementation = fetch } = {}) {
  if (!/^\/actions\/(?:runs\/[1-9]\d*(?:\/(?:jobs\?filter=all&per_page=100&page=[1-9]\d*|artifacts\?per_page=100&page=[1-9]\d*))?|artifacts\/[1-9]\d*)$/.test(endpoint)) {
    throw new Error("Unsupported GitHub evidence endpoint.");
  }
  if (typeof token !== "string" || !token || /\s/.test(token)) throw new Error("Read-only GitHub evidence credentials are missing or invalid.");
  const signal = AbortSignal.timeout(20_000);
  const response = await fetchImplementation(`${apiRoot}${endpoint}`, {
    headers: { Accept: "application/vnd.github+json", Authorization: `Bearer ${token}`, "X-GitHub-Api-Version": "2022-11-28" },
    redirect: "error", signal
  });
  if (!response.ok || !response.body) throw new Error("GitHub evidence is unavailable. A missing artifact cannot be replaced with fresh inputs.");
  const reader = response.body.getReader();
  const chunks = [];
  let size = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > responseBudget) throw new Error("GitHub evidence exceeds its response budget.");
      chunks.push(value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw new Error("GitHub evidence response is malformed, too large or incomplete.");
  } finally {
    void reader.cancel().catch(() => {});
  }
}

export async function readRunEvidence(candidateValue, options) {
  const candidate = parseCandidate(candidateValue);
  const run = await readGithubEvidence(`/actions/runs/${candidate.runId}`, options);
  if (run.id !== candidate.runId || run.run_number !== candidate.runNumber || run.event !== candidate.event ||
      run.head_sha !== candidate.runHeadSha || run.path !== ".github/workflows/ci.yml" ||
      !Number.isSafeInteger(run.run_attempt) || run.run_attempt < candidate.producerAttempt) {
    throw new Error("GitHub run evidence does not match the candidate.");
  }
  return run;
}

export async function readRunCollection(runId, kind, options) {
  positiveInteger(runId, "Run ID");
  if (!["jobs", "artifacts"].includes(kind)) throw new Error("Unsupported run evidence collection.");
  const entries = [], seen = new Set();
  let total;
  for (let page = 1; page <= 100; page += 1) {
    const query = `${kind === "jobs" ? "filter=all&" : ""}per_page=100&page=${page}`;
    const value = await readGithubEvidence(`/actions/runs/${runId}/${kind}?${query}`, options);
    if (!value || !Number.isSafeInteger(value.total_count) || value.total_count < 0 || !Array.isArray(value[kind]) ||
        value[kind].length > 100 || (total !== undefined && value.total_count !== total)) {
      throw new Error("GitHub evidence collection changed or is malformed; rerun the verification gate.");
    }
    total = value.total_count;
    for (const entry of value[kind]) {
      positiveInteger(entry?.id, "Evidence entry ID");
      if (seen.has(entry.id)) throw new Error("GitHub evidence collection contains duplicate IDs.");
      seen.add(entry.id);
      entries.push(entry);
    }
    if (entries.length === total) return entries;
    if (entries.length > total || value[kind].length < 100) throw new Error("GitHub evidence collection is incomplete.");
  }
  throw new Error("GitHub evidence collection exceeds its pagination budget.");
}

export function artifactName({ role, producer: value, validator }) {
  const producer = parseProducer(value);
  if (!["snapshot", "release", "receipt", "discovery"].includes(role) ||
      typeof validator !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(validator)) throw new Error("Invalid immutable artifact role or validator.");
  return `ci-${producer.runId}-${producer.attempt}-${role}-${validator}`;
}

// Matrix jobs cannot safely share an output variable. Resolve their immutable,
// exact producer names against this same run, then carry the unique artifact ID.
// The latest job execution includes failures; we never search for a green one.
export function transferForCompletedJob({ artifacts, jobs, candidate, currentAttempt, jobName, producerJob, validator, role }) {
  parseCandidate(candidate);
  positiveInteger(currentAttempt, "Current run attempt");
  const job = selectCompletedJob(jobs, { name: jobName, runId: candidate.runId, currentAttempt });
  const producer = parseProducer({ runId: candidate.runId, runNumber: candidate.runNumber, attempt: job.run_attempt, job: producerJob });
  const name = artifactName({ role, producer, validator });
  if (!Array.isArray(artifacts)) throw new Error("Artifact evidence is missing.");
  const matches = artifacts.filter((artifact) => artifact.name === name);
  if (matches.length !== 1) throw new Error("Original producer artifact is missing or ambiguous. Perform a full affected rerun.");
  const metadata = matches[0];
  const transfer = parseArtifactTransfer({ schemaVersion: 1, id: metadata.id, name, role,
    digest: typeof metadata.digest === "string" ? metadata.digest.replace(/^sha256:/, "") : null, producer });
  verifyArtifactTransfer(transfer, metadata, candidate);
  return { transfer, job };
}

export function artifactForCompletedJob(options) {
  assertDigest(options.recordDigest, "Expected evidence record digest");
  const { transfer, job } = transferForCompletedJob(options);
  return { reference: parseArtifactReference({ ...transfer, recordDigest: options.recordDigest }), job };
}

export function verifyReceiptProducer(producerValue, job, expectedJob) {
  const producer = parseProducer(producerValue, expectedJob);
  if (job?.status !== "completed" || job.conclusion !== "success" || job.run_id !== producer.runId || job.run_attempt !== producer.attempt) {
    throw new Error("Receipt is not from the latest successful execution of its required job.");
  }
  return producer;
}
