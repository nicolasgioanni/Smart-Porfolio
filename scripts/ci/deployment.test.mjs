// @vitest-environment node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createArtifactManifest } from "../artifactIntegrity.mjs";
import { collectPublicBuildInputs, publicBuildInputDigest } from "../release/publicBuildInputs.mjs";
import { packageSealedRelease } from "../release/sealedRelease.mjs";
import { assertDeploymentAcceptance, executeDeployment, pagesDeploymentArguments, parseDeploymentOutput, validateDeploymentConfig } from "./deployment.mjs";
import { artifactName } from "./githubEvidence.mjs";
import { createPlan, recordDigest, repository, sealedReleaseValidators, securityJobs, workflowPath } from "./plan.mjs";
import { createSnapshot, generatedContentPath } from "./snapshot.mjs";

const execute = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "../..");
const temporary = [];
const contentHash = "b".repeat(64);
const deploymentId = "01234567-89ab-4cde-8fab-0123456789ab";
const deploymentUrl = `https://${deploymentId.slice(0, 8)}.smart-portfolio-bds.pages.dev`;

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

function generatedBytes(label) {
  return Buffer.from(`${JSON.stringify({
    metadata: {
      contentHash,
      sourceMode: "remote",
      sources: {
        profile: "remote", links: "remote", research: "remote", projects: "remote", experience: "remote",
        recommendations: "remote", education: "remote", skills: "remote", site_settings: "remote", resume: "template"
      }
    },
    label
  })}\n`);
}

async function git(directory, ...args) {
  return execute("git", args, {
    cwd: directory,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }
  });
}

function candidate(sha) {
  const ref = "refs/heads/main";
  return {
    schemaVersion: 1,
    repository,
    event: "push",
    ref,
    workflowRef: `${repository}/${workflowPath}@${ref}`,
    workflowSha: sha,
    sourceSha: sha,
    eventSha: sha,
    runHeadSha: sha,
    branchTip: sha,
    pullNumber: null,
    baseBranch: null,
    force: false,
    runId: 741,
    runNumber: 18,
    producerAttempt: 1
  };
}

function receiptDigests() {
  return Object.fromEntries([
    ...securityJobs, ...sealedReleaseValidators,
    "quality", "unit-integration", "chromium-1-of-2", "chromium-2-of-2",
    "visual-regression", "cross-browser", "build-and-package", "export-check"
  ].map((name) => [name, "a".repeat(64)]));
}

function deploymentOutput({ target = "production", sourceSha, mutate = (records) => records } = {}) {
  const timestamp = "2026-10-12T00:00:00.000Z";
  const records = [
    {
      type: "wrangler-session",
      version: 1,
      wrangler_version: "4.148.0",
      command_line_args: pagesDeploymentArguments({ target, sourceSha }),
      log_file_path: "/tmp/wrangler.log",
      timestamp
    },
    {
      type: "pages-deploy",
      version: 1,
      pages_project: "smart-portfolio",
      deployment_id: deploymentId,
      url: deploymentUrl,
      timestamp
    },
    {
      type: "pages-deploy-detailed",
      version: 1,
      pages_project: "smart-portfolio",
      deployment_id: deploymentId,
      url: deploymentUrl,
      timestamp,
      environment: target,
      production_branch: "main",
      deployment_trigger: { metadata: { commit_hash: sourceSha } }
    }
  ];
  return mutate(records).map((record) => JSON.stringify(record)).join("\n");
}

function approvedPreflight() {
  return vi.fn().mockResolvedValue({
    name: "smart-portfolio",
    subdomain: "smart-portfolio-bds.pages.dev",
    productionBranch: "main",
    source: "direct-upload"
  });
}

async function directoryDigest(directory) {
  const name = "0001_fixture.sql";
  const bytes = await readFile(path.join(directory, name));
  return digest(Buffer.concat([Buffer.from(`${name}\0`), bytes, Buffer.from("\0")]));
}

