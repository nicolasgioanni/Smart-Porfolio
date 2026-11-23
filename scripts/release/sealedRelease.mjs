import { createHash } from "node:crypto";
import { cp, lstat, mkdir, mkdtemp, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { verifyArtifactManifest } from "../artifactIntegrity.mjs";
import { parseProducer, readContentVersion } from "../writeContentVersion.mjs";

const digestPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
export const releaseManifestName = "release-integrity.json";
export const candidateName = "candidate.json";

function fail(message) { throw new Error(`Sealed release: ${message}`); }

function safeRelative(relativePath) {
  if (typeof relativePath !== "string" || !relativePath || relativePath.startsWith("/") || relativePath.includes("\\") || relativePath.split("/").some((part) => !part || part === "." || part === "..")) {
    fail(`unsafe path ${String(relativePath)}`);
  }
  return relativePath;
}

function isPrivateStaticPath(relativePath) {
  return /(^|\/)(?:\.env(?:\.[^/]*)?|functions|migrations|node_modules)(?:\/|$)/.test(relativePath) || /(^|\/)(?:wrangler\.jsonc|[^/]+\.sql)$/.test(relativePath);
}

function isAllowedSealedPath(relativePath) {
  return relativePath === candidateName || relativePath === "wrangler.jsonc" || relativePath === "sbom.cdx.json" || relativePath.startsWith("out/") || /^migrations\/\d+(?:_[^/]+)?\.sql$/.test(relativePath);
}

async function sha256(filePath) {
  const body = await readFile(filePath);
  return { sha256: createHash("sha256").update(body).digest("hex"), size: body.byteLength };
}

async function digestDirectory(directory) {
  const files = await listSealedFiles(directory);
  const digest = createHash("sha256");
  for (const file of files) digest.update(file.path).update("\0").update(await readFile(path.join(directory, file.path))).update("\0");
  return digest.digest("hex");
}

async function copyChecked(source, destination) {
  const sourceStat = await lstat(source);
  if (sourceStat.isSymbolicLink()) fail(`symbolic link is not allowed: ${source}`);
  if (sourceStat.isDirectory()) {
    await mkdir(destination, { recursive: true });
    for (const entry of await readdir(source, { withFileTypes: true })) await copyChecked(path.join(source, entry.name), path.join(destination, entry.name));
    return;
  }
  if (!sourceStat.isFile()) fail(`unsupported source entry: ${source}`);
  await mkdir(path.dirname(destination), { recursive: true });
  await cp(source, destination, { dereference: false, errorOnExist: true, force: false });
}

export async function listSealedFiles(rootDirectory, excluded = new Set()) {
  const root = path.resolve(rootDirectory);
  const files = [];
  async function visit(current) {
    for (const entry of (await readdir(current, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
      const absolute = path.join(current, entry.name);
      const relative = safeRelative(path.relative(root, absolute).split(path.sep).join("/"));
      if (excluded.has(relative)) continue;
      const entryStat = await lstat(absolute);
      if (entryStat.isSymbolicLink()) fail(`symbolic link is not allowed: ${relative}`);
      if (entryStat.isDirectory()) await visit(absolute);
      else if (entryStat.isFile()) files.push({ path: relative, ...await sha256(absolute) });
      else fail(`unsupported artifact entry: ${relative}`);
    }
  }
  await visit(root);
  return files.sort((a, b) => a.path.localeCompare(b.path));
}

export function parseCandidate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("candidate must be an object");
  const expected = ["contentHash", "contentSnapshotHash", "migrationsHash", "producer", "publicBuildInputDigest", "snapshotRecordDigest", "sourceCommit", "sourceMode", "target", "toolchain", "wranglerConfigHash"];
  const keys = Object.keys(value).sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) fail("candidate has unsupported fields");
  if (!commitPattern.test(value.sourceCommit)) fail("candidate sourceCommit is invalid");
  for (const key of ["contentHash", "contentSnapshotHash", "migrationsHash", "publicBuildInputDigest", "snapshotRecordDigest", "wranglerConfigHash"]) {
    if (!digestPattern.test(value[key])) fail(`candidate ${key} is invalid`);
  }
  if (!new Set(["local", "preview", "production"]).has(value.target)) fail("candidate target is invalid");
  if (!new Set(["templates", "remote"]).has(value.sourceMode) || (value.target === "local") !== (value.sourceMode === "templates")) fail("candidate target and source mode are incompatible");
  try { parseProducer(value.producer, value.target); } catch (error) { fail(error instanceof Error ? error.message : String(error)); }
  if (!value.toolchain || typeof value.toolchain !== "object" || Array.isArray(value.toolchain)) fail("candidate toolchain is invalid");
  const toolchainKeys = Object.keys(value.toolchain).sort();
  const expectedToolchain = ["compatibilityDate", "compatibilityFlags", "lockfileHash", "next", "node", "wrangler"];
  if (toolchainKeys.length !== expectedToolchain.length || toolchainKeys.some((key, index) => key !== expectedToolchain[index]) || !digestPattern.test(value.toolchain.lockfileHash) || !Array.isArray(value.toolchain.compatibilityFlags) || value.toolchain.compatibilityFlags.some((flag) => typeof flag !== "string" || !flag) || typeof value.toolchain.node !== "string" || typeof value.toolchain.next !== "string" || !/^\d+\.\d+\.\d+$/.test(value.toolchain.wrangler) || typeof value.toolchain.compatibilityDate !== "string") {
    fail("candidate toolchain is invalid");
  }
  return value;
}

export function parseReleaseManifest(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("manifest must be an object");
  const expected = ["algorithm", "candidate", "files", "schemaVersion"];
  const keys = Object.keys(value).sort();
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index]) || value.schemaVersion !== 1 || value.algorithm !== "sha256") fail("manifest schema is unsupported");
  const candidate = parseCandidate(value.candidate);
  if (!Array.isArray(value.files) || value.files.length === 0) fail("manifest has no files");
  const seen = new Set();
  const files = value.files.map((file) => {
    if (!file || typeof file !== "object" || Array.isArray(file) || Object.keys(file).sort().join(",") !== "path,sha256,size") fail("invalid file record");
    const filePath = safeRelative(file.path);
    if (seen.has(filePath)) fail(`duplicate file ${filePath}`);
    seen.add(filePath);
    if (!digestPattern.test(file.sha256) || !Number.isSafeInteger(file.size) || file.size < 0) fail(`invalid file record ${filePath}`);
    return { path: filePath, sha256: file.sha256, size: file.size };
  });
  return { schemaVersion: 1, algorithm: "sha256", candidate, files };
}

