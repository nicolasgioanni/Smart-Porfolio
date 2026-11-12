// @vitest-environment node
import { mkdtemp, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { allowedBrowserSkips } from "./browserSkips.mjs";
import { createPlan, recordDigest, repository, workflowPath } from "./plan.mjs";
import { testIdentity } from "./receipts.mjs";
import { createSourceReceipt, createValidationReceipt, parseChromiumDiscovery, readEvidenceArtifact, verifySourceReceipt } from "./validationEvidence.mjs";

const sha = "a".repeat(40), digest = "b".repeat(64);
const candidate = { schemaVersion: 1, repository, event: "push", ref: "refs/heads/main", workflowRef: `${repository}/${workflowPath}@refs/heads/main`, workflowSha: sha, sourceSha: sha, eventSha: sha, runHeadSha: sha, branchTip: sha, pullNumber: null, baseBranch: null, force: false, runId: 12345, runNumber: 350, producerAttempt: 1 };
const plan = createPlan(candidate, { snapshotDigest: digest });
const producer = { runId: 12345, runNumber: 350, attempt: 1, job: "browser-e2e" };
const assignment = [Object.keys(allowedBrowserSkips)[0]];
function report() {
  return { schemaVersion: 1, mode: "execution", status: "passed", errorCount: 0, identities: assignment,
    cases: assignment.map((identity) => ({ identity, attempts: [{ status: "passed", durationMs: 5, retry: 0 }], skipReason: null })), durationMs: 5 };
}
function discovery() {
  const functional = Object.keys(allowedBrowserSkips);
  const visual = [testIdentity({ project: "chromium", file: "skeletons.visual.spec.ts", titlePath: ["geometry"] })];
  const assignments = { full: [...functional, ...visual], "chromium-1-of-2": functional.slice(0, 5), "chromium-2-of-2": functional.slice(5), "visual-regression": visual };
  return { schemaVersion: 1, project: "chromium", discoveryDigest: recordDigest([...assignments.full].sort()),
    assignments: Object.fromEntries(Object.entries(assignments).map(([key, identities]) => [key, { identities, digest: recordDigest([...identities].sort()) }])) };
}
const temporary = [];
afterEach(async () => { await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true }))); });

describe("validation evidence creation and admission", () => {
  it("checks both partition completeness and the reviewed optional-content registry", () => {
    expect(parseChromiumDiscovery(discovery())).toEqual(discovery());
    const altered = discovery(); altered.assignments["chromium-1-of-2"].identities.pop();
    expect(() => parseChromiumDiscovery(altered)).toThrow("digest");
    const duplicate = discovery(); duplicate.assignments["chromium-2-of-2"] = duplicate.assignments["chromium-1-of-2"];
    expect(() => parseChromiumDiscovery(duplicate)).toThrow("duplicate");
    const moved = discovery();
    for (const entry of Object.values(moved.assignments)) {
      entry.identities = entry.identities.map((id) => id === assignment[0] ? id.replace("semantic Education", "changed Education") : id);
      entry.digest = recordDigest([...entry.identities].sort());
    }
    moved.discoveryDigest = moved.assignments.full.digest;
    expect(() => parseChromiumDiscovery(moved)).toThrow("moved or removed");
  });

  it("creates a receipt only for complete assigned execution under the accepted generation", () => {
    const options = { plan, validator: "chromium-1-of-2", job: "browser-e2e", producer, assignment, browserReport: report(), durationMs: 20 };
    expect(createValidationReceipt(options)).toMatchObject({ planDigest: recordDigest(plan), snapshotDigest: digest, outcome: "success" });
    for (const patch of [{ status: "failed" }, { errorCount: 1 }, { cases: [] }, { identities: [] }]) {
      expect(() => createValidationReceipt({ ...options, browserReport: { ...report(), ...patch } })).toThrow();
    }
    const skipped = report(); skipped.cases[0].attempts[0].status = "skipped";
    skipped.cases[0].skipReason = allowedBrowserSkips[assignment[0]][0];
    expect(createValidationReceipt({ ...options, browserReport: skipped }).cases[0].skipReason).toBe(skipped.cases[0].skipReason);
    skipped.cases[0].skipReason = "New unreviewed excuse";
    expect(() => createValidationReceipt({ ...options, browserReport: skipped })).toThrow("Unexplained");
    expect(() => createValidationReceipt({ ...options, producer: { ...producer, runId: 99 } })).toThrow("another run");
  });

  it("binds independent security evidence to source instead of content preparation", () => {
    const options = { candidate, validator: "security-scans", producer: { ...producer, job: "security-scans" } };
    const receipt = createSourceReceipt(options);
    expect(verifySourceReceipt(receipt, options)).toEqual(receipt);
    expect(receipt).not.toHaveProperty("snapshotDigest");
    for (const patch of [{ outcome: "skipped" }, { validator: "codeql" }, { candidateDigest: "c".repeat(64) }, { schemaVersion: 2 }]) {
      expect(() => verifySourceReceipt({ ...receipt, ...patch }, options)).toThrow();
    }
    expect(() => createSourceReceipt({ ...options, validator: "quality" })).toThrow("Unknown");
    expect(() => createSourceReceipt({ ...options, producer: { ...options.producer, runNumber: 2 } })).toThrow("generation");
  });

  it("rejects missing, additional, malformed and linked evidence files", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-receipt-")); temporary.push(directory);
    await expect(readEvidenceArtifact(directory, "receipt.json")).rejects.toThrow("missing");
    await writeFile(path.join(directory, "receipt.json"), "{}");
    expect(await readEvidenceArtifact(directory, "receipt.json")).toEqual({});
    await writeFile(path.join(directory, ".env"), "private fixture");
    await expect(readEvidenceArtifact(directory, "receipt.json")).rejects.toThrow("extra");
    await rm(path.join(directory, ".env"));
    await writeFile(path.join(directory, "receipt.json"), "malformed");
    await expect(readEvidenceArtifact(directory, "receipt.json")).rejects.toThrow("malformed");
    await writeFile(path.join(directory, "receipt.json"), "");
    await expect(readEvidenceArtifact(directory, "receipt.json")).rejects.toThrow("size budget");
    await writeFile(path.join(directory, "receipt.json"), Buffer.alloc(8 * 1024 * 1024 + 1));
    await expect(readEvidenceArtifact(directory, "receipt.json")).rejects.toThrow("size budget");
    await rm(path.join(directory, "receipt.json"));
    await symlink("/dev/null", path.join(directory, "receipt.json"));
    await expect(readEvidenceArtifact(directory, "receipt.json")).rejects.toThrow("unsafe");
  });
});