async function deploymentFixture() {
  const parent = await mkdtemp(path.join(os.tmpdir(), "portfolio-deployment-runner-"));
  temporary.push(parent);
  const root = path.join(parent, "repository");
  const runnerTemp = path.join(parent, "runner-temp");
  const buildInput = path.join(parent, "build-input");
  await Promise.all([
    mkdir(path.join(root, "src/content/generated"), { recursive: true }),
    mkdir(runnerTemp, { recursive: true }),
    mkdir(path.join(buildInput, "out", "_next"), { recursive: true }),
    mkdir(path.join(buildInput, "migrations"), { recursive: true })
  ]);
  await Promise.all(["package.json", "package-lock.json", "wrangler.jsonc"].map((file) =>
    copyFile(path.join(projectRoot, file), path.join(root, file))
  ));
  await symlink(path.join(projectRoot, "node_modules"), path.join(root, "node_modules"), "dir");
  const accepted = generatedBytes("accepted");
  await writeFile(path.join(root, generatedContentPath), accepted);
  await git(root, "init", "-q");
  await git(root, "config", "user.name", "CI fixture");
  await git(root, "config", "user.email", "ci-fixture@example.invalid");
  await git(root, "add", "--all");
  await git(root, "commit", "-qm", "fixture");
  const { stdout } = await git(root, "rev-parse", "HEAD");
  const input = candidate(stdout.trim());
  const baseEnvironment = {
    NEXT_PUBLIC_TURNSTILE_SITE_KEY: "fixture-public-turnstile-key",
    CLOUDFLARE_PAGES_PROJECT_NAME: "smart-portfolio",
    CLOUDFLARE_PAGES_DOMAIN: "smart-portfolio-bds.pages.dev"
  };
  const publicInputs = await collectPublicBuildInputs({ projectRoot: root, target: "production", sourceCommit: input.sourceSha, environment: baseEnvironment });
  const snapshot = createSnapshot({
    bytes: accepted,
    candidate: input,
    producer: { runId: input.runId, runNumber: input.runNumber, attempt: 1, job: "prepare-content" },
    lockfileDigest: digest(await readFile(path.join(root, "package-lock.json"))),
    publicBuildInputDigest: publicBuildInputDigest(publicInputs)
  });
  const plan = createPlan(input, { snapshotDigest: recordDigest(snapshot) });
  const evidenceRoot = path.join(runnerTemp, "portfolio-ci");
  const snapshotDirectory = path.join(evidenceRoot, "snapshot");
  await mkdir(snapshotDirectory, { recursive: true });
  await writeFile(path.join(snapshotDirectory, "portfolio.generated.json"), accepted);
  await writeFile(path.join(snapshotDirectory, "snapshot.json"), `${JSON.stringify(snapshot)}\n`);
  await writeFile(path.join(evidenceRoot, "consumer.json"), `${JSON.stringify({ schemaVersion: 1, plan, snapshot, startedAt: Date.now() - 1 })}\n`);

  const out = path.join(buildInput, "out");
  const migrations = path.join(buildInput, "migrations");
  const config = path.join(buildInput, "wrangler.jsonc");
  const producer = { kind: "github-actions", runId: String(input.runId), runNumber: input.runNumber, attempt: 1 };
  const releaseCandidate = {
    sourceCommit: input.sourceSha,
    contentHash,
    contentSnapshotHash: digest(accepted),
    snapshotRecordDigest: plan.snapshotDigest,
    publicBuildInputDigest: snapshot.publicBuildInputDigest,
    migrationsHash: "0".repeat(64),
    wranglerConfigHash: "0".repeat(64),
    sourceMode: "remote",
    target: "production",
    producer,
    toolchain: {
      node: process.version,
      next: "16.4.0",
      wrangler: "4.148.0",
      compatibilityDate: "2026-08-27",
      compatibilityFlags: [],
      lockfileHash: digest(await readFile(path.join(root, "package-lock.json")))
    }
  };
  await Promise.all([
    writeFile(path.join(out, "index.html"), "<main>fixture</main>"),
    writeFile(path.join(out, "_worker.js"), "export default { fetch() { return new Response('fixture'); } };"),
    writeFile(path.join(out, "_routes.json"), '{"version":1,"include":["/api/contact","/api/contact/verify"],"exclude":[]}\n'),
    writeFile(path.join(out, "content-version.json"), `${JSON.stringify({
      schemaVersion: 2, commitSha: input.sourceSha, contentHash, generatedAt: "2026-10-12T00:00:00.000Z",
      deployedAt: "2026-10-12T00:00:01.000Z", target: "production", publicBuildInputDigest: snapshot.publicBuildInputDigest, producer
    })}\n`),
    writeFile(path.join(out, "_next", "fixture.js"), "export {};"),
    writeFile(path.join(migrations, "0001_fixture.sql"), "select 1;\n"),
    copyFile(path.join(root, "wrangler.jsonc"), config)
  ]);
  await createArtifactManifest(out);
  releaseCandidate.migrationsHash = await directoryDigest(migrations);
  releaseCandidate.wranglerConfigHash = digest(await readFile(config));
  const sbom = path.join(buildInput, "sbom.cdx.json");
  await writeFile(sbom, '{"bomFormat":"CycloneDX"}\n');
  const manifest = await packageSealedRelease({
    outDirectory: out,
    configPath: config,
    migrationsDirectory: migrations,
    releaseDirectory: path.join(evidenceRoot, "release"),
    candidate: releaseCandidate,
    sbomPath: sbom
  });
  const archive = Buffer.from("accepted release fixture archive");
  await writeFile(path.join(evidenceRoot, "accepted-release.zip"), archive);
  const reference = {
    schemaVersion: 1,
    id: 92,
    name: artifactName({ role: "release", validator: "candidate", producer: { runId: input.runId, runNumber: input.runNumber, attempt: 1, job: "build-and-package" } }),
    role: "release",
    digest: digest(archive),
    recordDigest: recordDigest(manifest),
    producer: { runId: input.runId, runNumber: input.runNumber, attempt: 1, job: "build-and-package" }
  };
  const acceptance = {
    schemaVersion: 1,
    accepted: true,
    deploy: true,
    mode: "full",
    candidateDigest: recordDigest(input),
    planDigest: recordDigest(plan),
    snapshot: { recordDigest: plan.snapshotDigest },
    release: reference,
    receiptDigests: receiptDigests(),
    summaries: {}
  };
  await writeFile(path.join(evidenceRoot, "deployment.json"), `${JSON.stringify({ schemaVersion: 1, reference })}\n`);
  const environment = {
    ...baseEnvironment,
    CI_CANDIDATE: JSON.stringify(input),
    CI_PLAN: JSON.stringify(plan),
    CI_RELEASE_REFERENCE: JSON.stringify(reference),
    CI_ACCEPTANCE: JSON.stringify(acceptance),
    GITHUB_SHA: input.eventSha,
    GITHUB_REPOSITORY: repository,
    GITHUB_RUN_ID: String(input.runId),
    GITHUB_RUN_NUMBER: String(input.runNumber),
    GITHUB_RUN_ATTEMPT: "2",
    GITHUB_JOB: "deploy",
    RUNNER_TEMP: runnerTemp,
    GH_TOKEN: "fixture-github-token",
    CLOUDFLARE_API_TOKEN: "fixture-cloudflare-token",
    CLOUDFLARE_ACCOUNT_ID: "1".repeat(32)
  };
  return {
    root,
    evidenceRoot,
    input,
    plan,
    snapshot,
    reference,
    acceptance,
    environment,
    identity: JSON.parse(await readFile(path.join(evidenceRoot, "release", "out", "content-version.json"), "utf8"))
  };
}

