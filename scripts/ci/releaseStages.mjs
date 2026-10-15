import { readFile } from "node:fs/promises";
import path from "node:path";
import { recordDigest, sealedReleaseValidators } from "./plan.mjs";
import { artifactName } from "./githubEvidence.mjs";
import { parseArtifactReference } from "./snapshot.mjs";
import { downloadArtifact, extractArtifact } from "./artifactTransport.mjs";
import { currentProducer, jsonEnvironment } from "./context.mjs";
import { verifyAcceptedInputs, writeValidationEvidence } from "./consume.mjs";
import { buildAcceptedSnapshot, compileReleaseOutput, createSealedPackage, verifyPackagedRuntime } from "../release/lifecycle.mjs";
import { verifySealedRelease } from "../release/sealedRelease.mjs";
import { evaluatePayloadBudget } from "../quality/payloadBudget.mjs";
import { runSecurityScans } from "../security/securityScans.mjs";

const [builtOutputScanValidator] = sealedReleaseValidators;

function sealedExpectation(manifest) {
  const candidate = manifest?.candidate;
  if (!candidate || typeof candidate !== "object") throw new Error("Sealed candidate security scan failed.");
  return {
    sourceCommit: candidate.sourceCommit,
    contentHash: candidate.contentHash,
    target: candidate.target,
    publicBuildInputDigest: candidate.publicBuildInputDigest,
    snapshotRecordDigest: candidate.snapshotRecordDigest
  };
}

/**
 * Scan the exact sealed directory, never the mutable build tree. Scanner
 * output stays in the runner's private temporary area; only the standard
 * receipt is allowed to leave the job after both integrity reads succeed.
 */
export async function scanSealedCandidate({ projectRoot = process.cwd(), releaseDirectory, manifest,
  environment = process.env, runScans = runSecurityScans, verifyRelease = verifySealedRelease } = {}) {
  const gitleaks = environment.CI_GITLEAKS;
  if (typeof gitleaks !== "string" || !path.isAbsolute(gitleaks) || !gitleaks) {
    throw new Error("Sealed candidate security scan failed.");
  }
  const release = path.resolve(releaseDirectory ?? "");
  const expected = sealedExpectation(manifest);
  const scannerRoot = environment.RUNNER_TEMP;
  if (typeof scannerRoot !== "string" || !path.isAbsolute(scannerRoot)) {
    throw new Error("Sealed candidate security scan failed.");
  }
  try {
    await verifyRelease(release, expected);
    const results = await runScans({
      gitleaks,
      gitleaksMode: "dir",
      target: release,
      tempRoot: path.join(scannerRoot, "portfolio-ci-built-output-scan"),
      root: path.resolve(projectRoot)
    });
    if (!Array.isArray(results) || results.length !== 1 || results[0]?.tool !== "gitleaks" ||
        results[0]?.status !== "clean" || results[0]?.findings !== 0) {
      throw new Error("scanner result is incomplete");
    }
    await verifyRelease(release, expected);
  } catch {
    throw new Error("Sealed candidate security scan failed.");
  }
}

export function assertReleaseProducer(manifest, reference, plan) {
  if (manifest.candidate.snapshotRecordDigest !== plan.snapshotDigest || reference.recordDigest !== recordDigest(manifest) ||
      manifest.candidate.sourceCommit !== plan.candidate.sourceSha || manifest.candidate.target !== plan.target ||
      manifest.candidate.producer.kind !== "github-actions" ||
      manifest.candidate.producer.runId !== String(reference.producer.runId) ||
      manifest.candidate.producer.runNumber !== reference.producer.runNumber ||
      manifest.candidate.producer.attempt !== reference.producer.attempt) throw new Error("Sealed candidate and accepted producer generation differ.");
}

export async function buildCandidate({ environment = process.env, projectRoot = process.cwd() } = {}) {
  const { root, plan, snapshot } = await verifyAcceptedInputs({ environment, projectRoot });
  const producer = currentProducer("build-and-package", environment);
  const options = { projectRoot, sourceCommit: plan.candidate.sourceSha, target: plan.target,
    snapshotPath: path.join(root, "snapshot", "portfolio.generated.json"), snapshotDigest: snapshot.byteDigest,
    snapshotRecordDigest: plan.snapshotDigest, publicBuildInputDigest: snapshot.publicBuildInputDigest,
    producer: `${producer.runId}:${producer.runNumber}:${producer.attempt}`, environment };
  await buildAcceptedSnapshot(options);
  await compileReleaseOutput({ projectRoot, outDirectory: "out", sourceCommit: plan.candidate.sourceSha });
  await evaluatePayloadBudget({ outputDirectory: path.join(projectRoot, "out"), nextDirectory: path.join(projectRoot, ".next") });
  const directory = path.join(root, "release");
  const manifest = await createSealedPackage({ ...options, outDirectory: "out", releaseDirectory: directory });
  await scanSealedCandidate({ projectRoot, releaseDirectory: directory, manifest, environment });
  // An unsigned uploaded candidate is not release authorization. The aggregate
  // also requires the exact sealed-output scanner and export/runtime evidence.
  const scanEvidence = await writeValidationEvidence({ environment, projectRoot, validator: builtOutputScanValidator,
    artifactRecordDigest: recordDigest(manifest), receiptDirectory: builtOutputScanValidator });
  const evidence = await writeValidationEvidence({ environment, projectRoot, validator: "build-and-package", artifactRecordDigest: recordDigest(manifest) });
  return { ...evidence, scan_receipt_path: scanEvidence.receipt_path, scan_receipt_name: scanEvidence.receipt_name,
    release_path: directory, release_digest: recordDigest(manifest),
    release_name: artifactName({ role: "release", producer, validator: "candidate" }) };
}

export async function restoreSealedCandidate({ environment = process.env, projectRoot = process.cwd(),
  download = downloadArtifact, extract = extractArtifact } = {}) {
  const { root, plan, snapshot } = await verifyAcceptedInputs({ environment, projectRoot });
  const reference = parseArtifactReference(jsonEnvironment("CI_RELEASE_REFERENCE", environment));
  if (reference.role !== "release" || reference.producer.job !== "build-and-package" ||
      reference.name !== artifactName({ role: "release", validator: "candidate", producer: reference.producer })) throw new Error("Wrong release producer reference.");
  const directory = path.join(root, "release");
  await extract(await download(reference, plan.candidate, { token: environment.GH_TOKEN }), directory);
  const manifest = await verifySealedRelease(directory, { sourceCommit: plan.candidate.sourceSha,
    target: plan.target, contentHash: snapshot.contentHash, publicBuildInputDigest: snapshot.publicBuildInputDigest,
    snapshotRecordDigest: plan.snapshotDigest });
  assertReleaseProducer(manifest, reference, plan);
  return { directory, manifest, reference, plan, snapshot };
}

export async function validateExport({ environment = process.env, projectRoot = process.cwd() } = {}) {
  const { directory, reference, plan } = await restoreSealedCandidate({ environment, projectRoot });
  const runtimeEnvironment = { ...environment };
  delete runtimeEnvironment.GH_TOKEN;
  await verifyPackagedRuntime({ projectRoot, releaseDirectory: directory, environment: runtimeEnvironment });
  const after = JSON.parse(await readFile(path.join(directory, "release-integrity.json"), "utf8"));
  assertReleaseProducer(after, reference, plan);
  return writeValidationEvidence({ environment, projectRoot, validator: "export-check", artifactRecordDigest: reference.recordDigest });
}
