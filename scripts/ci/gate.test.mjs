// @vitest-environment node

import { createHash } from "node:crypto";
import { access } from "node:fs/promises";
import JSZip from "jszip";
import { describe, expect, it, vi } from "vitest";
import { extractArtifact } from "./artifactTransport.mjs";
import { artifactName } from "./githubEvidence.mjs";
import { applicationJobs, chromiumShards, createPlan, recordDigest, repository, requiredJobs, sealedReleaseValidators, securityJobs, workflowPath } from "./plan.mjs";
import { createSourceReceipt, createValidationReceipt } from "./validationEvidence.mjs";
import { allowedBrowserSkips } from "./browserSkips.mjs";
import { testIdentity } from "./receipts.mjs";
import { verifyCompleteEvidence } from "./gate.mjs";

const sha = "a".repeat(40);

function candidate(event = "push", overrides = {}) {
  const ref = event === "pull_request" ? "refs/pull/123/merge" : "refs/heads/main";
  return {
    schemaVersion: 1, repository, event, ref, workflowRef: repository + "/" + workflowPath + "@" + ref,
    workflowSha: sha, sourceSha: sha, eventSha: sha, runHeadSha: sha,
    branchTip: event === "pull_request" ? null : sha, pullNumber: event === "pull_request" ? 123 : null,
    baseBranch: event === "pull_request" ? "main" : null, force: false, runId: 12345,
    runNumber: 350, producerAttempt: 1, ...overrides
  };
}

