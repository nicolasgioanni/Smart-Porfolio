// @vitest-environment node

import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { copyFile, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { afterEach, describe, expect, it, vi } from "vitest";
import { browserAssignment } from "./browserRun.mjs";
import { restoreAcceptedInputs, verifyAcceptedInputs } from "./consume.mjs";
import { artifactName } from "./githubEvidence.mjs";
import { allowedBrowserSkips } from "./browserSkips.mjs";
import { createPlan, recordDigest, repository, workflowPath } from "./plan.mjs";
import { prepareCandidate } from "./prepare.mjs";
import { assertReleaseProducer } from "./releaseStages.mjs";
import { testIdentity } from "./receipts.mjs";
import { uploadedReference } from "./run.mjs";
import { createSnapshot, generatedContentPath } from "./snapshot.mjs";
import { collectPublicBuildInputs, publicBuildInputDigest } from "../release/publicBuildInputs.mjs";

const execute = promisify(execFile);
const projectRoot = path.resolve(import.meta.dirname, "../..");
const temporary = [];
const contentHash = "b".repeat(64);

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

function generatedBytes(label) {
  return Buffer.from(`${JSON.stringify({
    metadata: { contentHash, sourceMode: "templates", sources: { profile: "template", links: "template" } },
    label
  })}\n`);
}

async function git(directory, ...args) {
  return execute("git", args, {
    cwd: directory,
    env: { ...process.env, GIT_CONFIG_GLOBAL: "/dev/null", GIT_CONFIG_NOSYSTEM: "1" }
  });
}

async function createFixture() {
  const parent = await mkdtemp(path.join(os.tmpdir(), "portfolio-ci-runner-"));
  temporary.push(parent);
  const root = path.join(parent, "repository");
  const runnerTemp = path.join(parent, "runner-temp");
  await Promise.all([
    mkdir(path.join(root, "src/content/generated"), { recursive: true }),
    mkdir(runnerTemp, { recursive: true })
  ]);
  await Promise.all(["package.json", "package-lock.json", "wrangler.jsonc"].map((file) =>
    copyFile(path.join(projectRoot, file), path.join(root, file))
  ));
  await symlink(path.join(projectRoot, "node_modules"), path.join(root, "node_modules"), "dir");
  await writeFile(path.join(root, generatedContentPath), generatedBytes("checked-in"));
  await git(root, "init", "-q");
  await git(root, "config", "user.name", "CI fixture");
  await git(root, "config", "user.email", "ci-fixture@example.invalid");
  await git(root, "add", "--all");
  await git(root, "commit", "-qm", "fixture");
  const { stdout } = await git(root, "rev-parse", "HEAD");
  return { root, runnerTemp, sha: stdout.trim() };
}

function candidate(sha, { event = "pull_request", branchTip, force = false } = {}) {
  const isPr = event === "pull_request";
  const ref = isPr ? "refs/pull/123/merge" : "refs/heads/main";
  return {
    schemaVersion: 1,
    repository,
    event,
    ref,
    workflowRef: `${repository}/${workflowPath}@${ref}`,
    workflowSha: sha,
    sourceSha: sha,
    eventSha: sha,
    runHeadSha: sha,
    branchTip: isPr ? null : (branchTip ?? sha),
    pullNumber: isPr ? 123 : null,
    baseBranch: isPr ? "main" : null,
    force,
    runId: 741,
    runNumber: 18,
    producerAttempt: 1
  };
}

function environmentFor(input, fixture, { job = "prepare-content", attempt = "1", extra = {} } = {}) {
  return {
    CI_CANDIDATE: JSON.stringify(input),
    GITHUB_SHA: input.eventSha,
    GITHUB_REPOSITORY: repository,
    GITHUB_RUN_ID: String(input.runId),
    GITHUB_RUN_NUMBER: String(input.runNumber),
    GITHUB_RUN_ATTEMPT: attempt,
    GITHUB_JOB: job,
    RUNNER_TEMP: fixture.runnerTemp,
    ...extra
  };
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function browserDiscovery() {
  const optional = Object.keys(allowedBrowserSkips);
  const visual = testIdentity({
    project: "chromium", file: "tests/e2e/skeletons.visual.spec.ts", titlePath: ["matches reviewed skeletons"]
  });
  const entries = {
    full: [...optional, visual],
    "chromium-1-of-2": optional.slice(0, 6),
    "chromium-2-of-2": optional.slice(6),
    "visual-regression": [visual]
  };
  const chromium = {
    schemaVersion: 1,
    project: "chromium",
    discoveryDigest: recordDigest([...entries.full].sort()),
    assignments: Object.fromEntries(Object.entries(entries).map(([name, identities]) => [
      name, { identities, digest: recordDigest([...identities].sort()) }
    ]))
  };
  const identities = [
    testIdentity({ project: "firefox-critical", file: "tests/e2e/navigation.spec.ts", titlePath: ["navigation"] }),
    testIdentity({ project: "webkit-critical", file: "tests/e2e/contact.spec.ts", titlePath: ["contact"] }),
    testIdentity({ project: "webkit-mobile", file: "tests/e2e/projects.spec.ts", titlePath: ["projects"] })
  ];
  return { schemaVersion: 1, chromium, crossBrowser: { identities, digest: recordDigest([...identities].sort()) } };
}

describe("CI runner boundaries", () => {
  it("forms immutable uploaded references from the declared producer only", () => {
    const environment = {
      CI_ARTIFACT_ROLE: "snapshot",
      CI_ARTIFACT_ID: "91",
      CI_ARTIFACT_DIGEST: "c".repeat(64),
      CI_RECORD_DIGEST: "d".repeat(64),
      GITHUB_JOB: "prepare-content",
      GITHUB_RUN_ID: "741",
      GITHUB_RUN_NUMBER: "18",
      GITHUB_RUN_ATTEMPT: "2"
    };
    const reference = uploadedReference(environment);
    expect(reference).toEqual({
      schemaVersion: 1,
      id: 91,
      name: "ci-741-2-snapshot-content",
      role: "snapshot",
      digest: "c".repeat(64),
      recordDigest: "d".repeat(64),
      producer: { runId: 741, runNumber: 18, attempt: 2, job: "prepare-content" }
    });
    expect(() => uploadedReference({ ...environment, GITHUB_JOB: "quality" })).toThrow("responsibility");
    expect(() => uploadedReference({ ...environment, CI_ARTIFACT_ID: "0" })).toThrow("immutable artifact ID");
    expect(() => uploadedReference({ ...environment, CI_ARTIFACT_DIGEST: "not-a-digest" })).toThrow("Artifact digest");
    expect(() => uploadedReference({ ...environment, CI_ARTIFACT_ROLE: "receipt" })).toThrow("Unexpected artifact producer role");
  });

  it("prepares PR content from templates without passing the workbook credential", async () => {
    const fixture = await createFixture();
    const input = candidate(fixture.sha);
    const workbookUrl = "https://private.example.invalid/workbook";
    const environment = environmentFor(input, fixture, { extra: { PORTFOLIO_WORKBOOK_URL: workbookUrl } });
    const generated = generatedBytes("prepared-pr");
    const generate = vi.fn(async (root, childEnvironment) => {
      expect(root).toBe(fixture.root);
      expect(childEnvironment.PORTFOLIO_REQUIRE_REMOTE_CONTENT).toBe("false");
      expect(childEnvironment.PORTFOLIO_WORKBOOK_URL).toBe("");
      await writeFile(path.join(root, generatedContentPath), generated);
    });
    const discover = vi.fn(async () => browserDiscovery());
    const observe = vi.fn();

    const result = await prepareCandidate({ environment, projectRoot: fixture.root, generate, discover, observe });

    expect(result).toMatchObject({ mode: "full", target: "local" });
    expect(result.snapshot_name).toBe("ci-741-1-snapshot-content");
    expect(result.discovery_name).toBe("ci-741-1-discovery-browsers");
    expect(generate).toHaveBeenCalledOnce();
    expect(discover).toHaveBeenCalledWith({ projectRoot: fixture.root });
    expect(observe).not.toHaveBeenCalled();
    expect(environment.PORTFOLIO_WORKBOOK_URL).toBe(workbookUrl);
    expect(JSON.stringify(result)).not.toContain(workbookUrl);
    const record = JSON.parse(await readFile(path.join(result.snapshot_path, "snapshot.json"), "utf8"));
    expect(record).toMatchObject({ target: "local", sourceMode: "templates", producer: { job: "prepare-content", attempt: 1 } });
  });

  it("returns an obsolete plan before content, deployment, or browser IO", async () => {
    const fixture = await createFixture();
    const input = candidate(fixture.sha, { event: "push", branchTip: "e".repeat(40) });
    const environment = environmentFor(input, fixture);
    const generate = vi.fn();
    const discover = vi.fn();
    const observe = vi.fn();

    const result = await prepareCandidate({ environment, projectRoot: fixture.root, generate, discover, observe });

    expect(result).toEqual({
      plan: JSON.stringify(createPlan(input)),
      mode: "obsolete",
      target: "production",
      snapshot_name: "",
      snapshot_path: "",
      snapshot_digest: "",
      discovery_name: "",
      discovery_path: "",
      discovery_digest: ""
    });
    expect(generate).not.toHaveBeenCalled();
    expect(discover).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
  });

  it("blocks trusted preparation without a workbook credential before generation", async () => {
    const fixture = await createFixture();
    const input = candidate(fixture.sha, { event: "push" });
    const environment = environmentFor(input, fixture, {
      extra: {
        CLOUDFLARE_PAGES_PROJECT_NAME: "smart-portfolio",
        CLOUDFLARE_PAGES_DOMAIN: "smart-portfolio-bds.pages.dev"
      }
    });
    const generate = vi.fn();
    const discover = vi.fn();
    const observe = vi.fn();

    await expect(prepareCandidate({ environment, projectRoot: fixture.root, generate, discover, observe }))
      .rejects.toThrow("workbook credential");
    expect(generate).not.toHaveBeenCalled();
    expect(discover).not.toHaveBeenCalled();
    expect(observe).not.toHaveBeenCalled();
  });

  it("restores only the original prepared snapshot and detects generated-input tampering before and after use", async () => {
    const fixture = await createFixture();
    const input = candidate(fixture.sha);
    const environment = environmentFor(input, fixture, { job: "quality", attempt: "2", extra: { GH_TOKEN: "fixture-read-token" } });
    const accepted = generatedBytes("accepted-producer-content");
    const prior = generatedBytes("consumer-local-change");
    await writeFile(path.join(fixture.root, generatedContentPath), prior);
    const inputs = await collectPublicBuildInputs({ projectRoot: fixture.root, target: "local", sourceCommit: input.sourceSha, environment });
    const snapshot = createSnapshot({
      bytes: accepted,
      candidate: input,
      producer: { runId: input.runId, runNumber: input.runNumber, attempt: 1, job: "prepare-content" },
      lockfileDigest: sha256(await readFile(path.join(fixture.root, "package-lock.json"))),
      publicBuildInputDigest: publicBuildInputDigest(inputs)
    });
    const plan = createPlan(input, { snapshotDigest: recordDigest(snapshot) });
    const reference = {
      schemaVersion: 1,
      id: 56,
      name: artifactName({ role: "snapshot", validator: "content", producer: snapshot.producer }),
      role: "snapshot",
      digest: "f".repeat(64),
      recordDigest: recordDigest(snapshot),
      producer: snapshot.producer
    };
    environment.CI_PLAN = JSON.stringify(plan);
    environment.CI_SNAPSHOT_REFERENCE = JSON.stringify(reference);
    const download = vi.fn(async (receivedReference, receivedCandidate, options) => {
      expect(receivedReference).toEqual(reference);
      expect(receivedCandidate).toEqual(input);
      expect(options).toEqual({ token: "fixture-read-token" });
      return Buffer.from("fixture archive bytes");
    });
    const extract = vi.fn(async (_archive, destination) => {
      await mkdir(destination, { recursive: true });
      await writeFile(path.join(destination, "portfolio.generated.json"), accepted);
      await writeFile(path.join(destination, "snapshot.json"), `${JSON.stringify(snapshot)}\n`);
    });

    await restoreAcceptedInputs({ environment, projectRoot: fixture.root, download, extract });
    expect(download).toHaveBeenCalledOnce();
    expect(extract).toHaveBeenCalledOnce();
    expect(await readFile(path.join(fixture.root, generatedContentPath))).toEqual(accepted);
    await expect(verifyAcceptedInputs({ environment, projectRoot: fixture.root })).resolves.toMatchObject({ snapshot });

    await writeFile(path.join(fixture.root, generatedContentPath), Buffer.concat([accepted, Buffer.from(" ")]));
    await expect(verifyAcceptedInputs({ environment, projectRoot: fixture.root }))
      .rejects.toThrow("accepted generation");
  });

  it("requires a sealed manifest to retain the original package producer and candidate", () => {
    const input = candidate("a".repeat(40), { event: "push" });
    const plan = createPlan(input, { snapshotDigest: "c".repeat(64) });
    const producer = { runId: input.runId, runNumber: input.runNumber, attempt: 1, job: "build-and-package" };
    const manifest = {
      candidate: {
        snapshotRecordDigest: plan.snapshotDigest,
        sourceCommit: input.sourceSha,
        target: plan.target,
        producer: { kind: "github-actions", runId: String(producer.runId), runNumber: producer.runNumber, attempt: producer.attempt }
      }
    };
    const reference = {
      recordDigest: recordDigest(manifest),
      producer
    };

    expect(() => assertReleaseProducer(manifest, reference, plan)).not.toThrow();
    expect(() => assertReleaseProducer(manifest, { ...reference, recordDigest: "d".repeat(64) }, plan)).toThrow("producer generation");
    expect(() => assertReleaseProducer({ ...manifest, candidate: { ...manifest.candidate, sourceCommit: "d".repeat(40) } }, reference, plan)).toThrow("producer generation");
    expect(() => assertReleaseProducer(manifest, { ...reference, producer: { ...producer, attempt: 2 } }, plan)).toThrow("producer generation");
  });

  it("assigns only the exact browser partition each runner is allowed to execute", () => {
    const discovery = browserDiscovery();
    expect(browserAssignment("browser-e2e", "1/2", discovery)).toMatchObject({
      validator: "chromium-1-of-2", selection: "functional", arguments: ["--project=chromium", "--shard=1/2"]
    });
    expect(browserAssignment("browser-e2e", "2/2", discovery).identities)
      .toEqual(discovery.chromium.assignments["chromium-2-of-2"].identities);
    expect(browserAssignment("visual-regression", undefined, discovery)).toMatchObject({
      validator: "visual-regression", selection: "visual", arguments: ["--project=chromium"]
    });
    expect(browserAssignment("cross-browser", undefined, discovery)).toMatchObject({
      validator: "cross-browser", selection: "full",
      arguments: ["--project=firefox-critical", "--project=webkit-critical", "--project=webkit-mobile"]
    });
    for (const [job, shard] of [["browser-e2e", undefined], ["browser-e2e", "3/2"], ["visual-regression", "1/2"], ["unknown", undefined]]) {
      expect(() => browserAssignment(job, shard, discovery)).toThrow();
    }
  });
});
