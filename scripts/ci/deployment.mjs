import { execFile } from "node:child_process";
import { readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";
import { assertDigest, exactKeys, recordDigest, sealedReleaseValidators, securityJobs } from "./plan.mjs";
import { currentProducer, digestFile, jsonEnvironment, writeRecord } from "./context.mjs";
import { verifyAcceptedInputs } from "./consume.mjs";
import { assertReleaseProducer, restoreSealedCandidate } from "./releaseStages.mjs";
import { downloadArtifact } from "./artifactTransport.mjs";
import { readBranchTip } from "./resolve.mjs";
import {
  approvedPagesOrigin,
  readDeployedIdentity,
  reviewedPagesDomain,
  reviewedPagesProductionBranch,
  reviewedPagesProjectName
} from "./deployedIdentity.mjs";
import { verifyCloudflarePagesProject } from "./cloudflarePagesPreflight.mjs";
import { decideDeployment, sameDeploymentIdentity, smokeDeployment } from "../checkDeployedContent.mjs";
import { readContentVersion } from "../writeContentVersion.mjs";
import { verifySealedRelease } from "../release/sealedRelease.mjs";
import { validateRuntimeConfig } from "../release/runtimeConfig.mjs";
import { verifyTrustedAttestation } from "../security/verifyAttestation.mjs";

const execute = promisify(execFile);
export function assertDeploymentAcceptance(plan, acceptance, reference) {
  if (plan.mode !== "full" || !plan.deploy || plan.target === "local" || plan.candidate.event === "pull_request") throw new Error("Candidate is ineligible for deployment.");
  exactKeys(acceptance, ["schemaVersion", "accepted", "deploy", "mode", "candidateDigest", "planDigest", "snapshot", "release", "receiptDigests", "summaries"], "Release acceptance");
  if (acceptance.schemaVersion !== 1 || acceptance.accepted !== true || acceptance.deploy !== true || acceptance.mode !== "full" ||
      acceptance.candidateDigest !== recordDigest(plan.candidate) || acceptance.planDigest !== recordDigest(plan) ||
      acceptance.snapshot?.recordDigest !== plan.snapshotDigest || recordDigest(acceptance.release) !== recordDigest(reference)) throw new Error("Release acceptance differs from the exact candidate generation.");
  const validators = [...securityJobs, ...sealedReleaseValidators, "quality", "unit-integration", "chromium-1-of-2", "chromium-2-of-2",
    "visual-regression", "cross-browser", "build-and-package", "export-check"];
  exactKeys(acceptance.receiptDigests, validators, "Accepted release receipts");
  Object.values(acceptance.receiptDigests).forEach((digest) => assertDigest(digest, "Accepted receipt digest"));
}

export async function prepareDeployment({ environment = process.env, projectRoot = process.cwd() } = {}) {
  currentProducer("deploy", environment);
  const { root, plan } = await verifyAcceptedInputs({ environment, projectRoot });
  const reference = jsonEnvironment("CI_RELEASE_REFERENCE", environment), acceptance = jsonEnvironment("CI_ACCEPTANCE", environment);
  assertDeploymentAcceptance(plan, acceptance, reference);
  const archive = path.join(root, "accepted-release.zip");
  const sealed = await restoreSealedCandidate({ environment, projectRoot, download: async (...args) => {
    const bytes = await downloadArtifact(...args);
    await writeFile(archive, bytes, { flag: "wx", mode: 0o600 });
    return bytes;
  } });
  await writeRecord(root, "deployment.json", { schemaVersion: 1, reference: sealed.reference });
  return { archive_path: archive, sbom_path: path.join(sealed.directory, "sbom.cdx.json") };
}

export function validateDeploymentConfig(config, target) {
  if (!new Set(["production", "preview"]).has(target)) throw new Error("Invalid sealed Pages deployment target.");
  return validateRuntimeConfig(config, { target }).target.binding;
}

export function pagesDeploymentArguments({ target, sourceSha }) {
  return ["pages", "deploy", "out", "--project-name", reviewedPagesProjectName, "--branch",
    target === "production" ? reviewedPagesProductionBranch : "develop", "--commit-hash", sourceSha, "--commit-dirty=false", "--no-bundle"];
}

export function parseDeploymentOutput(text, { target, sourceSha }) {
  if (typeof text !== "string" || text.length > 256 * 1024) throw new Error("Wrangler deployment evidence is missing or oversized.");
  let records;
  try { records = text.trim().split("\n").map((line) => JSON.parse(line)); }
  catch { throw new Error("Wrangler deployment evidence is malformed."); }
  if (records.length !== 3 || records.some((record) => !record || typeof record !== "object" || Array.isArray(record))) throw new Error("Wrangler emitted unknown or missing deployment records.");
  const sessions = records.filter((record) => record.type === "wrangler-session");
  if (sessions.length !== 1) throw new Error("Wrangler session identity is missing or duplicated.");
  const session = sessions[0];
  exactKeys(session, ["type", "version", "wrangler_version", "command_line_args", "log_file_path", "timestamp"], "Wrangler session");
  if (session.version !== 1 || session.wrangler_version !== "4.148.0" ||
      recordDigest(session.command_line_args) !== recordDigest(pagesDeploymentArguments({ target, sourceSha })) ||
      typeof session.log_file_path !== "string" || !session.log_file_path) throw new Error("Wrangler session tool version or operation differs from the reviewed upload.");
  for (const record of records) if (typeof record.timestamp !== "string" || !Number.isFinite(Date.parse(record.timestamp))) throw new Error("Wrangler output timestamp is invalid.");
  const details = records.filter((record) => record.type === "pages-deploy-detailed");
  const brief = records.filter((record) => record.type === "pages-deploy");
  if (details.length !== 1 || brief.length !== 1) throw new Error("Wrangler did not identify exactly one deployment.");
  const value = details[0];
  exactKeys(brief[0], ["type", "version", "pages_project", "deployment_id", "url", "timestamp"], "Wrangler deployment");
  exactKeys(value, ["type", "version", "pages_project", "deployment_id", "url", "timestamp", "environment",
    "production_branch", "deployment_trigger", ...(Object.hasOwn(value, "alias") ? ["alias"] : [])], "Wrangler detailed deployment");
  exactKeys(value.deployment_trigger, ["metadata"], "Wrangler deployment trigger");
  exactKeys(value.deployment_trigger.metadata, ["commit_hash"], "Wrangler deployment source");
  if (Object.hasOwn(value, "alias") && (typeof value.alias !== "string" || !new RegExp(`^https://(?:[a-z0-9-]+\\.)?${reviewedPagesDomain.replaceAll(".", "\\.")}/?$`).test(value.alias))) throw new Error("Wrangler deployment alias is malformed.");
  if (value.version !== 1 || brief[0].version !== 1 || value.pages_project !== reviewedPagesProjectName ||
      brief[0].pages_project !== value.pages_project || brief[0].deployment_id !== value.deployment_id || brief[0].url !== value.url ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(value.deployment_id) ||
      !new RegExp(`^https://[a-f0-9]{8}\\.${reviewedPagesDomain.replaceAll(".", "\\.")}/?$`).test(value.url) ||
      value.environment !== target || value.production_branch !== reviewedPagesProductionBranch ||
      value.deployment_trigger?.metadata?.commit_hash !== sourceSha) throw new Error("Wrangler deployed a different project, target, source or deployment host.");
  return value.url.replace(/\/$/, "");
}

async function command(command, args, options) {
  try { return await execute(command, args, { ...options, maxBuffer: 4 * 1024 * 1024, timeout: 15 * 60_000 }); }
  catch { throw new Error(`Deployment ${path.basename(command)} operation failed. No provider details were published.`); }
}

export async function verifyReleaseProvenance({ archive, plan, environment, executeCommand = command }) {
  const certificate = `https://github.com/${plan.candidate.repository}/.github/workflows/ci.yml@${plan.candidate.ref}`;
  for (const predicate of [null, "https://cyclonedx.org/bom"]) {
    const args = ["attestation", "verify", archive, "--repo", plan.candidate.repository,
      "--cert-identity", certificate, "--signer-digest", plan.candidate.workflowSha,
      "--source-digest", plan.candidate.sourceSha, "--source-ref", plan.candidate.ref,
      "--cert-oidc-issuer", "https://token.actions.githubusercontent.com", "--deny-self-hosted-runners", "--format", "json",
      ...(predicate ? ["--predicate-type", predicate] : [])];
    const result = await executeCommand("gh", args, { env: { ...environment, CLOUDFLARE_API_TOKEN: undefined, CLOUDFLARE_ACCOUNT_ID: undefined } });
    const verified = JSON.parse(result.stdout);
    verifyTrustedAttestation(verified, { repository: plan.candidate.repository, sourceRef: plan.candidate.ref, sourceSha: plan.candidate.sourceSha });
  }
}

// The workflow owns an environment-specific, non-cancelling lock around this
// whole operation. Checks are repeated across the migration/upload boundary;
// external administrator writes are not an atomic part of that GitHub lock.
export async function executeDeployment({ environment = process.env, projectRoot = process.cwd(),
  observe = readDeployedIdentity, branchTip = readBranchTip, executeCommand = command,
  verifyProvenance = verifyReleaseProvenance, preflight = verifyCloudflarePagesProject,
  smoke = smokeDeployment } = {}) {
  currentProducer("deploy", environment);
  const { root, plan, snapshot } = await verifyAcceptedInputs({ environment, projectRoot });
  const reference = jsonEnvironment("CI_RELEASE_REFERENCE", environment), acceptance = jsonEnvironment("CI_ACCEPTANCE", environment);
  assertDeploymentAcceptance(plan, acceptance, reference);
  const recorded = JSON.parse(await readFile(path.join(root, "deployment.json"), "utf8"));
  if (recorded.schemaVersion !== 1 || recordDigest(recorded.reference) !== recordDigest(reference)) throw new Error("Signing and deployment references differ.");
  const directory = path.join(root, "release"), out = path.join(directory, "out");
  const expected = { sourceCommit: plan.candidate.sourceSha, target: plan.target, contentHash: snapshot.contentHash,
    snapshotRecordDigest: plan.snapshotDigest, publicBuildInputDigest: snapshot.publicBuildInputDigest };
  const manifest = await verifySealedRelease(directory, expected);
  assertReleaseProducer(manifest, reference, plan);
  const candidate = await readContentVersion(path.join(out, "content-version.json"));
  const origin = approvedPagesOrigin(plan.target, environment), branch = plan.target === "production" ? "main" : "develop";
  const sealedConfig = JSON.parse(await readFile(path.join(directory, "wrangler.jsonc"), "utf8"));
  const runtime = validateRuntimeConfig(sealedConfig, { target: plan.target, toolchain: manifest.candidate.toolchain });
  const binding = runtime.target.binding;
  if (!environment.GH_TOKEN || !environment.CLOUDFLARE_API_TOKEN || !/^[a-f0-9]{32}$/.test(environment.CLOUDFLARE_ACCOUNT_ID ?? "")) throw new Error("Required deployment credentials are missing or invalid.");
  const archive = path.join(root, "accepted-release.zip");
  if (await digestFile(archive) !== reference.digest) throw new Error("Accepted release archive changed before provenance verification.");
  await preflight({ accountId: environment.CLOUDFLARE_ACCOUNT_ID, apiToken: environment.CLOUDFLARE_API_TOKEN });
  await verifyProvenance({ archive, plan, environment, executeCommand });
  const checkFresh = async () => {
    if (await branchTip(branch, { token: environment.GH_TOKEN }) !== plan.candidate.sourceSha) throw new Error("Protected branch advanced. Refusing stale deployment.");
    const deployed = await observe(plan.target, { environment });
    const decision = decideDeployment(candidate, deployed);
    if (decision.action === "fail-closed") throw new Error(`Deployment ordering rejected candidate: ${decision.reason}.`);
    return decision;
  };
  const first = await checkFresh();
  if (first.action !== "smoke-only") {
    const wrangler = path.join(projectRoot, "node_modules/wrangler/bin/wrangler.js");
    const providerEnvironment = { ...environment, GH_TOKEN: undefined, WRANGLER_LOG_SANITIZE: "true",
      // Wrangler otherwise creates .wrangler/cache below cwd when no ancestor
      // node_modules exists, which would mutate the accepted sealed release.
      WRANGLER_CACHE_DIR: path.join(root, "wrangler-cache"),
      CLOUDFLARE_LOAD_DEV_VARS_FROM_DOT_ENV: "false", WRANGLER_SEND_METRICS: "false" };
    await executeCommand(process.execPath, [wrangler, "d1", "migrations", "apply", binding.database_name,
      ...(plan.target === "preview" ? ["--env", "preview"] : []), "--remote"], { cwd: directory, env: providerEnvironment });
    await verifySealedRelease(directory, expected);
    const second = await checkFresh();
    if (second.action !== "smoke-only") {
      const output = path.join(root, "wrangler-deployment.jsonl");
      await executeCommand(process.execPath, [wrangler, ...pagesDeploymentArguments({ target: plan.target, sourceSha: plan.candidate.sourceSha })],
      { cwd: directory, env: { ...providerEnvironment, WRANGLER_OUTPUT_FILE_PATH: output } });
      const deployment = parseDeploymentOutput(await readFile(output, "utf8"), { target: plan.target, sourceSha: plan.candidate.sourceSha });
      await verifySealedRelease(directory, expected);
      await smoke(deployment, out, snapshot.contentHash, plan.candidate.sourceSha, environment.GITHUB_RUN_ID);
      if (!sameDeploymentIdentity(candidate, await observe(plan.target, { environment, exactDeployment: deployment }))) throw new Error("Exact uploaded deployment has a different producer identity.");
    }
  }
  await smoke(origin, out, snapshot.contentHash, plan.candidate.sourceSha, environment.GITHUB_RUN_ID);
  const after = await observe(plan.target, { environment });
  if (!sameDeploymentIdentity(candidate, after)) throw new Error("Post-deployment identity differs from the exact accepted generation. Inspect recovery guidance; no automatic rollback was attempted.");
  return { deployed: "true", target: plan.target };
}
