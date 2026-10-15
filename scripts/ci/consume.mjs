import { mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { parsePlan, recordDigest } from "./plan.mjs";
import { generatedContentPath, parseArtifactReference, readSnapshotArtifact, restoreSnapshot, verifySnapshotBytes } from "./snapshot.mjs";
import { artifactName } from "./githubEvidence.mjs";
import { downloadArtifact, extractArtifact } from "./artifactTransport.mjs";
import { checkedCandidate, currentPlan, currentProducer, digestFile, evidenceDirectory, jsonEnvironment, writeRecord } from "./context.mjs";
import { collectPublicBuildInputs, publicBuildInputDigest } from "../release/publicBuildInputs.mjs";
import { createSourceReceipt, createValidationReceipt } from "./validationEvidence.mjs";

function matchingPlan(environment, projectRoot) {
  const plan = currentPlan(environment), candidate = checkedCandidate(environment, projectRoot);
  if (recordDigest(plan.candidate) !== recordDigest(candidate) || plan.mode !== "full") throw new Error("Application work requires the exact full-verification plan.");
  return plan;
}

async function snapshotExpectations(plan, environment, projectRoot) {
  const inputs = await collectPublicBuildInputs({ projectRoot, target: plan.target, sourceCommit: plan.candidate.sourceSha, environment });
  return { candidate: plan.candidate, snapshotDigest: plan.snapshotDigest,
    lockfileDigest: await digestFile(path.join(projectRoot, "package-lock.json")), publicBuildInputDigest: publicBuildInputDigest(inputs) };
}

export async function restoreAcceptedInputs({ environment = process.env, projectRoot = process.cwd(),
  download = downloadArtifact, extract = extractArtifact } = {}) {
  const plan = matchingPlan(environment, projectRoot);
  const reference = parseArtifactReference(jsonEnvironment("CI_SNAPSHOT_REFERENCE", environment));
  if (reference.role !== "snapshot" || reference.recordDigest !== plan.snapshotDigest || reference.producer.job !== "prepare-content" ||
      reference.name !== artifactName({ role: "snapshot", validator: "content", producer: reference.producer })) throw new Error("Wrong accepted snapshot producer reference.");
  const root = await evidenceDirectory(environment), directory = path.join(root, "snapshot");
  const bytes = await download(reference, plan.candidate, { token: environment.GH_TOKEN });
  await extract(bytes, directory);
  const snapshot = await restoreSnapshot(directory, projectRoot, await snapshotExpectations(plan, environment, projectRoot));
  await writeRecord(root, "consumer.json", { schemaVersion: 1, plan, snapshot, startedAt: Date.now() });
  return { evidence_root: root };
}

export async function verifyAcceptedInputs({ environment = process.env, projectRoot = process.cwd() } = {}) {
  const plan = matchingPlan(environment, projectRoot);
  const root = path.join(environment.RUNNER_TEMP, "portfolio-ci");
  const consumer = JSON.parse(await readFile(path.join(root, "consumer.json"), "utf8"));
  if (consumer.schemaVersion !== 1 || recordDigest(parsePlan(consumer.plan)) !== recordDigest(plan) ||
      !Number.isSafeInteger(consumer.startedAt) || consumer.startedAt > Date.now()) throw new Error("Consumer provenance is incomplete or changed.");
  const expected = await snapshotExpectations(plan, environment, projectRoot);
  const { bytes, record } = await readSnapshotArtifact(path.join(root, "snapshot"));
  const snapshot = verifySnapshotBytes(bytes, record, expected);
  if (recordDigest(snapshot) !== recordDigest(consumer.snapshot)) throw new Error("Consumer snapshot evidence changed.");
  verifySnapshotBytes(await readFile(path.join(projectRoot, generatedContentPath)), snapshot, expected);
  return { root, plan, snapshot, durationMs: Date.now() - consumer.startedAt };
}

export async function writeValidationEvidence({ environment = process.env, projectRoot = process.cwd(),
  validator, assignment = null, browserReport = null, artifactRecordDigest = null, receiptDirectory = "receipt" } = {}) {
  if (typeof receiptDirectory !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(receiptDirectory)) {
    throw new Error("Validation receipt directory is invalid.");
  }
  const { root, plan, durationMs } = await verifyAcceptedInputs({ environment, projectRoot });
  const job = environment.GITHUB_JOB, producer = currentProducer(job, environment);
  const receipt = createValidationReceipt({ plan, validator, job, producer, assignment, browserReport, artifactRecordDigest, durationMs });
  const directory = path.join(root, receiptDirectory);
  await mkdir(directory, { mode: 0o700 });
  await writeRecord(directory, "receipt.json", receipt);
  return { receipt_path: directory, receipt_name: artifactName({ role: "receipt", producer, validator }) };
}

export async function writeSourceEvidence({ environment = process.env, projectRoot = process.cwd() } = {}) {
  const candidate = checkedCandidate(environment, projectRoot), validator = environment.GITHUB_JOB;
  const producer = currentProducer(validator, environment);
  const receipt = createSourceReceipt({ candidate, validator, producer });
  const root = await evidenceDirectory(environment);
  await writeRecord(root, "receipt.json", receipt);
  return { receipt_path: root, receipt_name: artifactName({ role: "receipt", producer, validator }) };
}
