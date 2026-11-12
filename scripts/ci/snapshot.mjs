import { createHash } from "node:crypto";
import { lstat, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { assertDigest, assertSha, candidateTarget, exactKeys, parseCandidate, positiveInteger, recordDigest } from "./plan.mjs";

export const generatedContentPath = "src/content/generated/portfolio.generated.json";
export const snapshotFiles = Object.freeze(["portfolio.generated.json", "snapshot.json"]);

export function parseProducer(value, expectedJob) {
  exactKeys(value, ["runId", "runNumber", "attempt", "job"], "Artifact producer");
  for (const key of ["runId", "runNumber", "attempt"]) positiveInteger(value[key], `Producer ${key}`);
  if (typeof value.job !== "string" || !/^[a-z][a-z0-9-]{0,63}$/.test(value.job) ||
      (expectedJob && value.job !== expectedJob)) throw new Error("Unexpected artifact producer job.");
  return structuredClone(value);
}

export function parseSnapshot(value) {
  exactKeys(value, ["schemaVersion", "candidateDigest", "sourceSha", "sourceMode", "target", "contentHash", "byteDigest", "byteLength", "lockfileDigest", "publicBuildInputDigest", "producer"], "Content snapshot");
  if (value.schemaVersion !== 1) throw new Error("Unsupported snapshot schema.");
  for (const key of ["candidateDigest", "contentHash", "byteDigest", "lockfileDigest", "publicBuildInputDigest"]) assertDigest(value[key], `Snapshot ${key}`);
  assertSha(value.sourceSha);
  positiveInteger(value.byteLength, "Snapshot byte length");
  if (value.byteLength > 16 * 1024 * 1024) throw new Error("Snapshot exceeds its transfer budget.");
  if (!["local", "preview", "production"].includes(value.target) ||
      value.sourceMode !== (value.target === "local" ? "templates" : "remote")) throw new Error("Snapshot target and source mode do not agree.");
  parseProducer(value.producer, "prepare-content");
  return structuredClone(value);
}

function inspectBytes(bytes) {
  if (!Buffer.isBuffer(bytes) || bytes.byteLength === 0 || bytes.byteLength > 16 * 1024 * 1024) throw new Error("Snapshot must be bounded nonempty bytes.");
  let content;
  try { content = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)); }
  catch { throw new Error("Snapshot must contain valid UTF-8 JSON."); }
  const contentHash = assertDigest(content?.metadata?.contentHash, "Generated semantic content hash");
  return { contentHash, byteDigest: createHash("sha256").update(bytes).digest("hex"), byteLength: bytes.byteLength };
}

export function createSnapshot({ bytes, candidate: input, producer, lockfileDigest, publicBuildInputDigest }) {
  const candidate = parseCandidate(input);
  const parsedProducer = parseProducer(producer, "prepare-content");
  if (parsedProducer.runId !== candidate.runId || parsedProducer.runNumber !== candidate.runNumber ||
      parsedProducer.attempt < candidate.producerAttempt) throw new Error("Snapshot producer does not belong to the candidate generation.");
  return parseSnapshot({ schemaVersion: 1, candidateDigest: recordDigest(candidate), sourceSha: candidate.sourceSha,
    target: candidateTarget(candidate), sourceMode: candidate.event === "pull_request" ? "templates" : "remote",
    ...inspectBytes(bytes), lockfileDigest, publicBuildInputDigest, producer: parsedProducer });
}

export function verifySnapshotBytes(bytes, record, { candidate, snapshotDigest, lockfileDigest, publicBuildInputDigest }) {
  const snapshot = parseSnapshot(record);
  assertDigest(snapshotDigest, "Expected snapshot digest");
  if (recordDigest(snapshot) !== snapshotDigest) throw new Error("Snapshot record changed; rerun every affected validator.");
  const expected = createSnapshot({ bytes, candidate, producer: snapshot.producer, lockfileDigest, publicBuildInputDigest });
  if (recordDigest(expected) !== snapshotDigest) throw new Error("Snapshot inputs differ from the accepted generation; perform a full affected rerun.");
  return snapshot;
}

