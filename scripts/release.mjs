import { buildAcceptedSnapshot, compileReleaseOutput, createSealedPackage, parseGeneration, verifyPackagedRuntime } from "./release/lifecycle.mjs";
import { verifySealedRelease } from "./release/sealedRelease.mjs";

const commitPattern = /^[a-f0-9]{40}$/;
const digestPattern = /^[a-f0-9]{64}$/;

function parseOptions(args) {
  const options = {};
  for (let index = 0; index < args.length; index += 2) {
    const key = args[index];
    const value = args[index + 1];
    const name = key?.slice(2);
    if (!key?.startsWith("--") || !name || value === undefined || Object.hasOwn(options, name)) throw new Error("Release options must be unique --name value pairs");
    options[name] = value;
  }
  return options;
}

function requireOption(options, key) {
  if (!options[key]) throw new Error(`Missing required --${key} option`);
  return options[key];
}

function rejectUnknown(options, allowed) {
  for (const key of Object.keys(options)) if (!allowed.has(key)) throw new Error(`Unsupported release option --${key}`);
}

function identity(options, { snapshot = false, generation = false } = {}) {
  const sourceCommit = requireOption(options, "sha");
  const target = requireOption(options, "target");
  const publicBuildInputDigest = requireOption(options, "public-build-input-digest");
  if (!commitPattern.test(sourceCommit)) throw new Error("Release --sha must be a full lowercase commit SHA");
  if (!new Set(["local", "preview", "production"]).has(target)) throw new Error("Release --target must be local, preview, or production");
  if (!digestPattern.test(publicBuildInputDigest)) throw new Error("Release --public-build-input-digest must be a SHA-256 digest");
  const result = { sourceCommit, target, publicBuildInputDigest };
  if (snapshot) {
    result.snapshotPath = requireOption(options, "snapshot");
    result.snapshotDigest = requireOption(options, "snapshot-sha");
    result.snapshotRecordDigest = requireOption(options, "snapshot-record-digest");
    if (!digestPattern.test(result.snapshotDigest)) throw new Error("Release --snapshot-sha must be a SHA-256 digest");
    if (!digestPattern.test(result.snapshotRecordDigest)) throw new Error("Release --snapshot-record-digest must be a SHA-256 digest");
  }
  if (generation) result.producer = parseGeneration(requireOption(options, "generation"), target);
  return result;
}

async function run() {
  const [command, ...args] = process.argv.slice(2);
  const options = parseOptions(args);
  if (command === "build") {
    rejectUnknown(options, new Set(["snapshot", "snapshot-sha", "snapshot-record-digest", "sha", "target", "public-build-input-digest", "generation"]));
    await buildAcceptedSnapshot(identity(options, { snapshot: true, generation: true }));
    return;
  }
  if (command === "compile") {
    rejectUnknown(options, new Set(["out", "sha"]));
    await compileReleaseOutput({ outDirectory: requireOption(options, "out"), sourceCommit: requireOption(options, "sha") });
    return;
  }
  if (command === "package") {
    rejectUnknown(options, new Set(["directory", "out", "snapshot-sha", "snapshot-record-digest", "sha", "target", "public-build-input-digest", "generation"]));
    const candidate = identity(options, { generation: true });
    await createSealedPackage({ ...candidate, snapshotDigest: requireOption(options, "snapshot-sha"), snapshotRecordDigest: requireOption(options, "snapshot-record-digest"), outDirectory: requireOption(options, "out"), releaseDirectory: requireOption(options, "directory") });
    return;
  }
  if (command === "runtime") {
    rejectUnknown(options, new Set(["directory"]));
    await verifyPackagedRuntime({ releaseDirectory: requireOption(options, "directory") });
    return;
  }
  if (command === "verify") {
    rejectUnknown(options, new Set(["directory", "sha", "content-hash", "target", "public-build-input-digest"]));
    const expected = {};
    if (options.sha) expected.sourceCommit = options.sha;
    if (options["content-hash"]) expected.contentHash = options["content-hash"];
    if (options.target) expected.target = options.target;
    if (options["public-build-input-digest"]) expected.publicBuildInputDigest = options["public-build-input-digest"];
    await verifySealedRelease(requireOption(options, "directory"), expected);
    return;
  }
  throw new Error("Usage: release:build -- --snapshot <path> --snapshot-sha <sha256> --snapshot-record-digest <sha256> --sha <candidate-sha> --target <local|preview|production> --public-build-input-digest <sha256> --generation <local|runId:runNumber:attempt>; release:compile -- --out <directory> --sha <candidate-sha>; release:package -- --directory <release> --out <directory> --snapshot-sha <sha256> --snapshot-record-digest <sha256> --sha <candidate-sha> --target <target> --public-build-input-digest <sha256> --generation <generation>; release:runtime -- --directory <release>");
}

run().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