export async function packageSealedRelease({ outDirectory, configPath, migrationsDirectory, releaseDirectory, candidate, sbomPath, renameEntry = rename }) {
  const out = path.resolve(outDirectory);
  const config = path.resolve(configPath);
  const migrations = path.resolve(migrationsDirectory);
  const release = path.resolve(releaseDirectory);
  if (path.basename(release) !== "release" || [out, config, migrations].some((input) => input === release || input.startsWith(`${release}${path.sep}`) || release.startsWith(`${input}${path.sep}`))) fail("release directory must be a distinct dedicated release directory");
  if (!(await stat(out)).isDirectory()) fail("static export directory is missing");
  if (!sbomPath) fail("CycloneDX SBOM is required for every sealed release");
  for (const file of await listSealedFiles(out)) if (isPrivateStaticPath(file.path)) fail(`private deployment input is not allowed in static output: ${file.path}`);
  if ((await listSealedFiles(migrations)).some((file) => !/^\d+(?:_[^/]+)?\.sql$/.test(file.path))) fail("migrations directory contains an unsupported deployment input");
  parseCandidate(candidate);
  let existing;
  try { existing = await lstat(release); } catch (error) { if (error?.code !== "ENOENT") throw error; }
  if (existing) {
    if (existing.isSymbolicLink() || !existing.isDirectory()) fail("release directory is unsafe");
    try { await verifySealedRelease(release); } catch { fail("refusing to replace an unowned release directory"); }
  }
  const staging = await mkdtemp(path.join(path.dirname(release), ".release-staging-"));
  let previous;
  let previousOwnsRelease = false;
  try {
    await Promise.all([
      copyChecked(out, path.join(staging, "out")),
      copyChecked(config, path.join(staging, "wrangler.jsonc")),
      copyChecked(migrations, path.join(staging, "migrations")),
      copyChecked(path.resolve(sbomPath), path.join(staging, "sbom.cdx.json"))
    ]);
    await writeFile(path.join(staging, candidateName), `${JSON.stringify(candidate, null, 2)}\n`, "utf8");
    const manifest = { schemaVersion: 1, algorithm: "sha256", candidate, files: await listSealedFiles(staging) };
    parseReleaseManifest(manifest);
    await writeFile(path.join(staging, releaseManifestName), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
    if (existing) {
      previous = await mkdtemp(path.join(path.dirname(release), ".release-previous-"));
      await rm(previous, { force: true, recursive: true });
      await renameEntry(release, previous);
      previousOwnsRelease = true;
    }
    try {
      await renameEntry(staging, release);
    } catch (promotionError) {
      if (!previousOwnsRelease) throw promotionError;
      try {
        await renameEntry(previous, release);
        previous = undefined;
        previousOwnsRelease = false;
      } catch (restoreError) {
        throw new AggregateError([promotionError, restoreError], `release promotion failed; prior sealed package remains at ${previous}`);
      }
      throw promotionError;
    }
    if (previous) {
      await rm(previous, { force: true, recursive: true });
      previous = undefined;
      previousOwnsRelease = false;
    }
    return manifest;
  } finally {
    await rm(staging, { force: true, recursive: true });
    if (previous && !previousOwnsRelease) await rm(previous, { force: true, recursive: true });
  }
}

async function verifyDeployableInputs(release, candidate, actual) {
  const paths = new Set(actual.map((file) => file.path));
  for (const required of ["out/_worker.js", "out/_routes.json", "out/artifact-integrity.json", "out/content-version.json", "wrangler.jsonc", "sbom.cdx.json"]) if (!paths.has(required)) fail(`release is missing ${required}`);
  if (![...paths].some((file) => /^migrations\/\d+(?:_[^/]+)?\.sql$/.test(file))) fail("release has no SQL migrations");
  if ((await sha256(path.join(release, "wrangler.jsonc"))).sha256 !== candidate.wranglerConfigHash) fail("candidate Wrangler configuration hash does not match the sealed configuration");
  if (await digestDirectory(path.join(release, "migrations")) !== candidate.migrationsHash) fail("candidate migrations hash does not match the sealed migrations");
  const contentVersion = await readContentVersion(path.join(release, "out", "content-version.json"));
  if (contentVersion.schemaVersion !== 2 || contentVersion.commitSha !== candidate.sourceCommit || contentVersion.contentHash !== candidate.contentHash || contentVersion.target !== candidate.target || contentVersion.publicBuildInputDigest !== candidate.publicBuildInputDigest || JSON.stringify(contentVersion.producer) !== JSON.stringify(candidate.producer)) fail("sealed content version does not match the candidate");
  await verifyArtifactManifest(path.join(release, "out"), candidate.sourceCommit);
  let sbom;
  try { sbom = JSON.parse(await readFile(path.join(release, "sbom.cdx.json"), "utf8")); } catch { fail("sealed SBOM is not valid JSON"); }
  if (sbom?.bomFormat !== "CycloneDX") fail("sealed SBOM is not CycloneDX");
}

export async function verifySealedRelease(releaseDirectory, expected = {}) {
  const release = path.resolve(releaseDirectory);
  const manifest = parseReleaseManifest(JSON.parse(await readFile(path.join(release, releaseManifestName), "utf8")));
  const candidate = parseCandidate(JSON.parse(await readFile(path.join(release, candidateName), "utf8")));
  if (JSON.stringify(candidate) !== JSON.stringify(manifest.candidate)) fail("candidate does not match manifest");
  for (const [expectedKey, candidateKey] of [["sourceCommit", "sourceCommit"], ["contentHash", "contentHash"], ["sourceMode", "sourceMode"], ["target", "target"], ["publicBuildInputDigest", "publicBuildInputDigest"], ["snapshotRecordDigest", "snapshotRecordDigest"]]) {
    if (expected[expectedKey] && candidate[candidateKey] !== expected[expectedKey]) fail(`${expectedKey} does not match expected candidate`);
  }
  const actual = await listSealedFiles(release, new Set([releaseManifestName]));
  if (actual.some((file) => !isAllowedSealedPath(file.path))) fail("release contains unsealed source or an unsupported deployment input");
  if (actual.length !== manifest.files.length) fail("file count does not match manifest");
  for (let index = 0; index < actual.length; index += 1) {
    const found = actual[index];
    const expectedFile = manifest.files[index];
    if (!expectedFile || found.path !== expectedFile.path || found.sha256 !== expectedFile.sha256 || found.size !== expectedFile.size) fail(`integrity verification failed for ${found.path}`);
  }
  if (!actual.some((file) => file.path === "out/_worker.js")) fail("compiled worker is missing from static deploy directory");
  if (actual.some((file) => file.path.startsWith("out/") && isPrivateStaticPath(file.path.slice("out/".length)))) fail("private deployment input leaked into static output");
  await verifyDeployableInputs(release, candidate, actual);
  return manifest;
}