function providerCommand(calls) {
  return vi.fn(async (_command, args, options) => {
    calls.push({ args, options });
    // Model Wrangler's configuration-cache side effect in a hosted RUNNER_TEMP
    // checkout, where there is no ancestor node_modules cache directory.
    const cache = options.env.WRANGLER_CACHE_DIR ?? path.join(options.cwd, ".wrangler", "cache");
    await mkdir(cache, { recursive: true });
    await writeFile(path.join(cache, args.includes("pages") ? "pages.json" : "d1.json"), "{}\n");
    if (args.includes("pages")) {
      await writeFile(options.env.WRANGLER_OUTPUT_FILE_PATH, deploymentOutput({ sourceSha: args.at(-3) }));
    }
    return { stdout: "", stderr: "" };
  });
}

describe("deployment admission and provider evidence", () => {
  it("binds deploy acceptance to a deployable target, plan, and original release reference", () => {
    const input = candidate("a".repeat(40));
    const plan = createPlan(input, { snapshotDigest: "b".repeat(64) });
    const reference = { role: "release", recordDigest: "c".repeat(64), producer: { job: "build-and-package" } };
    const acceptance = {
      schemaVersion: 1, accepted: true, deploy: true, mode: "full", candidateDigest: recordDigest(input), planDigest: recordDigest(plan),
      snapshot: { recordDigest: plan.snapshotDigest }, release: reference, receiptDigests: receiptDigests(), summaries: {}
    };
    expect(() => assertDeploymentAcceptance(plan, acceptance, reference)).not.toThrow();
    expect(() => assertDeploymentAcceptance(plan, { ...acceptance, release: { ...reference, recordDigest: "d".repeat(64) } }, reference)).toThrow("exact candidate generation");
    const pullRequest = { ...input, event: "pull_request", ref: "refs/pull/123/merge", workflowRef: `${repository}/${workflowPath}@refs/pull/123/merge`, pullNumber: 123, baseBranch: "main", branchTip: null };
    const prPlan = createPlan(pullRequest, { snapshotDigest: "b".repeat(64) });
    expect(() => assertDeploymentAcceptance(prPlan, acceptance, reference)).toThrow("ineligible");
  });

  it("accepts only the pinned Wrangler 4.148.0 three-record JSONL result", () => {
    const sourceSha = "a".repeat(40);
    expect(parseDeploymentOutput(deploymentOutput({ sourceSha }), { target: "production", sourceSha })).toBe(deploymentUrl);
    for (const mutate of [
      (records) => [...records, { type: "notice" }],
      (records) => [{ ...records[0], wrangler_version: "4.148.1" }, ...records.slice(1)],
      (records) => [{ ...records[0], command_line_args: ["pages", "deploy"] }, ...records.slice(1)],
      (records) => [{ ...records[0], extra: true }, ...records.slice(1)],
      (records) => records.map((record) => record.url ? { ...record, url: record.url.replace("pages.dev", "pagesXdev") } : record),
      (records) => [...records.slice(0, 2), { ...records[2], alias: "https://develop.smart-portfolio-bds.pagesXdev" }],
      (records) => [...records.slice(0, 2), { ...records[2], deployment_trigger: { metadata: { commit_hash: "b".repeat(40) } } }]
    ]) {
      expect(() => parseDeploymentOutput(deploymentOutput({ sourceSha, mutate }), { target: "production", sourceSha })).toThrow();
    }
  });

  it("requires distinct, pinned D1 bindings for the selected Pages target", async () => {
    const config = JSON.parse(await readFile(path.join(projectRoot, "wrangler.jsonc"), "utf8"));
    expect(validateDeploymentConfig(config, "production")).toMatchObject({ database_name: "smart-portfolio-contact-rate-limit-production" });
    expect(validateDeploymentConfig(config, "preview")).toMatchObject({ database_name: "smart-portfolio-contact-rate-limit-preview" });
    const shared = structuredClone(config);
    shared.env.preview.d1_databases[0].database_id = shared.d1_databases[0].database_id;
    expect(() => validateDeploymentConfig(shared, "production")).toThrow("remain separate");
    const wrongMigration = structuredClone(config);
    wrongMigration.d1_databases[0].migrations_dir = "other";
    expect(() => validateDeploymentConfig(wrongMigration, "production")).toThrow("Invalid or unbound");
  });
});