function hash(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

async function archive(file, value) {
  const zip = new JSZip();
  zip.file(file, JSON.stringify(value));
  return zip.generateAsync({ type: "nodebuffer", compression: "STORE" });
}

function chromiumDiscovery() {
  const optional = Object.keys(allowedBrowserSkips);
  const visual = testIdentity({
    project: "chromium", file: "tests/e2e/skeletons.visual.spec.ts", titlePath: ["matches the reviewed route skeleton"]
  });
  const assignments = {
    full: [...optional, visual],
    "chromium-1-of-2": optional.slice(0, 6),
    "chromium-2-of-2": optional.slice(6),
    "visual-regression": [visual]
  };
  return {
    schemaVersion: 1, project: "chromium", discoveryDigest: recordDigest([...assignments.full].sort()),
    assignments: Object.fromEntries(Object.entries(assignments).map(([name, identities]) => [
      name, { identities, digest: recordDigest([...identities].sort()) }
    ]))
  };
}

function crossBrowserDiscovery() {
  const identities = [
    testIdentity({ project: "firefox-critical", file: "tests/e2e/navigation.spec.ts", titlePath: ["renders primary navigation"] }),
    testIdentity({ project: "webkit-critical", file: "tests/e2e/contact.spec.ts", titlePath: ["submits a valid message"] }),
    testIdentity({ project: "webkit-mobile", file: "tests/e2e/theme.spec.ts", titlePath: ["switches themes"] })
  ];
  return { identities, digest: recordDigest([...identities].sort()) };
}

function executionReport(identities) {
  return {
    schemaVersion: 1, mode: "execution", status: "passed", errorCount: 0, identities,
    cases: identities.map((identity) => ({
      identity, attempts: [{ status: "passed", durationMs: 1, retry: 0 }], skipReason: null
    })),
    durationMs: identities.length
  };
}

function allResults(plan) {
  const all = [...new Set([...requiredJobs(plan.candidate, "full"), "dependency-review"])];
  return Object.fromEntries(all.map((name) => [
    name, { result: plan.requiredJobs.includes(name) ? "success" : "skipped" }
  ]));
}

async function fixture({
  event = "push", mode = "full", currentAttempt = 2, receiptPatch = {}, candidateOverrides = {}
} = {}) {
  const inputCandidate = candidate(event, candidateOverrides);
  const snapshotRecordDigest = mode === "obsolete" ? null : recordDigest({ kind: "accepted-snapshot" });
  let plan;
  if (mode === "unchanged") {
    plan = createPlan(candidate("schedule", candidateOverrides), {
      snapshotDigest: snapshotRecordDigest,
      comparison: { schemaVersion: 1, equivalent: true, identityDigest: recordDigest({ deployed: true }) }
    });
  } else if (mode === "obsolete") {
    plan = createPlan(candidate("push", { ...candidateOverrides, branchTip: "b".repeat(40) }));
  } else {
    plan = createPlan(inputCandidate, { snapshotDigest: snapshotRecordDigest });
  }
  const input = { plan, results: allResults(plan), currentAttempt, references: null };
  const jobs = [], artifacts = [], archives = new Map(), downloaded = [];
  let nextId = 1;

  const addJob = (name, attempt = 1, conclusion = "success") => {
    const job = { id: nextId++, name, run_id: plan.candidate.runId, run_attempt: attempt, status: "completed", conclusion };
    jobs.push(job);
    return job;
  };
  const addMetadata = ({ role, validator, producer, recordDigest: digest, bytes = null }) => {
    const id = nextId++;
    const name = artifactName({ role, validator, producer });
    const artifact = {
      id, name, expired: false, digest: "sha256:" + (bytes === null ? recordDigest({ id, name }) : hash(bytes)),
      workflow_run: { id: plan.candidate.runId, head_sha: plan.candidate.runHeadSha }
    };
    artifacts.push(artifact);
    if (bytes !== null) archives.set(id, bytes);
    return {
      schemaVersion: 1, id, name, role, digest: artifact.digest.slice("sha256:".length), recordDigest: digest, producer
    };
  };
  const addEvidence = async ({ validator, producer, file, value, role = "receipt", digest = null }) => {
    const bytes = await archive(file, value);
    const reference = addMetadata({
      role, validator, producer, recordDigest: digest ?? recordDigest(value), bytes
    });
    return { ...reference, bytes };
  };

  const preparation = { runId: plan.candidate.runId, runNumber: plan.candidate.runNumber, attempt: 1, job: "prepare-content" };
  addJob("resolve-candidate");
  addJob("prepare-content");
  const references = { snapshot: null, discovery: null, release: null };
  if (mode !== "obsolete") {
    references.snapshot = addMetadata({
      role: "snapshot", validator: "content", producer: preparation, recordDigest: plan.snapshotDigest
    });
  }

  const sourceValidators = [
    ...securityJobs,
    ...(plan.candidate.event === "pull_request" ? ["dependency-review"] : [])
  ];
  for (const name of sourceValidators) {
    const producer = { runId: plan.candidate.runId, runNumber: plan.candidate.runNumber, attempt: 1, job: name };
    addJob(name);
    let receipt = createSourceReceipt({ candidate: plan.candidate, validator: name, producer });
    if (receiptPatch[name]) receipt = receiptPatch[name](receipt);
    await addEvidence({ validator: name, producer, file: "receipt.json", value: receipt });
  }

  if (mode === "full") {
    const chromium = chromiumDiscovery();
    const crossBrowser = crossBrowserDiscovery();
    const discovery = { schemaVersion: 1, chromium, crossBrowser };
    const stored = await addEvidence({
      role: "discovery", validator: "browsers", producer: preparation, file: "discovery.json", value: discovery
    });
    delete stored.bytes;
    references.discovery = stored;

    for (const job of applicationJobs) {
      if (job !== "browser-e2e") addJob(job);
    }
    addJob("chromium-1-of-2");
    addJob("chromium-2-of-2");
    const releaseProducer = {
      runId: plan.candidate.runId, runNumber: plan.candidate.runNumber, attempt: 1, job: "build-and-package"
    };
    references.release = addMetadata({
      role: "release", validator: "candidate", producer: releaseProducer,
      recordDigest: recordDigest({ kind: "accepted-release" })
    });

    const application = [
      ...sealedReleaseValidators,
      ...applicationJobs.filter((name) => name !== "browser-e2e"),
      "chromium-1-of-2", "chromium-2-of-2"
    ];
    for (const name of application) {
      const producerJob = name.startsWith("chromium-") ? "browser-e2e" : sealedReleaseValidators.includes(name) ? "build-and-package" : name;
      const producer = { runId: plan.candidate.runId, runNumber: plan.candidate.runNumber, attempt: 1, job: producerJob };
      const assignment = name === "cross-browser" ? crossBrowser.identities :
        chromium.assignments[name]?.identities ?? null;
      let receipt = createValidationReceipt({
        plan, validator: name, job: producerJob, producer, assignment,
        browserReport: assignment === null ? null : executionReport(assignment), durationMs: 1,
        artifactRecordDigest: [...sealedReleaseValidators, "build-and-package", "export-check"].includes(name) ? references.release.recordDigest : null
      });
      if (receiptPatch[name]) receipt = receiptPatch[name](receipt);
      await addEvidence({ validator: name, producer, file: "receipt.json", value: receipt });
    }

  }
  input.references = references;
  const run = {
    id: plan.candidate.runId, run_number: plan.candidate.runNumber, event: plan.candidate.event,
    head_sha: plan.candidate.runHeadSha, path: workflowPath, run_attempt: currentAttempt
  };
  const calls = { run: [], collections: [], download: [] };
  const providers = {
    token: "read-only-test-token",
    readRun: async (value, options) => {
      calls.run.push({ value, options });
      return run;
    },
    readCollection: async (runId, kind, options) => {
      calls.collections.push({ runId, kind, options });
      return kind === "jobs" ? jobs : artifacts;
    },
    download: async (reference, acceptedCandidate, options) => {
      calls.download.push({ reference, acceptedCandidate, options });
      downloaded.push(reference);
      const bytes = archives.get(reference.id);
      if (!bytes) throw new Error("The gate attempted to download a non-evidence artifact.");
      return bytes;
    },
    extract: extractArtifact
  };
  return { input, plan, jobs, artifacts, references, run, calls, providers, downloaded, archives };
}

async function verify(value) {
  return verifyCompleteEvidence(value.input, value.providers);
}

describe("complete CI evidence gate", () => {
  it.each([
    ["pull request", { event: "pull_request" }, false],
    ["trusted push", { event: "push" }, true]
  ])("admits a complete %s generation and uses original producers on a consumer-only rerun", async (_name, options, deploy) => {
    const value = await fixture(options);
    const admitted = await verify(value);

    expect(admitted).toMatchObject({ accepted: true, deploy, mode: "full" });
    expect(admitted.snapshot).toMatchObject({ producer: { attempt: 1, job: "prepare-content" } });
    expect(admitted.release).toMatchObject({ producer: { attempt: 1, job: "build-and-package" } });
    expect(value.calls.run[0].options).toMatchObject({ token: "read-only-test-token" });
    expect(value.calls.collections.map(({ kind }) => kind).sort()).toEqual(["artifacts", "jobs"]);
    // One receipt per validator (one per native shard), plus discovery.
    const receiptCount = sealedReleaseValidators.length + applicationJobs.length - 1 + chromiumShards.length + securityJobs.length + Number(options.event === "pull_request");
    expect(value.downloaded).toHaveLength(receiptCount + 1);
    expect(value.downloaded.map(({ role }) => role)).not.toContain("release");
    expect(value.downloaded.map(({ role }) => role)).not.toContain("snapshot");
    expect(value.downloaded.every(({ role }) => ["receipt", "discovery"].includes(role))).toBe(true);
  }, 30_000);

  it("performs source-only checks for unchanged and obsolete plans", async () => {
    for (const mode of ["unchanged", "obsolete"]) {
      const value = await fixture({ mode });
      const admitted = await verify(value);
      expect(admitted).toMatchObject({ accepted: true, deploy: false, mode });
      expect(value.downloaded).toHaveLength(securityJobs.length);
      expect(value.downloaded.every(({ role }) => role === "receipt")).toBe(true);
      expect(value.references.discovery).toBeNull();
      expect(value.references.release).toBeNull();
    }
  }, 30_000);

  it("rejects every failed, cancelled, skipped, missing, or unexpected required dependency before providers run", async () => {
    const value = await fixture({ event: "pull_request" });
    const required = [...value.plan.requiredJobs, "browser-e2e"];
    for (const name of required) {
      for (const result of ["failure", "cancelled", "skipped", undefined]) {
        const input = structuredClone(value.input);
        input.results[name] = { result };
        await expect(verifyCompleteEvidence(input, value.providers)).rejects.toThrow("Required validation");
      }
      const input = structuredClone(value.input);
      delete input.results[name];
      await expect(verifyCompleteEvidence(input, value.providers)).rejects.toThrow("dependencies");
    }
    expect(value.calls.run).toHaveLength(0);
  });

  it("rejects missing or unsuccessful browser-shard provider evidence even when browser-e2e reported success", async () => {
    for (const mutate of [
      (value) => value.jobs.splice(value.jobs.findIndex(({ name }) => name === "chromium-2-of-2"), 1),
      (value) => { value.jobs.find(({ name }) => name === "chromium-2-of-2").conclusion = "failure"; },
      (value) => { value.jobs.find(({ name }) => name === "chromium-2-of-2").conclusion = "cancelled"; },
      (value) => { value.jobs.find(({ name }) => name === "chromium-2-of-2").conclusion = "skipped"; }
    ]) {
      const value = await fixture();
      mutate(value);
      await expect(verify(value)).rejects.toThrow(/Latest job execution|Job evidence is missing/);
    }
  }, 30_000);

  it("rejects a missing or release-mismatched sealed-output scan receipt even when build-and-package succeeded", async () => {
    const missing = await fixture();
    const scanArtifact = missing.artifacts.find(({ name }) => name.includes("receipt-built-output-scan"));
    missing.artifacts.splice(missing.artifacts.indexOf(scanArtifact), 1);
    await expect(verify(missing)).rejects.toThrow("Original producer artifact is missing");

    const mismatched = await fixture();
    const scan = mismatched.artifacts.find(({ name }) => name.includes("receipt-built-output-scan"));
    const scanBytes = mismatched.archives.get(scan.id);
    const archiveValue = await JSZip.loadAsync(scanBytes);
    const receipt = JSON.parse(await archiveValue.file("receipt.json").async("text"));
    receipt.artifactRecordDigest = "c".repeat(64);
    const altered = await archive("receipt.json", receipt);
    mismatched.archives.set(scan.id, altered);
    scan.digest = `sha256:${hash(altered)}`;
    await expect(verify(mismatched)).rejects.toThrow("different inputs");
  }, 30_000);

  it("does not prefer a prior green job over a newer failed execution", async () => {
    const value = await fixture();
    value.jobs.push({
      id: 999, name: "quality", run_id: value.plan.candidate.runId, run_attempt: 2,
      status: "completed", conclusion: "failure"
    });
    await expect(verify(value)).rejects.toThrow("Latest job execution");
  }, 30_000);

  it("invalidates old preparation, package, and export evidence when their producers rerun", async () => {
    for (const name of ["prepare-content", "build-and-package", "export-check"]) {
      const value = await fixture();
      value.jobs.push({
        id: 999, name, run_id: value.plan.candidate.runId, run_attempt: 2,
        status: "completed", conclusion: "success"
      });
      await expect(verify(value)).rejects.toThrow();
    }
  }, 30_000);

  it("rejects expired or candidate-mismatched producer references", async () => {
    for (const mutate of [
      (value) => { value.artifacts.find(({ id }) => id === value.references.snapshot.id).expired = true; },
      (value) => { value.artifacts.find(({ id }) => id === value.references.release.id).workflow_run.head_sha = "b".repeat(40); }
    ]) {
      const value = await fixture();
      mutate(value);
      await expect(verify(value)).rejects.toThrow("missing, expired or belongs to different inputs");
    }
  }, 30_000);

  it("rejects stale snapshot records, altered receipt inputs, and wrong browser assignments", async () => {
    const snapshot = await fixture();
    snapshot.references.snapshot.recordDigest = "c".repeat(64);
    await expect(verify(snapshot)).rejects.toThrow("content generation differ");

    const alteredReceipt = await fixture({
      receiptPatch: {
        quality: (receipt) => ({ ...receipt, planDigest: "c".repeat(64) })
      }
    });
    await expect(verify(alteredReceipt)).rejects.toThrow("different inputs");

    const wrongShard = await fixture({
      receiptPatch: {
        "chromium-1-of-2": (receipt) => ({
          ...receipt,
          discoveryDigest: recordDigest([...chromiumDiscovery().assignments["chromium-2-of-2"].identities].sort()),
          cases: executionReport(chromiumDiscovery().assignments["chromium-2-of-2"].identities).cases
        })
      }
    });
    await expect(verify(wrongShard)).rejects.toThrow("differs from its assignment");
  }, 30_000);

  it("waits for concurrent bounded artifact extraction before removing its shared temporary root", async () => {
    const value = await fixture({
      receiptPatch: { quality: (receipt) => ({ ...receipt, planDigest: "c".repeat(64) }) }
    });
    const findBytes = (validator) => value.archives.get(value.artifacts.find(({ name }) => name.includes("receipt-" + validator)).id);
    const slow = findBytes("export-check");
    let slowDestinationSurvived = false;
    value.providers.extract = async (bytes, destination) => {
      await extractArtifact(bytes, destination);
      if (bytes.equals(slow)) {
        await new Promise((resolve) => setTimeout(resolve, 50));
        await access(destination);
        slowDestinationSurvived = true;
      }
    };

    await expect(verify(value)).rejects.toThrow("different inputs");
    expect(slowDestinationSurvived).toBe(true);
  }, 30_000);

  it("requires read-only credentials even when its provider calls are otherwise injectable", async () => {
    const value = await fixture();
    const fetchImplementation = vi.fn();
    await expect(verifyCompleteEvidence(value.input, { fetchImplementation })).rejects.toThrow("credentials");
    expect(fetchImplementation).not.toHaveBeenCalled();
  });
});
