import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const digestPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const localPublicTurnstileKey = "local-release-test-turnstile-site-key";

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalize(value[key])]));
  }
  return value;
}

export function canonicalJson(value) {
  return JSON.stringify(canonicalize(value));
}

export function effectivePublicBuildEnvironment(target, environment = process.env) {
  if (!new Set(["local", "preview", "production"]).has(target)) {
    throw new Error("Public build target must be local, preview, or production");
  }
  if (target === "local") {
    return { NEXT_PUBLIC_TURNSTILE_SITE_KEY: localPublicTurnstileKey };
  }
  const sourceName = target === "preview"
    ? "NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY"
    : "NEXT_PUBLIC_TURNSTILE_SITE_KEY";
  const value = environment[sourceName];
  // Preview already supports a disabled contact widget when its distinct key
  // is absent. Preserve that contract; never borrow the production key.
  if (target === "preview" && (value === undefined || value === "")) {
    return { NEXT_PUBLIC_TURNSTILE_SITE_KEY: "" };
  }
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`A non-empty ${sourceName} is required for a ${target} public build`);
  }
  return { NEXT_PUBLIC_TURNSTILE_SITE_KEY: value };
}

function exactObject(value, keys, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} must be an object`);
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} has unsupported fields`);
  }
  return value;
}

export function parsePublicBuildInputs(value) {
  exactObject(value, ["keyDigest", "lockfileDigest", "nextVersion", "nodeVersion", "schemaVersion", "sourceCommit", "target", "wranglerConfigDigest", "wranglerVersion"], "Public build inputs");
  if (value.schemaVersion !== 1) throw new Error("Public build inputs schema is unsupported");
  if (!new Set(["local", "preview", "production"]).has(value.target)) throw new Error("Public build inputs target is invalid");
  if (!commitPattern.test(value.sourceCommit)) throw new Error("Public build inputs source commit is invalid");
  for (const key of ["keyDigest", "lockfileDigest", "wranglerConfigDigest"]) {
    if (!digestPattern.test(value[key])) throw new Error(`Public build inputs ${key} is invalid`);
  }
  for (const key of ["nodeVersion", "nextVersion", "wranglerVersion"]) {
    if (typeof value[key] !== "string" || !value[key]) throw new Error(`Public build inputs ${key} is invalid`);
  }
  return value;
}

export function publicBuildInputDigest(inputs) {
  return sha256(canonicalJson(parsePublicBuildInputs(inputs)));
}

async function readJson(filePath) {
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch (error) {
    if (error instanceof SyntaxError) throw new Error(`${filePath} is not valid JSON`);
    throw error;
  }
}

/**
 * Reads only build identities. The public key itself is represented by a
 * digest so candidates can prove an input change without publishing it.
 */
export async function collectPublicBuildInputs({
  projectRoot = process.cwd(),
  target,
  sourceCommit,
  environment = process.env
}) {
  if (!commitPattern.test(sourceCommit ?? "")) throw new Error("Public build source commit must be a full lowercase SHA");
  const root = path.resolve(projectRoot);
  const [packageJson, packageLock, config, nextPackage, wranglerPackage] = await Promise.all([
    readJson(path.join(root, "package.json")),
    readJson(path.join(root, "package-lock.json")),
    readFile(path.join(root, "wrangler.jsonc")),
    readJson(path.join(root, "node_modules", "next", "package.json")),
    readJson(path.join(root, "node_modules", "wrangler", "package.json"))
  ]);
  const declaredWrangler = packageJson.devDependencies?.wrangler;
  const lockedWrangler = packageLock.packages?.[""]?.devDependencies?.wrangler;
  if (!/^\d+\.\d+\.\d+$/.test(declaredWrangler ?? "") || declaredWrangler !== lockedWrangler || declaredWrangler !== wranglerPackage.version) {
    throw new Error("Public build inputs require matching declared, locked, and installed Wrangler versions");
  }
  const publicEnvironment = effectivePublicBuildEnvironment(target, environment);
  return parsePublicBuildInputs({
    schemaVersion: 1,
    target,
    sourceCommit,
    keyDigest: sha256(publicEnvironment.NEXT_PUBLIC_TURNSTILE_SITE_KEY),
    lockfileDigest: sha256(await readFile(path.join(root, "package-lock.json"))),
    wranglerConfigDigest: sha256(config),
    nodeVersion: process.version,
    nextVersion: nextPackage.version,
    wranglerVersion: wranglerPackage.version
  });
}

async function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if (command !== "fingerprint" || args.length !== 4 || args[0] !== "--target" || args[2] !== "--sha") {
    throw new Error("Usage: node scripts/release/publicBuildInputs.mjs fingerprint --target <local|preview|production> --sha <candidate-sha>");
  }
  const inputs = await collectPublicBuildInputs({ target: args[1], sourceCommit: args[3] });
  console.log(publicBuildInputDigest(inputs));
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