describe("sealed deployment execution", () => {
  it("migrates, rechecks, uploads, smokes the unique host, then smokes the stable target", async () => {
    const fixture = await deploymentFixture();
    const calls = [];
    const executeCommand = providerCommand(calls);
    const branchTip = vi.fn().mockResolvedValue(fixture.input.sourceSha);
    const observe = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(fixture.identity)
      .mockResolvedValueOnce(fixture.identity);
    const verifyProvenance = vi.fn();
    const smoke = vi.fn();
    const preflight = approvedPreflight();

    await expect(executeDeployment({ environment: fixture.environment, projectRoot: fixture.root, observe, branchTip, executeCommand, verifyProvenance, preflight, smoke }))
      .resolves.toEqual({ deployed: "true", target: "production" });

    expect(calls).toHaveLength(2);
    expect(calls[0].args).toContain("d1");
    expect(calls[1].args).toEqual(expect.arrayContaining(["pages", "deploy", "--branch", "main", "--commit-hash", fixture.input.sourceSha]));
    expect(calls[0].options.env.GH_TOKEN).toBeUndefined();
    expect(calls.map(({ options }) => options.env.WRANGLER_CACHE_DIR)).toEqual([
      path.join(fixture.evidenceRoot, "wrangler-cache"), path.join(fixture.evidenceRoot, "wrangler-cache")
    ]);
    expect(verifyProvenance).toHaveBeenCalledOnce();
    expect(preflight).toHaveBeenCalledWith({
      accountId: fixture.environment.CLOUDFLARE_ACCOUNT_ID,
      apiToken: fixture.environment.CLOUDFLARE_API_TOKEN
    });
    expect(smoke.mock.calls.map(([url]) => url)).toEqual([deploymentUrl, "https://smart-portfolio-bds.pages.dev"]);
    expect(observe.mock.calls[2][1]).toMatchObject({ exactDeployment: deploymentUrl });
  });

  it("does not upload if the migration command fails", async () => {
    const fixture = await deploymentFixture();
    const executeCommand = vi.fn(async (_command, args) => {
      if (args.includes("d1")) throw new Error("fixture migration failure");
      throw new Error("Pages upload must not run after migration failure");
    });
    const smoke = vi.fn();

    await expect(executeDeployment({
      environment: fixture.environment,
      projectRoot: fixture.root,
      observe: vi.fn().mockResolvedValue(null),
      branchTip: vi.fn().mockResolvedValue(fixture.input.sourceSha),
      executeCommand,
      verifyProvenance: vi.fn(),
      preflight: approvedPreflight(),
      smoke
    })).rejects.toThrow("fixture migration failure");
    expect(executeCommand).toHaveBeenCalledOnce();
    expect(smoke).not.toHaveBeenCalled();
  });

  it("rejects a release reference whose producer differs from the sealed package", async () => {
    const fixture = await deploymentFixture();
    const reference = structuredClone(fixture.reference);
    reference.producer.attempt = 2;
    const acceptance = { ...fixture.acceptance, release: reference };
    const environment = {
      ...fixture.environment,
      CI_RELEASE_REFERENCE: JSON.stringify(reference),
      CI_ACCEPTANCE: JSON.stringify(acceptance)
    };
    await writeFile(path.join(fixture.evidenceRoot, "deployment.json"), `${JSON.stringify({ schemaVersion: 1, reference })}\n`);
    const executeCommand = vi.fn();
    const verifyProvenance = vi.fn();

    await expect(executeDeployment({
      environment,
      projectRoot: fixture.root,
      observe: vi.fn(),
      branchTip: vi.fn(),
      executeCommand,
      verifyProvenance,
      preflight: approvedPreflight(),
      smoke: vi.fn()
    })).rejects.toThrow("producer generation differ");
    expect(executeCommand).not.toHaveBeenCalled();
    expect(verifyProvenance).not.toHaveBeenCalled();
  });

  it("rejects a mutated accepted archive before provenance or provider access", async () => {
    const fixture = await deploymentFixture();
    await writeFile(path.join(fixture.evidenceRoot, "accepted-release.zip"), "tampered archive");
    const executeCommand = vi.fn();
    const verifyProvenance = vi.fn();

    await expect(executeDeployment({
      environment: fixture.environment,
      projectRoot: fixture.root,
      observe: vi.fn(),
      branchTip: vi.fn(),
      executeCommand,
      verifyProvenance,
      preflight: approvedPreflight(),
      smoke: vi.fn()
    })).rejects.toThrow("Accepted release archive changed");
    expect(executeCommand).not.toHaveBeenCalled();
    expect(verifyProvenance).not.toHaveBeenCalled();
  });

  it("fails after an uploaded deployment whose unique-host smoke check fails", async () => {
    const fixture = await deploymentFixture();
    const calls = [];
    const executeCommand = providerCommand(calls);
    const smoke = vi.fn(async (url) => {
      if (url === deploymentUrl) throw new Error("fixture post-upload smoke failure");
    });

    await expect(executeDeployment({
      environment: fixture.environment,
      projectRoot: fixture.root,
      observe: vi.fn().mockResolvedValue(null),
      branchTip: vi.fn().mockResolvedValue(fixture.input.sourceSha),
      executeCommand,
      verifyProvenance: vi.fn(),
      preflight: approvedPreflight(),
      smoke
    })).rejects.toThrow("fixture post-upload smoke failure");
    expect(calls.map(({ args }) => args.includes("pages"))).toContain(true);
    expect(smoke).toHaveBeenCalledTimes(1);
  });

  it("refuses an upload when the protected branch advances after migrations", async () => {
    const fixture = await deploymentFixture();
    const calls = [];
    const executeCommand = providerCommand(calls);
    const branchTip = vi.fn()
      .mockResolvedValueOnce(fixture.input.sourceSha)
      .mockResolvedValueOnce("d".repeat(40));

    await expect(executeDeployment({
      environment: fixture.environment,
      projectRoot: fixture.root,
      observe: vi.fn().mockResolvedValue(null),
      branchTip,
      executeCommand,
      verifyProvenance: vi.fn(),
      preflight: approvedPreflight(),
      smoke: vi.fn()
    })).rejects.toThrow("Protected branch advanced");
    expect(calls).toHaveLength(1);
    expect(calls[0].args).toContain("d1");
  });

  it("blocks a same-SHA candidate when a newer deployed generation already exists", async () => {
    const fixture = await deploymentFixture();
    const newer = structuredClone(fixture.identity);
    newer.producer = { ...newer.producer, runId: "742", runNumber: fixture.identity.producer.runNumber + 1 };
    const executeCommand = vi.fn();

    await expect(executeDeployment({
      environment: fixture.environment,
      projectRoot: fixture.root,
      observe: vi.fn().mockResolvedValue(newer),
      branchTip: vi.fn().mockResolvedValue(fixture.input.sourceSha),
      executeCommand,
      verifyProvenance: vi.fn(),
      preflight: approvedPreflight(),
      smoke: vi.fn()
    })).rejects.toThrow("candidate-generation-is-older");
    expect(executeCommand).not.toHaveBeenCalled();
  });

  it("performs only stable-target smoke and final identity verification for an exact deployed candidate", async () => {
    const fixture = await deploymentFixture();
    const executeCommand = vi.fn();
    const smoke = vi.fn();

    await expect(executeDeployment({
      environment: fixture.environment,
      projectRoot: fixture.root,
      observe: vi.fn().mockResolvedValue(fixture.identity),
      branchTip: vi.fn().mockResolvedValue(fixture.input.sourceSha),
      executeCommand,
      verifyProvenance: vi.fn(),
      preflight: approvedPreflight(),
      smoke
    })).resolves.toEqual({ deployed: "true", target: "production" });
    expect(executeCommand).not.toHaveBeenCalled();
    expect(smoke.mock.calls.map(([url]) => url)).toEqual(["https://smart-portfolio-bds.pages.dev"]);
  });

  it("rejects missing deployment credentials before provenance or provider calls", async () => {
    const fixture = await deploymentFixture();
    const environment = { ...fixture.environment, GH_TOKEN: "" };
    const observe = vi.fn();
    const branchTip = vi.fn();
    const executeCommand = vi.fn();
    const verifyProvenance = vi.fn();
    const preflight = vi.fn();

    await expect(executeDeployment({ environment, projectRoot: fixture.root, observe, branchTip, executeCommand, verifyProvenance, preflight, smoke: vi.fn() }))
      .rejects.toThrow("Required deployment credentials");
    expect(observe).not.toHaveBeenCalled();
    expect(branchTip).not.toHaveBeenCalled();
    expect(executeCommand).not.toHaveBeenCalled();
    expect(verifyProvenance).not.toHaveBeenCalled();
    expect(preflight).not.toHaveBeenCalled();
  });

  it("rejects a provider-target mismatch before attestation, migration, or upload commands", async () => {
    const fixture = await deploymentFixture();
    const executeCommand = vi.fn();
    const verifyProvenance = vi.fn();
    const preflight = vi.fn().mockRejectedValue(new Error("Cloudflare Pages preflight rejected the reviewed deployment target."));
    const branchTip = vi.fn();
    const observe = vi.fn();

    await expect(executeDeployment({
      environment: fixture.environment,
      projectRoot: fixture.root,
      observe,
      branchTip,
      executeCommand,
      verifyProvenance,
      preflight,
      smoke: vi.fn()
    })).rejects.toThrow("Cloudflare Pages preflight rejected the reviewed deployment target.");
    expect(preflight).toHaveBeenCalledOnce();
    expect(executeCommand).not.toHaveBeenCalled();
    expect(verifyProvenance).not.toHaveBeenCalled();
    expect(branchTip).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
  });
});
