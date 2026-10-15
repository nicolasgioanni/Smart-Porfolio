import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const shaPattern = /^[a-f0-9]{40}$/;
const trustedTriggers = new Set(["push", "schedule", "workflow_dispatch"]);

function asObject(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value;
}

function expectedRepository(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(value)) throw new Error("Expected repository is invalid.");
  return value;
}

function certificateExtensions(entry) {
  const result = asObject(entry?.verificationResult, "Attestation verification result is missing.");
  const certificate = asObject(result.signature?.certificate, "Attestation certificate is missing.");
  // Current gh JSON can flatten Fulcio extensions into certificate. Accept the
  // nested certificate.extensions representation as well, never predicate data.
  const extensions = certificate.extensions === undefined
    ? certificate
    : asObject(certificate.extensions, "Attestation certificate extensions are missing.");
  return { certificate, extensions };
}

export function verifyTrustedAttestation(verified, { repository, sourceRef, sourceSha }) {
  expectedRepository(repository);
  if (typeof sourceRef !== "string" || !/^refs\/heads\/(?:main|develop)$/.test(sourceRef)) throw new Error("Expected protected source ref is invalid.");
  if (!shaPattern.test(sourceSha)) throw new Error("Expected source SHA is invalid.");
  if (!Array.isArray(verified) || verified.length === 0) throw new Error("No attestations were cryptographically verified.");

  return verified.map((entry) => {
    asObject(entry, "Verified attestation is malformed.");
    const { certificate, extensions } = certificateExtensions(entry);
    if (certificate.issuer !== "https://token.actions.githubusercontent.com") throw new Error("Attestation OIDC issuer is not GitHub Actions.");
    // sigstore-go serializes this as sourceRepositoryURI in current gh output;
    // older output represented it as sourceRepository inside extensions.
    const sourceRepository = extensions.sourceRepositoryURI ?? extensions.sourceRepository;
    if (sourceRepository !== `https://github.com/${repository}`) throw new Error("Attestation certificate repository differs from the expected repository.");
    if (extensions.sourceRepositoryRef !== sourceRef) throw new Error("Attestation certificate source ref differs from the expected protected ref.");
    if (extensions.sourceRepositoryDigest !== sourceSha) throw new Error("Attestation certificate source SHA differs from the expected candidate.");
    if (!trustedTriggers.has(extensions.buildTrigger)) throw new Error("Attestation certificate build trigger is not trusted.");
    if (extensions.runnerEnvironment !== "github-hosted") throw new Error("Attestation certificate was not produced on a GitHub-hosted runner.");
    if (!Array.isArray(entry.verificationResult.verifiedTimestamps) || entry.verificationResult.verifiedTimestamps.length === 0) {
      throw new Error("Attestation has no verified timestamp evidence.");
    }
    return { repository: sourceRepository, sourceRef: extensions.sourceRepositoryRef, sourceSha: extensions.sourceRepositoryDigest, trigger: extensions.buildTrigger };
  });
}

function parseArgs(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const option = argv[index];
    const value = argv[index + 1];
    if (!option?.startsWith("--") || value === undefined || values.has(option)) throw new Error("Usage: node scripts/security/verifyAttestation.mjs --file <verified.json> --repo <owner/repo> --source-ref <ref> --source-sha <sha>");
    values.set(option, value);
  }
  const required = ["--file", "--repo", "--source-ref", "--source-sha"];
  if (values.size !== required.length || required.some((option) => !values.has(option))) throw new Error("Usage: node scripts/security/verifyAttestation.mjs --file <verified.json> --repo <owner/repo> --source-ref <ref> --source-sha <sha>");
  return { file: values.get("--file"), repository: values.get("--repo"), sourceRef: values.get("--source-ref"), sourceSha: values.get("--source-sha") };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const { file, ...expected } = parseArgs(process.argv.slice(2));
    const verified = JSON.parse(await readFile(file, "utf8"));
    verifyTrustedAttestation(verified, expected);
    console.log("Attestation certificate identity and trigger are trusted.");
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
