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

function at(second) {
  return new Date(Date.UTC(2026, 9, 15, 0, 0, second)).toISOString().replace(".000", "");
}

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
  const nextSeconds = new Map();

  const addJob = (name, attempt = 1, conclusion = "success") => {
    const start = nextSeconds.get(attempt) ?? attempt * 100 + 1;
    nextSeconds.set(attempt, start + 2);
    const job = {
      id: nextId++, name, run_id: plan.candidate.runId, run_attempt: attempt, status: "completed", conclusion,
      started_at: at(start), completed_at: at(start + 1),
      steps: [{ number: 1, name: "Validate", status: "completed", conclusion, started_at: at(start), completed_at: at(start + 1) }]
    };
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
  const originals = jobs.filter((job) => job.run_attempt === 1);
  for (let attempt = 2; attempt <= currentAttempt; attempt += 1) {
    jobs.push(...originals.map((job) => ({ ...structuredClone(job), id: nextId++, run_attempt: attempt })));
  }
  const runAttempts = new Map(Array.from({ length: currentAttempt }, (_, index) => {
    const attempt = index + 1;
    return [attempt, {
      id: plan.candidate.runId, run_number: plan.candidate.runNumber, event: plan.candidate.event,
      head_sha: plan.candidate.runHeadSha, path: workflowPath, run_attempt: attempt,
      run_started_at: at(attempt * 100)
    }];
  }));
  const run = runAttempts.get(currentAttempt);
  const calls = { run: [], attempts: [], collections: [], download: [] };
  const providers = {
    token: "read-only-test-token",
    readRun: async (value, options) => {
      calls.run.push({ value, options });
      return run;
    },
    readAttempt: async (value, attempt, options) => {
      calls.attempts.push({ value, attempt, options });
      const record = runAttempts.get(attempt);
      if (!record) throw new Error("Unexpected attempt metadata read.");
      return record;
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
  return { input, plan, jobs, artifacts, references, run, runAttempts, calls, providers, downloaded, archives, addEvidence };
}

async function verify(value) {
  return verifyCompleteEvidence(value.input, value.providers);
}

function physicalCurrentJob(value, name, conclusion = "success") {
  const job = value.jobs.find((entry) => entry.name === name && entry.run_attempt === value.input.currentAttempt);
  const start = value.input.currentAttempt * 100 + 50;
  job.started_at = at(start);
  job.completed_at = at(start + 1);
  job.conclusion = conclusion;
  job.steps[0] = { ...job.steps[0], conclusion, started_at: job.started_at, completed_at: job.completed_at };
  return job;
}

async function addCurrentQualityReceipt(value) {
  const producer = {
    runId: value.plan.candidate.runId,
    runNumber: value.plan.candidate.runNumber,
    attempt: value.input.currentAttempt,
    job: "quality"
  };
  await value.addEvidence({
    validator: "quality",
    producer,
    file: "receipt.json",
    value: createValidationReceipt({
      plan: value.plan,
      validator: "quality",
      job: "quality",
      producer,
      assignment: null,
      browserReport: null,
      durationMs: 1
    })
  });
}

async function addCurrentChromiumReceipt(value, validator) {
  const producer = {
    runId: value.plan.candidate.runId,
    runNumber: value.plan.candidate.runNumber,
    attempt: value.input.currentAttempt,
    job: "browser-e2e"
  };
  const assignment = chromiumDiscovery().assignments[validator].identities;
  await value.addEvidence({
    validator,
    producer,
    file: "receipt.json",
    value: createValidationReceipt({
      plan: value.plan,
      validator,
      job: "browser-e2e",
      producer,
      assignment,
      browserReport: executionReport(assignment),
      durationMs: 1
    })
  });
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

  it("collapses repeated consumer copies through later attempts without extra job-list reads", async () => {
    const value = await fixture({ currentAttempt: 4 });
    const admitted = await verify(value);

    expect(admitted).toMatchObject({ accepted: true, mode: "full" });
    expect(admitted.snapshot.producer.attempt).toBe(1);
    expect(value.calls.collections.map(({ kind }) => kind).sort()).toEqual(["artifacts", "jobs"]);
    expect(value.calls.attempts.map(({ attempt }) => attempt)).toEqual([1, 2, 3]);
  }, 30_000);

  it("requires a newly physical successful consumer job to provide its own exact receipt", async () => {
    const missing = await fixture();
    physicalCurrentJob(missing, "quality");
    await expect(verify(missing)).rejects.toThrow("Original producer artifact is missing");

    const admitted = await fixture();
    physicalCurrentJob(admitted, "quality");
    await addCurrentQualityReceipt(admitted);
    const result = await verify(admitted);
    expect(result.receiptDigests).toHaveProperty("quality");
    expect(admitted.downloaded.find(({ name }) => name.includes("receipt-quality")).producer.attempt).toBe(2);
  }, 30_000);

  it("requires a newly physical Chromium shard to provide its own exact receipt", async () => {
    const missing = await fixture();
    physicalCurrentJob(missing, "chromium-1-of-2");
    await expect(verify(missing)).rejects.toThrow("Original producer artifact is missing");

    const admitted = await fixture();
    physicalCurrentJob(admitted, "chromium-1-of-2");
    await addCurrentChromiumReceipt(admitted, "chromium-1-of-2");
    const result = await verify(admitted);
    expect(result.receiptDigests).toHaveProperty("chromium-1-of-2");
    expect(admitted.downloaded.find(({ name }) => name.includes("receipt-chromium-1-of-2")).producer.attempt).toBe(2);
  }, 30_000);

  it("rejects malformed historical metadata before accepting copied evidence", async () => {
    const value = await fixture();
    value.providers.readAttempt = async () => ({ ...value.runAttempts.get(1), run_started_at: "2026-02-30T00:00:01Z" });
    await expect(verify(value)).rejects.toThrow("malformed");
  });

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
      (value) => value.jobs.splice(value.jobs.findIndex(({ name, run_attempt }) => name === "chromium-2-of-2" && run_attempt === value.input.currentAttempt), 1),
      (value) => physicalCurrentJob(value, "chromium-2-of-2", "failure"),
      (value) => physicalCurrentJob(value, "chromium-2-of-2", "cancelled"),
      (value) => physicalCurrentJob(value, "chromium-2-of-2", "skipped")
    ]) {
      const value = await fixture();
      mutate(value);
      await expect(verify(value)).rejects.toThrow(/Latest job execution|Current rerun job evidence is missing/);
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
    const failed = value.jobs.find(({ name, run_attempt }) => name === "quality" && run_attempt === value.input.currentAttempt);
    failed.started_at = at(value.input.currentAttempt * 100 + 1);
    failed.completed_at = at(value.input.currentAttempt * 100 + 2);
    failed.conclusion = "failure";
    failed.steps[0] = { ...failed.steps[0], conclusion: "failure", started_at: failed.started_at, completed_at: failed.completed_at };
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
