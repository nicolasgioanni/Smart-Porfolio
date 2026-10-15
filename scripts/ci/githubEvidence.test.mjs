// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { artifactForCompletedJob, artifactName, readGithubEvidence, readRunCollection, readRunEvidence, transferForCompletedJob, verifyReceiptProducer } from "./githubEvidence.mjs";
import { repository, workflowPath } from "./plan.mjs";

const sha = "a".repeat(40), digest = "b".repeat(64);
const candidate = { schemaVersion: 1, repository, event: "push", ref: "refs/heads/main", workflowRef: `${repository}/${workflowPath}@refs/heads/main`, workflowSha: sha, sourceSha: sha, eventSha: sha, runHeadSha: sha, branchTip: sha, pullNumber: null, baseBranch: null, force: false, runId: 12345, runNumber: 350, producerAttempt: 1 };
const producer = { runId: 12345, runNumber: 350, attempt: 1, job: "browser-e2e" };
const job = { id: 99, run_id: 12345, run_attempt: 1, name: "chromium-1-of-2", status: "completed", conclusion: "success" };
const name = artifactName({ role: "receipt", producer, validator: job.name });
const artifact = { id: 77, name, digest: `sha256:${digest}`, expired: false, workflow_run: { id: 12345, head_sha: sha } };
const options = { token: "read-only-fixture-token" };
const response = (value) => new Response(JSON.stringify(value), { headers: { "content-type": "application/json" } });
const selection = { artifacts: [artifact], jobs: [job], candidate, currentAttempt: 2, jobName: job.name, producerJob: "browser-e2e", validator: job.name, role: "receipt", recordDigest: digest };

describe("same-run GitHub evidence admission", () => {
  it("uses constrained read-only endpoints without forwarding credentials through redirects", async () => {
    const fetchImplementation = vi.fn(async () => response({ id: 12345 }));
    expect(await readGithubEvidence("/actions/runs/12345", { ...options, fetchImplementation })).toEqual({ id: 12345 });
    expect(fetchImplementation.mock.calls[0][0]).toBe(`https://api.github.com/repos/${repository}/actions/runs/12345`);
    expect(fetchImplementation.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { Authorization: "Bearer read-only-fixture-token" } });
    for (const endpoint of ["https://evil.test", "/actions/runs/latest", "/actions/runs/12345/../../secrets", "/actions/runs/12345?redirect=elsewhere"]) {
      await expect(readGithubEvidence(endpoint, { ...options, fetchImplementation })).rejects.toThrow("Unsupported");
    }
    await expect(readGithubEvidence("/actions/runs/12345", { fetchImplementation })).rejects.toThrow("credentials");
    expect(fetchImplementation).toHaveBeenCalledTimes(1);
  });

  it("rejects unavailable, malformed and oversized reports without exposing their body", async () => {
    for (const result of [new Response("private sentinel", { status: 404 }), new Response("private sentinel"), new Response("x".repeat(8 * 1024 * 1024 + 1))]) {
      await expect(readGithubEvidence("/actions/runs/12345", { ...options, fetchImplementation: async () => result })).rejects.not.toThrow("private sentinel");
    }
  });

  it("binds run identity to workflow path, event, source and attempt", async () => {
    const run = { id: 12345, run_number: 350, event: "push", head_sha: sha, path: workflowPath, run_attempt: 2 };
    expect(await readRunEvidence(candidate, { ...options, fetchImplementation: async () => response(run) })).toEqual(run);
    for (const patch of [{ id: 88 }, { event: "workflow_dispatch" }, { head_sha: "c".repeat(40) }, { path: "untrusted.yml" }, { run_attempt: 0 }]) {
      await expect(readRunEvidence(candidate, { ...options, fetchImplementation: async () => response({ ...run, ...patch }) })).rejects.toThrow("does not match");
    }
  });

  it("paginates all job attempts and rejects incomplete, changing or duplicate collections", async () => {
    const first = Array.from({ length: 100 }, (_, i) => ({ ...job, id: i + 1 }));
    const fetchImplementation = vi.fn(async (url) => response({ total_count: 101, jobs: url.endsWith("page=1") ? first : [{ ...job, id: 101 }] }));
    expect(await readRunCollection(12345, "jobs", { ...options, fetchImplementation })).toHaveLength(101);
    expect(fetchImplementation.mock.calls[0][0]).toContain("filter=all");
    for (const value of [{ total_count: 2, jobs: [job] }, { total_count: 2, jobs: [job, job] }, { total_count: 0, jobs: [job] }, { total_count: 1 }]) {
      await expect(readRunCollection(12345, "jobs", { ...options, fetchImplementation: async () => response(value) })).rejects.toThrow();
    }
    let page = 0;
    await expect(readRunCollection(12345, "jobs", { ...options, fetchImplementation: async () => response(++page === 1 ? { total_count: 101, jobs: first } : { total_count: 102, jobs: [job] }) })).rejects.toThrow("changed");
  });

  it("uses the original producer on consumer-only reruns and never substitutes a different artifact", () => {
    const { transfer } = transferForCompletedJob(selection);
    expect(transfer).toMatchObject({ id: 77, digest, producer });
    expect(transfer).not.toHaveProperty("recordDigest");
    expect(artifactForCompletedJob(selection).reference.id).toBe(77);
    for (const artifacts of [[], [artifact, artifact], [{ ...artifact, expired: true }], [{ ...artifact, name: `${name}-latest` }], [{ ...artifact, workflow_run: { id: 9, head_sha: sha } }]]) {
      expect(() => artifactForCompletedJob({ ...selection, artifacts })).toThrow();
    }
    const newerJob = { ...job, id: 100, run_attempt: 2 };
    expect(() => artifactForCompletedJob({ ...selection, jobs: [job, newerJob] })).toThrow("missing or ambiguous");
    for (const conclusion of ["failure", "cancelled", "skipped"]) {
      expect(() => artifactForCompletedJob({ ...selection, jobs: [job, { ...newerJob, conclusion }] })).toThrow("unsuccessful");
    }
  });

  it("rejects receipts from a superseded job attempt", () => {
    expect(verifyReceiptProducer(producer, job, "browser-e2e")).toEqual(producer);
    expect(() => verifyReceiptProducer(producer, { ...job, run_attempt: 2 }, "browser-e2e")).toThrow("latest");
    expect(() => verifyReceiptProducer(producer, job, "quality")).toThrow("Unexpected");
  });
});
