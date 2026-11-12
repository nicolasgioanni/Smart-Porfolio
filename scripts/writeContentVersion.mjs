import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { collectPublicBuildInputs, publicBuildInputDigest } from "./release/publicBuildInputs.mjs";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const defaultGeneratedContentPath = path.join(projectRoot, "src", "content", "generated", "portfolio.generated.json");
export const defaultContentVersionPath = path.join(projectRoot, "out", "content-version.json");

const contentHashPattern = /^[a-f0-9]{64}$/;
const gitShaPattern = /^[a-f0-9]{40}$/i;

function exactKeys(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must contain a JSON object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} must contain exactly the supported fields`);
  }
}

function parseTimestamp(value, key) {
  if (typeof value !== "string" || !value.trim() || Number.isNaN(Date.parse(value))) {
    throw new Error(`content-version.json has an invalid ${key} value`);
  }
  return value;
}

export function parseProducer(value, target) {
  exactKeys(value, ["attempt", "kind", "runId", "runNumber"], "content-version.json producer");
  if (value.kind === "local") {
    if (target !== "local" || value.runId !== "local" || value.runNumber !== null || value.attempt !== null) {
      throw new Error("content-version.json local producer is invalid");
    }
    return { kind: "local", runId: "local", runNumber: null, attempt: null };
  }
  if (
    value.kind !== "github-actions" ||
    typeof value.runId !== "string" || !/^\d+$/.test(value.runId) ||
    !Number.isSafeInteger(value.runNumber) || value.runNumber < 1 ||
    !Number.isSafeInteger(value.attempt) || value.attempt < 1
  ) {
    throw new Error("content-version.json deployment producer is invalid");
  }
  return { kind: "github-actions", runId: value.runId, runNumber: value.runNumber, attempt: value.attempt };
}

/** Reads both legacy public metadata and the current deployment identity. */
export function parseContentVersion(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("content-version.json must contain a JSON object");
  }
  if (value.schemaVersion === 1) {
    exactKeys(value, ["commitSha", "contentHash", "deployedAt", "generatedAt", "schemaVersion"], "content-version.json");
    if (typeof value.contentHash !== "string" || !contentHashPattern.test(value.contentHash)) throw new Error("content-version.json has an invalid contentHash");
    if (typeof value.commitSha !== "string" || !gitShaPattern.test(value.commitSha)) throw new Error("content-version.json has an invalid commitSha");
    return {
      schemaVersion: 1,
      contentHash: value.contentHash,
      commitSha: value.commitSha.toLowerCase(),
      generatedAt: parseTimestamp(value.generatedAt, "generatedAt"),
      deployedAt: parseTimestamp(value.deployedAt, "deployedAt")
    };
  }
  if (value.schemaVersion !== 2) throw new Error("content-version.json has an unsupported schema version");
  exactKeys(value, ["commitSha", "contentHash", "deployedAt", "generatedAt", "producer", "publicBuildInputDigest", "schemaVersion", "target"], "content-version.json");
  if (typeof value.contentHash !== "string" || !contentHashPattern.test(value.contentHash)) throw new Error("content-version.json has an invalid contentHash");
  if (typeof value.commitSha !== "string" || !gitShaPattern.test(value.commitSha)) throw new Error("content-version.json has an invalid commitSha");
  if (!new Set(["local", "preview", "production"]).has(value.target)) throw new Error("content-version.json has an invalid target");
  if (typeof value.publicBuildInputDigest !== "string" || !contentHashPattern.test(value.publicBuildInputDigest)) {
    throw new Error("content-version.json has an invalid publicBuildInputDigest");
  }
  return {
    schemaVersion: 2,
    contentHash: value.contentHash,
    commitSha: value.commitSha.toLowerCase(),
    generatedAt: parseTimestamp(value.generatedAt, "generatedAt"),
    deployedAt: parseTimestamp(value.deployedAt, "deployedAt"),
    target: value.target,
    publicBuildInputDigest: value.publicBuildInputDigest,
    producer: parseProducer(value.producer, value.target)
  };
}

export async function readContentVersion(filePath) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${filePath} is not valid JSON`);
    throw error;
  }
  return parseContentVersion(parsed);
}