// Each consumer owns its checkout. No env files, raw workbook or locator are
// accepted in the content artifact, even if extra files would be ignored by Next.
export async function readSnapshotArtifact(directory) {
  const root = await lstat(directory);
  if (!root.isDirectory() || root.isSymbolicLink()) throw new Error("Snapshot artifact must be a real directory.");
  const entries = await readdir(directory);
  if ([...entries].sort().join(",") !== [...snapshotFiles].sort().join(",")) throw new Error("Snapshot artifact has missing or extra files.");
  for (const name of snapshotFiles) {
    const entry = await lstat(path.join(directory, name));
    if (!entry.isFile() || entry.isSymbolicLink()) throw new Error("Snapshot artifact contains an unsafe file.");
    const maximum = name === "snapshot.json" ? 16 * 1024 : 16 * 1024 * 1024;
    if (entry.size === 0 || entry.size > maximum) throw new Error("Snapshot artifact file exceeds its size budget.");
  }
  return { bytes: await readFile(path.join(directory, "portfolio.generated.json")), record: JSON.parse(await readFile(path.join(directory, "snapshot.json"), "utf8")) };
}

export async function restoreSnapshot(directory, checkout, expected) {
  const { bytes, record } = await readSnapshotArtifact(directory);
  const snapshot = verifySnapshotBytes(bytes, record, expected);
  const destination = path.join(checkout, generatedContentPath);
  // The checked-in generated file and its parent chain must not redirect writes.
  for (const relative of ["src", "src/content", "src/content/generated", generatedContentPath]) {
    const entry = await lstat(path.join(checkout, relative));
    if (entry.isSymbolicLink() || (relative === generatedContentPath ? !entry.isFile() : !entry.isDirectory())) throw new Error("Generated content destination is unsafe.");
  }
  await writeFile(destination, bytes);
  verifySnapshotBytes(await readFile(destination), snapshot, expected);
  return snapshot;
}

export function parseArtifactTransfer(value) {
  exactKeys(value, ["schemaVersion", "id", "name", "role", "digest", "producer"], "Artifact transfer");
  if (value.schemaVersion !== 1 || !["snapshot", "release", "receipt", "discovery"].includes(value.role)) throw new Error("Unsupported artifact role or schema.");
  positiveInteger(value.id, "Artifact ID");
  if (typeof value.name !== "string" || !/^[a-zA-Z0-9_-]{1,180}$/.test(value.name)) throw new Error("Unsafe artifact name.");
  assertDigest(value.digest, "Artifact digest");
  parseProducer(value.producer);
  return structuredClone(value);
}

export function parseArtifactReference(value) {
  exactKeys(value, ["schemaVersion", "id", "name", "role", "digest", "recordDigest", "producer"], "Artifact reference");
  const { recordDigest: digest, ...transfer } = value;
  parseArtifactTransfer(transfer);
  assertDigest(digest, "Artifact record digest");
  return structuredClone(value);
}

export function verifyArtifactTransfer(referenceValue, metadata, candidate) {
  const reference = parseArtifactTransfer(referenceValue);
  parseCandidate(candidate);
  if (!metadata || metadata.id !== reference.id || metadata.name !== reference.name || metadata.expired !== false ||
      metadata.digest !== `sha256:${reference.digest}` || metadata.workflow_run?.id !== candidate.runId ||
      metadata.workflow_run?.head_sha !== candidate.runHeadSha || reference.producer.runId !== candidate.runId ||
      reference.producer.runNumber !== candidate.runNumber) {
    throw new Error("Artifact is missing, expired or belongs to different inputs. Perform a full affected rerun; never substitute another artifact.");
  }
  return reference;
}

export function verifyArtifactReference(referenceValue, metadata, candidate) {
  const reference = parseArtifactReference(referenceValue);
  const transfer = { ...reference };
  delete transfer.recordDigest;
  verifyArtifactTransfer(transfer, metadata, candidate);
  return reference;
}
