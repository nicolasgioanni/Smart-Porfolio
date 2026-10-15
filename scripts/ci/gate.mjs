import { mkdtemp, realpath, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { applicationJobs, evaluateResults, exactKeys, parsePlan, positiveInteger, recordDigest, securityJobs } from "./plan.mjs";
import { artifactName, readRunCollection, readRunEvidence, transferForCompletedJob, verifyReceiptProducer } from "./githubEvidence.mjs";
import { downloadArtifact, extractArtifact } from "./artifactTransport.mjs";
import { parseArtifactReference, verifyArtifactReference } from "./snapshot.mjs";
import { allowedBrowserSkips } from "./browserSkips.mjs";
import { parseChromiumDiscovery, readEvidenceArtifact, verifySourceReceipt } from "./validationEvidence.mjs";
import { parseTestIdentity, selectCompletedJob, verifyReceipt } from "./receipts.mjs";

function exactProducerReference(value, { role, validator, producerJob, candidate, currentAttempt, jobs, artifacts }) {
  const reference = parseArtifactReference(value);
  if (reference.role !== role || reference.producer.job !== producerJob ||
      reference.name !== artifactName({ role, validator, producer: reference.producer })) throw new Error("Producer artifact role/name does not match its responsibility.");
  const job = selectCompletedJob(jobs, { name: producerJob, runId: candidate.runId, currentAttempt });
  verifyReceiptProducer(reference.producer, job, producerJob);
  const matches = artifacts.filter((artifact) => artifact.id === reference.id);
  if (matches.length !== 1) throw new Error("Accepted producer artifact is missing or ambiguous.");
  verifyArtifactReference(reference, matches[0], candidate);
  return reference;
}

export function parseDiscoveryEnvelope(value) {
  exactKeys(value, ["schemaVersion", "chromium", "crossBrowser"], "Browser discovery envelope");
  if (value.schemaVersion !== 1) throw new Error("Unsupported browser discovery envelope.");
  parseChromiumDiscovery(value.chromium);
  exactKeys(value.crossBrowser, ["identities", "digest"], "Cross-browser discovery");
  const identities = value.crossBrowser.identities;
  if (!Array.isArray(identities) || identities.length === 0 || new Set(identities).size !== identities.length ||
      recordDigest([...identities].sort()) !== value.crossBrowser.digest) throw new Error("Cross-browser discovery is incomplete or inconsistent.");
  const projects = new Set(identities.map((identity) => parseTestIdentity(identity)[0]));
  if ([...projects].sort().join(",") !== "firefox-critical,webkit-critical,webkit-mobile") throw new Error("Cross-browser discovery must retain all three required projects.");
  return value;
}

// One lightweight admission path. Runtime injection is for local provider-
// failure tests; the CLI uses these fixed read-only implementations. No npm
// installation, application test rerun or cloud mutation occurs in this gate.
export async function verifyCompleteEvidence({ plan: input, results, currentAttempt, references }, {
  token, fetchImplementation = fetch, temporaryRoot = os.tmpdir(),
  readRun = readRunEvidence, readCollection = readRunCollection,
  download = downloadArtifact, extract = extractArtifact
} = {}) {
  const plan = parsePlan(input), candidate = plan.candidate;
  positiveInteger(currentAttempt, "Aggregate attempt");
  const decision = evaluateResults(plan, results);
  if (!decision.accepted) throw new Error("Required validation results are incomplete or unsuccessful.");
  exactKeys(references, ["snapshot", "discovery", "release"], "Producer references");
  const options = { token, fetchImplementation };
  const [run, jobs, artifacts] = await Promise.all([
    readRun(candidate, options), readCollection(candidate.runId, "jobs", options), readCollection(candidate.runId, "artifacts", options)
  ]);
  if (run.run_attempt !== currentAttempt || currentAttempt < candidate.producerAttempt) throw new Error("Aggregate is not evaluating the current run attempt.");
  const expected = { candidate, currentAttempt, jobs, artifacts };
  let snapshot = null, release = null;
  if (plan.mode === "obsolete") {
    if (Object.values(references).some((value) => value !== null)) throw new Error("Obsolete no-op cannot carry prepared artifacts.");
  } else {
    snapshot = exactProducerReference(references.snapshot, { ...expected, role: "snapshot", validator: "content", producerJob: "prepare-content" });
    if (snapshot.recordDigest !== plan.snapshotDigest) throw new Error("Plan and content generation differ. Perform a full affected rerun.");
  }
  if (plan.mode === "unchanged" && (references.discovery !== null || references.release !== null)) throw new Error("Unchanged no-op cannot claim application verification or authorize deployment.");
  if (plan.mode === "full") {
    release = exactProducerReference(references.release, { ...expected, role: "release", validator: "candidate", producerJob: "build-and-package" });
  }
  // Even no-op plans need a successful current preparation result, with an
  // explicit decision. Upstream failure can never become an optimized no-op.
  selectCompletedJob(jobs, { name: "prepare-content", runId: candidate.runId, currentAttempt });
  selectCompletedJob(jobs, { name: "resolve-candidate", runId: candidate.runId, currentAttempt });
  const root = await realpath(await mkdtemp(path.join(temporaryRoot, "portfolio-gate-")));
  const receiptDigests = {}, summaries = {};
  try {
    const load = async (reference, name, file) => {
      const bytes = await download(reference, candidate, options);
      const destination = path.join(root, name);
      await extract(bytes, destination);
      return readEvidenceArtifact(destination, file);
    };
    let discovery = null;
    if (plan.mode === "full") {
      const reference = exactProducerReference(references.discovery, { ...expected, role: "discovery", validator: "browsers", producerJob: "prepare-content" });
      const record = await load(reference, "discovery", "discovery.json");
      if (recordDigest(record) !== reference.recordDigest) throw new Error("Browser discovery artifact changed.");
      discovery = parseDiscoveryEnvelope(record);
    }
    const validators = [
      ...securityJobs.map((name) => ({ name, job: name, sourceOnly: true })),
      ...(candidate.event === "pull_request" ? [{ name: "dependency-review", job: "dependency-review", sourceOnly: true }] : []),
      ...(plan.mode === "full" ? applicationJobs.flatMap((job) => job === "browser-e2e" ? [
        { name: "chromium-1-of-2", job }, { name: "chromium-2-of-2", job }
      ] : [{ name: job, job }]) : [])
    ];
    // Do not remove the temporary root while sibling artifact transports still
    // own destinations inside it. A rejected Promise.all settles immediately;
    // awaiting every bounded task keeps cleanup deterministic on bad evidence.
    const validationResults = await Promise.allSettled(validators.map(async ({ name, job: producerJob, sourceOnly = false }) => {
      const { transfer, job } = transferForCompletedJob({ ...expected, jobName: name, producerJob, validator: name, role: "receipt" });
      const receipt = await load(transfer, `receipt-${name}`, "receipt.json");
      verifyReceiptProducer(receipt.producer, job, producerJob);
      if (sourceOnly) {
        verifySourceReceipt(receipt, { candidate, validator: name });
      } else {
        const assignment = name === "cross-browser" ? discovery.crossBrowser.identities :
          discovery.chromium.assignments[name]?.identities ?? null;
        const artifactRecordDigest = ["build-and-package", "export-check"].includes(name) ? release.recordDigest : null;
        summaries[name] = verifyReceipt(receipt, { plan, validator: name, job: producerJob, assignment, artifactRecordDigest, allowedSkips: allowedBrowserSkips });
      }
      receiptDigests[name] = recordDigest(receipt);
    }));
    const rejected = validationResults.find((result) => result.status === "rejected");
    if (rejected) throw rejected.reason;
    return { schemaVersion: 1, accepted: true, deploy: decision.deploy, mode: plan.mode,
      candidateDigest: recordDigest(candidate), planDigest: recordDigest(plan), snapshot, release, receiptDigests, summaries };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
