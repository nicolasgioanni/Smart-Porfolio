import { describe, expect, it, vi } from "vitest";
import { repository, workflowPath } from "./plan.mjs";
import { readBranchTip, resolveCandidate, writeOutputs } from "./resolve.mjs";

const sha = "a".repeat(40), head = "b".repeat(40);
function input(eventName = "push", ref = "refs/heads/main") {
  return { environment: { GITHUB_REPOSITORY: repository, GITHUB_EVENT_NAME: eventName, GITHUB_REF: ref,
    GITHUB_WORKFLOW_REF: `${repository}/${workflowPath}@${ref}`, GITHUB_WORKFLOW_SHA: sha, GITHUB_SHA: sha,
    GITHUB_RUN_ID: "12345", GITHUB_RUN_NUMBER: "350", GITHUB_RUN_ATTEMPT: "1", CI_FORCE_DEPLOY: "false" },
  event: { repository: { full_name: repository }, number: 123, pull_request: { base: { ref: "main" }, head: { sha: head, repo: { fork: true } } } },
  checkoutSha: sha, getBranchTip: vi.fn().mockResolvedValue(sha) };
}

describe("lightweight candidate resolution", () => {
  it("keeps fork PR resolution credential-free and binds the merge SHA separately", async () => {
    const value = input("pull_request", "refs/pull/123/merge");
    expect(await resolveCandidate(value)).toMatchObject({ sourceSha: sha, runHeadSha: head, branchTip: null, force: false });
    expect(value.getBranchTip).not.toHaveBeenCalled();
  });
  it("observes only the selected trusted branch before expensive preparation", async () => {
    const value = input("push", "refs/heads/develop"); value.getBranchTip.mockResolvedValue(head);
    expect(await resolveCandidate(value)).toMatchObject({ sourceSha: sha, branchTip: head, ref: "refs/heads/develop" });
    expect(value.getBranchTip).toHaveBeenCalledExactlyOnceWith("develop");
  });
  it("rejects untrusted dispatch refs and wrong checkouts before requesting provider data", async () => {
    for (const value of [input("workflow_dispatch", "refs/heads/feature"), { ...input(), checkoutSha: head }]) {
      await expect(resolveCandidate(value)).rejects.toThrow();
      expect(value.getBranchTip).not.toHaveBeenCalled();
    }
    const forced = input("workflow_dispatch"); forced.environment.CI_FORCE_DEPLOY = "true";
    expect((await resolveCandidate(forced)).force).toBe(true);
    forced.environment.CI_FORCE_DEPLOY = "yes";
    await expect(resolveCandidate(forced)).rejects.toThrow("true or false");
  });
  it("does not accept unavailable, malformed or substituted branch observations", async () => {
    for (const response of [new Response("", { status: 403 }), new Response("invalid"), Response.json({ ref: "refs/heads/develop", object: { type: "commit", sha } }), Response.json({ ref: "refs/heads/main", object: { type: "tag", sha } })]) {
      await expect(readBranchTip("main", { fetchImpl: async () => response, token: "fixture" })).rejects.toThrow();
    }
    const fetchImpl = vi.fn(async () => Response.json({ ref: "refs/heads/main", object: { type: "commit", sha } }));
    expect(await readBranchTip("main", { fetchImpl, token: "fixture" })).toBe(sha);
    expect(fetchImpl.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { Authorization: "Bearer fixture" } });
  });
  it("refuses output injection rather than creating arbitrary workflow outputs", async () => {
    await expect(writeOutputs({ candidate: "good\nevil=true" }, "unused-test-output")).rejects.toThrow("Unsafe");
    await expect(writeOutputs({ "bad=name": "value" }, "unused-test-output")).rejects.toThrow("Unsafe");
  });
});
