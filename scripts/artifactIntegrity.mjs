import { createHash } from "node:crypto";
import { readFile, readdir, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readContentVersion } from "./writeContentVersion.mjs";

export const artifactManifestFileName = "artifact-integrity.json";
const sha256Pattern = /^[a-f0-9]{64}$/;
const gitShaPattern = /^[a-f0-9]{40}$/;

async function hashFile(filePath) {
  const contents = await readFile(filePath);
  return {
    sha256: createHash("sha256").update(contents).digest("hex"),
    size: contents.byteLength
  };
}

async function listArtifactFiles(rootDirectory, currentDirectory = rootDirectory) {
  const files = [];
  const entries = await readdir(currentDirectory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = path.join(currentDirectory, entry.name);
    const relativePath = path.relative(rootDirectory, absolutePath).split(path.sep).join("/");

    if (relativePath === artifactManifestFileName) continue;
    if (entry.isSymbolicLink()) throw new Error(`Artifact symlinks are not allowed: ${relativePath}`);
    if (entry.isDirectory()) {
      files.push(...(await listArtifactFiles(rootDirectory, absolutePath)));
      continue;
    }
    if (!entry.isFile()) throw new Error(`Unsupported artifact entry: ${relativePath}`);

    files.push({ path: relativePath, ...(await hashFile(absolutePath)) });
  }

  return files.sort((left, right) => left.path.localeCompare(right.path));
}

function parseManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Artifact integrity manifest must contain a JSON object");
  }
  if (value.schemaVersion !== 1 || value.algorithm !== "sha256") {
    throw new Error("Artifact integrity manifest has an unsupported schema or algorithm");
  }
  const manifestKeys = Object.keys(value).sort();
  const expectedManifestKeys = ["algorithm", "commitSha", "files", "schemaVersion"];
  if (
    manifestKeys.length !== expectedManifestKeys.length ||
    manifestKeys.some((key, index) => key !== expectedManifestKeys[index])
  ) {
    throw new Error("Artifact integrity manifest must contain exactly the supported fields");
  }
  if (typeof value.commitSha !== "string" || !gitShaPattern.test(value.commitSha)) {
    throw new Error("Artifact integrity manifest has an invalid commitSha");
  }
  if (!Array.isArray(value.files) || value.files.length === 0) {
    throw new Error("Artifact integrity manifest has no files");
  }

  const seenPaths = new Set();
  const files = value.files.map((file) => {
    if (!file || typeof file !== "object" || Array.isArray(file)) {
      throw new Error("Artifact integrity manifest contains an invalid file record");
    }
    const fileKeys = Object.keys(file).sort();
    if (fileKeys.length !== 3 || fileKeys[0] !== "path" || fileKeys[1] !== "sha256" || fileKeys[2] !== "size") {
      throw new Error("Artifact integrity manifest file records must contain exactly path, sha256, and size");
    }
    if (
      typeof file.path !== "string" ||
      !file.path ||
      file.path.startsWith("/") ||
      file.path.includes("\\") ||
      file.path.split("/").some((segment) => !segment || segment === "." || segment === "..")
    ) {
      throw new Error("Artifact integrity manifest contains an unsafe file path");
    }
    if (seenPaths.has(file.path)) throw new Error(`Artifact integrity manifest repeats ${file.path}`);
    seenPaths.add(file.path);
    if (typeof file.sha256 !== "string" || !sha256Pattern.test(file.sha256)) {
      throw new Error(`Artifact integrity manifest has an invalid digest for ${file.path}`);
    }
    if (!Number.isSafeInteger(file.size) || file.size < 0) {
      throw new Error(`Artifact integrity manifest has an invalid size for ${file.path}`);
    }
    return { path: file.path, sha256: file.sha256, size: file.size };
  });

  return {
    schemaVersion: 1,
    algorithm: "sha256",
    commitSha: value.commitSha,
    files
  };
}

export async function createArtifactManifest(rootDirectory) {
  const resolvedRoot = path.resolve(rootDirectory);
  if (!(await stat(resolvedRoot)).isDirectory()) throw new Error(`${resolvedRoot} is not an artifact directory`);

  const contentVersion = await readContentVersion(path.join(resolvedRoot, "content-version.json"));
  const manifest = {
    schemaVersion: 1,
    algorithm: "sha256",
    commitSha: contentVersion.commitSha,
    files: await listArtifactFiles(resolvedRoot)
  };
  parseManifest(manifest);
  await writeFile(
    path.join(resolvedRoot, artifactManifestFileName),
    `${JSON.stringify(manifest, null, 2)}\n`,
    "utf8"
  );
  console.log(`Created SHA-256 integrity records for ${manifest.files.length} artifact files.`);
  return manifest;
}

export async function verifyArtifactManifest(rootDirectory, expectedCommitSha) {
  const resolvedRoot = path.resolve(rootDirectory);
  let manifestValue;
  try {
    manifestValue = JSON.parse(await readFile(path.join(resolvedRoot, artifactManifestFileName), "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error("Artifact integrity manifest is not valid JSON");
    throw error;
  }

  const manifest = parseManifest(manifestValue);
  if (expectedCommitSha) {
    const normalizedCommitSha = expectedCommitSha.toLowerCase();
    if (!gitShaPattern.test(normalizedCommitSha) || manifest.commitSha !== normalizedCommitSha) {
      throw new Error("Artifact commit SHA does not match the verified candidate");
    }
  }

  const contentVersion = await readContentVersion(path.join(resolvedRoot, "content-version.json"));
  if (contentVersion.commitSha !== manifest.commitSha) {
    throw new Error("Content version and artifact manifest commit SHAs do not match");
  }

  const actualFiles = await listArtifactFiles(resolvedRoot);
  if (actualFiles.length !== manifest.files.length) {
    throw new Error("Artifact file count does not match its integrity manifest");
  }

  for (let index = 0; index < actualFiles.length; index += 1) {
    const actual = actualFiles[index];
    const expected = manifest.files[index];
    if (actual.path !== expected.path || actual.sha256 !== expected.sha256 || actual.size !== expected.size) {
      throw new Error(`Artifact integrity verification failed for ${actual.path}`);
    }
  }

  console.log(`Verified SHA-256 integrity for ${actualFiles.length} artifact files.`);
  return manifest;
}

async function runCli() {
  const [command, directory = "out", expectedCommitSha] = process.argv.slice(2);
  if (command === "create") return createArtifactManifest(directory);
  if (command === "verify") return verifyArtifactManifest(directory, expectedCommitSha);
  throw new Error("Usage: node scripts/artifactIntegrity.mjs <create|verify> [artifact-directory] [commit-sha]");
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
