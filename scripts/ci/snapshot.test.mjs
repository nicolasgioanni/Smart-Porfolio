import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { recordDigest, repository, workflowPath } from "./plan.mjs";
import { createSnapshot, readSnapshotArtifact, verifyArtifactReference, verifySnapshotBytes } from "./snapshot.mjs";

const sha = "a".repeat(40), digest = "b".repeat(64);
const candidate = { schemaVersion: 1, repository, event: "push", ref: "refs/heads/main", workflowRef: `${repository}/${workflowPath}@refs/heads/main`, workflowSha: sha, sourceSha: sha, eventSha: sha, runHeadSha: sha, branchTip: sha, pullNumber: null, baseBranch: null, force: false, runId: 12345, runNumber: 350, producerAttempt: 1 };
const producer = { runId: 12345, runNumber: 350, attempt: 1, job: "prepare-content" };
const bytes = Buffer.from(JSON.stringify({ metadata: { contentHash: digest }, public: "portfolio" }));
const input = { bytes, candidate, producer, lockfileDigest: digest, publicBuildInputDigest: digest };
const snapshot = createSnapshot(input);
const expected = { candidate, snapshotDigest: recordDigest(snapshot), lockfileDigest: digest, publicBuildInputDigest: digest };
const temporary = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("one accepted content generation", () => {
  it("binds exact bytes, semantic content, target, locked dependencies and producer", () => {
    expect(snapshot.byteDigest).toBe(createHash("sha256").update(bytes).digest("hex"));
    expect(verifySnapshotBytes(bytes, snapshot, expected)).toEqual(snapshot);
    for (const mutation of [Buffer.concat([bytes, Buffer.from("\n")]), Buffer.from('{"metadata":{"contentHash":"' + digest + '"},"public":"altered"}')]) {
      expect(() => verifySnapshotBytes(mutation, snapshot, expected)).toThrow();
    }
    for (const patch of [{ sourceSha: "c".repeat(40) }, { target: "preview" }, { contentHash: "c".repeat(64) }, { lockfileDigest: "c".repeat(64) }]) {
      expect(() => verifySnapshotBytes(bytes, { ...snapshot, ...patch }, expected)).toThrow();
    }
    expect(() => verifySnapshotBytes(bytes, snapshot, { ...expected, publicBuildInputDigest: "c".repeat(64) })).toThrow();
  });

  it("permits a consumer rerun to consume its original producer record", () => {
    // No consumer attempt is interpolated into the producer artifact reference.
    expect(verifySnapshotBytes(bytes, snapshot, expected)).toEqual(snapshot);
    const regenerated = createSnapshot({ ...input, producer: { ...producer, attempt: 2 } });
    expect(recordDigest(regenerated)).not.toBe(expected.snapshotDigest);
    expect(() => verifySnapshotBytes(bytes, regenerated, expected)).toThrow("rerun every affected");
  });

  it("rejects cross-run producers and malformed content", () => {
    for (const badProducer of [{ ...producer, runId: 12346 }, { ...producer, runNumber: 351 }, { ...producer, job: "build-and-package" }]) {
      expect(() => createSnapshot({ ...input, producer: badProducer })).toThrow();
    }
    for (const badBytes of [Buffer.from("{}"), Buffer.from([0xff]), Buffer.from(""), Buffer.from("invalid")]) expect(() => createSnapshot({ ...input, bytes: badBytes })).toThrow();
  });

  it("rejects extra files, missing files and symlinks before restoration", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "snapshot-contract-")); temporary.push(directory);
    await writeFile(path.join(directory, "portfolio.generated.json"), bytes);
    await writeFile(path.join(directory, "snapshot.json"), JSON.stringify(snapshot));
    expect((await readSnapshotArtifact(directory)).record).toEqual(snapshot);
    await writeFile(path.join(directory, ".env"), "test fixture only");
    await expect(readSnapshotArtifact(directory)).rejects.toThrow("extra");
    await rm(path.join(directory, ".env"));
    await rm(path.join(directory, "portfolio.generated.json"));
    await expect(readSnapshotArtifact(directory)).rejects.toThrow("missing");
    await symlink(path.join(directory, "snapshot.json"), path.join(directory, "portfolio.generated.json"));
    await expect(readSnapshotArtifact(directory)).rejects.toThrow("unsafe");
    await rm(path.join(directory, "portfolio.generated.json"));
    await mkdir(path.join(directory, "portfolio.generated.json"));
    await expect(readSnapshotArtifact(directory)).rejects.toThrow("unsafe");
  });

  it("requires the exact same-run artifact ID and rejects expired or substituted uploads", () => {
    const reference = { schemaVersion: 1, id: 9, name: "content-12345-1", role: "snapshot", digest, recordDigest: expected.snapshotDigest, producer };
    const metadata = { id: 9, name: reference.name, expired: false, digest: `sha256:${digest}`, workflow_run: { id: candidate.runId, head_sha: candidate.sourceSha } };
    expect(verifyArtifactReference(reference, metadata, candidate)).toEqual(reference);
    for (const patch of [{ id: 10 }, { name: "latest-success" }, { expired: true }, { digest: `sha256:${"c".repeat(64)}` }, { workflow_run: { id: 99, head_sha: candidate.sourceSha } }, { workflow_run: { id: candidate.runId, head_sha: "c".repeat(40) } }]) {
      expect(() => verifyArtifactReference(reference, { ...metadata, ...patch }, candidate)).toThrow("full affected rerun");
    }
    expect(() => verifyArtifactReference(reference, null, candidate)).toThrow();
  });
});
