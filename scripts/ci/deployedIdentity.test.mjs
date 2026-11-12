// @vitest-environment node
import { describe, expect, it } from "vitest";
import { approvedPagesOrigin, compareSnapshotDeployment, readDeployedIdentity } from "./deployedIdentity.mjs";
import { createSnapshot } from "./snapshot.mjs";
import { repository, workflowPath } from "./plan.mjs";
import { decideDeployment } from "../checkDeployedContent.mjs";

const environment = { CLOUDFLARE_PAGES_PROJECT_NAME: "smart-portfolio", CLOUDFLARE_PAGES_DOMAIN: "smart-portfolio-bds.pages.dev" };
const sha = "a".repeat(40), digest = "b".repeat(64);
const deployed = { schemaVersion: 2, target: "production", contentHash: digest, commitSha: sha,
  generatedAt: "2026-10-12T00:00:00Z", deployedAt: "2026-10-12T01:00:00Z", publicBuildInputDigest: digest,
  producer: { kind: "github-actions", runId: "101", runNumber: 10, attempt: 1 } };

describe("deployed input identity", () => {
  it("observes only reviewed aliases and exact hosts with one unique metadata query each", async () => {
    expect(approvedPagesOrigin("preview", environment)).toBe("https://develop.smart-portfolio-bds.pages.dev");
    expect(() => approvedPagesOrigin("production", { ...environment, CLOUDFLARE_PAGES_DOMAIN: "substitute.pages.dev" })).toThrow();
    const requests = [];
    const fetchImplementation = async (url, options) => {
      const request = new URL(url);
      requests.push(request);
      expect(request.pathname).toBe("/content-version.json");
      expect([...request.searchParams.keys()]).toEqual(["ci"]);
      expect(request.searchParams.get("ci")).toMatch(/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/);
      expect(options.redirect).toBe("error");
      expect(options.headers).toEqual({ "Cache-Control": "no-cache", Pragma: "no-cache" });
      expect(options.headers).not.toHaveProperty("Authorization");
      return Response.json(deployed);
    };
    await expect(readDeployedIdentity("production", { environment, fetchImplementation })).resolves.toEqual(deployed);
    await expect(readDeployedIdentity("preview", { environment, fetchImplementation })).resolves.toEqual(deployed);
    await expect(readDeployedIdentity("production", {
      environment,
      exactDeployment: "https://0123abcd.smart-portfolio-bds.pages.dev",
      fetchImplementation
    })).resolves.toEqual(deployed);
    expect(requests.map((request) => request.origin)).toEqual([
      "https://smart-portfolio-bds.pages.dev",
      "https://develop.smart-portfolio-bds.pages.dev",
      "https://0123abcd.smart-portfolio-bds.pages.dev"
    ]);
    expect(new Set(requests.map((request) => request.searchParams.get("ci"))).size).toBe(3);

    let invalidFetches = 0;
    for (const exactDeployment of [
      "https://0123abcd.smart-portfolio-bds.pages.dev?unexpected=query",
      "https://0123abcd.smart-portfolio-bds.pages.dev#fragment",
      "https://credential@0123abcd.smart-portfolio-bds.pages.dev",
      "https://0123abcd.substitute.pages.dev"
    ]) {
      await expect(readDeployedIdentity("production", {
        environment,
        exactDeployment,
        fetchImplementation: async () => { invalidFetches += 1; return Response.json(deployed); }
      })).rejects.toThrow("approved Pages hash host");
    }
    expect(invalidFetches).toBe(0);
  });

  it("does not reuse a cached alias identity for a later observation", async () => {
    const newer = { ...deployed, producer: { ...deployed.producer, runId: "102", runNumber: 11 } };
    const responses = new Map();
    const observedUrls = [];
    const fetchImplementation = async (url) => {
      const value = String(url);
      observedUrls.push(value);
      if (!responses.has(value)) responses.set(value, Response.json(responses.size === 0 ? deployed : newer));
      return responses.get(value).clone();
    };

    await expect(readDeployedIdentity("production", { environment, fetchImplementation })).resolves.toEqual(deployed);
    await expect(readDeployedIdentity("production", { environment, fetchImplementation })).resolves.toEqual(newer);
    expect(observedUrls).toHaveLength(2);
    expect(observedUrls[0]).not.toBe(observedUrls[1]);
    expect(new URL(observedUrls[0]).origin).toBe("https://smart-portfolio-bds.pages.dev");
    expect(decideDeployment(deployed, newer)).toEqual({ action: "fail-closed", reason: "candidate-generation-is-older" });
  });

  it("distinguishes missing metadata from failed, redirected, oversized or malformed observations", async () => {
    await expect(readDeployedIdentity("production", { environment, fetchImplementation: async () => new Response(null, { status: 404 }) })).resolves.toBe(null);
    for (const response of [new Response(null, { status: 302 }), new Response(null, { status: 403 }),
      new Response("{"), new Response("x".repeat(65537))]) {
      await expect(readDeployedIdentity("production", { environment, fetchImplementation: async () => response })).rejects.toThrow();
    }
  });

  it("bounds stalled response reads and never waits for stalled cancellation", async () => {
    const controller = new AbortController();
    const pending = readDeployedIdentity("production", { environment, signal: controller.signal,
      fetchImplementation: async () => new Response(new ReadableStream({ pull() { return new Promise(() => {}); }, cancel() { return new Promise(() => {}); } })) });
    setTimeout(() => controller.abort(), 5);
    await expect(pending).rejects.toThrow("timed out");
  });

  it("invalidates equivalence on source/content/target/public-input changes and legacy metadata", () => {
    const candidate = { schemaVersion: 1, repository, event: "schedule", ref: "refs/heads/main",
      workflowRef: `${repository}/${workflowPath}@refs/heads/main`, sourceSha: sha, eventSha: sha, runHeadSha: sha,
      workflowSha: sha, branchTip: sha, pullNumber: null, baseBranch: null, force: false, runId: 101, runNumber: 11, producerAttempt: 1 };
    const snapshot = createSnapshot({ candidate, bytes: Buffer.from(JSON.stringify({ metadata: { contentHash: digest } })),
      producer: { runId: candidate.runId, runNumber: candidate.runNumber, attempt: candidate.producerAttempt, job: "prepare-content" },
      lockfileDigest: digest, publicBuildInputDigest: digest });
    expect(compareSnapshotDeployment(candidate, snapshot, deployed).equivalent).toBe(true);
    for (const value of [null, { ...deployed, commitSha: "c".repeat(40) }, { ...deployed, contentHash: "c".repeat(64) },
      { ...deployed, publicBuildInputDigest: "c".repeat(64) }, { ...deployed, target: "preview" },
      { schemaVersion: 1, commitSha: sha, contentHash: digest, generatedAt: deployed.generatedAt, deployedAt: deployed.deployedAt }]) {
      expect(compareSnapshotDeployment(candidate, snapshot, value).equivalent).toBe(false);
    }
  });
});