async function resolveCommitSha(environment = process.env) {
  for (const candidate of [environment.DEPLOYMENT_COMMIT_SHA, environment.GITHUB_SHA]) {
    if (!candidate?.trim()) continue;
    if (!gitShaPattern.test(candidate.trim())) throw new Error("The configured deployment commit SHA must be a 40-character Git SHA");
    return candidate.trim().toLowerCase();
  }
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: projectRoot });
    const revision = stdout.trim();
    if (gitShaPattern.test(revision)) return revision.toLowerCase();
  } catch {
    // Archives deliberately use a marked, non-deployable local identity.
  }
  return "0".repeat(40);
}

export function releaseProducerForEnvironment(target, environment = process.env) {
  if (target === "local" && environment.RELEASE_RUN_ID === undefined) return { kind: "local", runId: "local", runNumber: null, attempt: null };
  const runId = environment.RELEASE_RUN_ID;
  const runNumber = Number(environment.RELEASE_RUN_NUMBER);
  const attempt = Number(environment.RELEASE_PRODUCER_ATTEMPT);
  return parseProducer({ kind: "github-actions", runId, runNumber, attempt }, target);
}

export async function resolveReleaseIdentity({ sourceCommit, environment = process.env, root = projectRoot } = {}) {
  const target = environment.RELEASE_TARGET ?? "local";
  const publicInputs = await collectPublicBuildInputs({ projectRoot: root, target, sourceCommit, environment });
  const digest = publicBuildInputDigest(publicInputs);
  const declaredDigest = environment.RELEASE_PUBLIC_BUILD_INPUT_DIGEST;
  if (declaredDigest && declaredDigest !== digest) throw new Error("Configured public build-input digest does not match effective build inputs");
  if (target !== "local" && !declaredDigest) throw new Error("Deployable content versions require RELEASE_PUBLIC_BUILD_INPUT_DIGEST");
  return { target, publicBuildInputDigest: digest, producer: releaseProducerForEnvironment(target, environment) };
}

export async function writeContentVersion({
  generatedContentPath = defaultGeneratedContentPath,
  outputPath = defaultContentVersionPath,
  environment = process.env,
  identity,
  now = () => new Date().toISOString()
} = {}) {
  let generatedContent;
  try {
    generatedContent = JSON.parse(await readFile(generatedContentPath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${generatedContentPath} is not valid JSON`);
    throw error;
  }
  const contentHash = generatedContent?.metadata?.contentHash;
  const generatedAt = generatedContent?.metadata?.generatedAt;
  if (typeof contentHash !== "string" || !contentHashPattern.test(contentHash)) throw new Error("Generated portfolio content is missing a valid SHA-256 contentHash");
  if (typeof generatedAt !== "string" || !generatedAt.trim()) throw new Error("Generated portfolio content is missing generatedAt metadata");

  const commitSha = await resolveCommitSha(environment);
  // The existing workflow keeps its version-1 writer until the sealed-release
  // orchestrator passes an explicit target. Preparation must not mislabel a
  // normal production build as a local candidate or invent producer identity.
  const resolvedIdentity = identity ?? (environment.RELEASE_TARGET !== undefined
    ? await resolveReleaseIdentity({ sourceCommit: commitSha, environment }) : null);
  const contentVersion = parseContentVersion({
    contentHash, commitSha, generatedAt, deployedAt: now(),
    ...(resolvedIdentity === null ? { schemaVersion: 1 } : {
      schemaVersion: 2,
      target: resolvedIdentity.target,
      publicBuildInputDigest: resolvedIdentity.publicBuildInputDigest,
      producer: resolvedIdentity.producer
    })
  });
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(contentVersion, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(projectRoot, outputPath)} for content ${contentHash}.`);
  return contentVersion;
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  writeContentVersion({
    generatedContentPath: process.argv[2] ? path.resolve(process.argv[2]) : defaultGeneratedContentPath,
    outputPath: process.argv[3] ? path.resolve(process.argv[3]) : defaultContentVersionPath
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
