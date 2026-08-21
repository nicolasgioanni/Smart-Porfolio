import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export const defaultGeneratedContentPath = path.join(
  projectRoot,
  "src",
  "content",
  "generated",
  "portfolio.generated.json"
);
export const defaultContentVersionPath = path.join(projectRoot, "out", "content-version.json");

const contentHashPattern = /^[a-f0-9]{64}$/;
const gitShaPattern = /^[a-f0-9]{40}$/i;

export function parseContentVersion(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("content-version.json must contain a JSON object");
  }

  const expectedKeys = ["commitSha", "contentHash", "deployedAt", "generatedAt", "schemaVersion"];
  const actualKeys = Object.keys(value).sort();
  if (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index])) {
    throw new Error("content-version.json must contain exactly the supported fields");
  }

  if (value.schemaVersion !== 1) {
    throw new Error("content-version.json has an unsupported schema version");
  }

  if (typeof value.contentHash !== "string" || !contentHashPattern.test(value.contentHash)) {
    throw new Error("content-version.json has an invalid contentHash");
  }

  if (typeof value.generatedAt !== "string" || !value.generatedAt.trim() || Number.isNaN(Date.parse(value.generatedAt))) {
    throw new Error("content-version.json has an invalid generatedAt value");
  }

  if (typeof value.deployedAt !== "string" || !value.deployedAt.trim() || Number.isNaN(Date.parse(value.deployedAt))) {
    throw new Error("content-version.json has an invalid deployedAt value");
  }

  if (typeof value.commitSha !== "string" || !gitShaPattern.test(value.commitSha)) {
    throw new Error("content-version.json has an invalid commitSha");
  }

  return {
    schemaVersion: 1,
    contentHash: value.contentHash,
    commitSha: value.commitSha.toLowerCase(),
    generatedAt: value.generatedAt,
    deployedAt: value.deployedAt
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
    if (!gitShaPattern.test(candidate.trim())) {
      throw new Error("The configured deployment commit SHA must be a 40-character Git SHA");
    }
    return candidate.trim().toLowerCase();
  }

  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: projectRoot });
    const revision = stdout.trim();
    if (gitShaPattern.test(revision)) return revision.toLowerCase();
  } catch {
    // A source archive without Git metadata is still allowed to produce a local build.
  }

  return "0".repeat(40);
}

export async function writeContentVersion({
  generatedContentPath = defaultGeneratedContentPath,
  outputPath = defaultContentVersionPath,
  environment = process.env
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

  if (typeof contentHash !== "string" || !contentHashPattern.test(contentHash)) {
    throw new Error("Generated portfolio content is missing a valid SHA-256 contentHash");
  }
  if (typeof generatedAt !== "string" || !generatedAt.trim()) {
    throw new Error("Generated portfolio content is missing generatedAt metadata");
  }

  const contentVersion = parseContentVersion({
    schemaVersion: 1,
    contentHash,
    commitSha: await resolveCommitSha(environment),
    generatedAt,
    deployedAt: new Date().toISOString()
  });

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(contentVersion, null, 2)}\n`, "utf8");
  console.log(`Wrote ${path.relative(projectRoot, outputPath)} for content ${contentHash}.`);
  return contentVersion;
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  writeContentVersion({
    generatedContentPath: process.argv[2] ? path.resolve(process.argv[2]) : defaultGeneratedContentPath,
    outputPath: process.argv[3] ? path.resolve(process.argv[3]) : defaultContentVersionPath
  }).catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
