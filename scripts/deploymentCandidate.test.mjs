import { describe, expect, it } from "vitest";
import { assertCurrentDeploymentCandidate } from "./deploymentCandidate.mjs";

const candidateSha = "a".repeat(40);

describe("deployment candidate freshness", () => {
  it("reads the remote branch immediately and accepts only the exact candidate", () => {
    const calls = [];
    const git = (args) => {
      calls.push(args);
      if (args[0] === "rev-parse") return candidateSha;
      return "";
    };

    expect(assertCurrentDeploymentCandidate("develop", candidateSha, { git })).toBe(candidateSha);
    expect(calls).toEqual([
      ["fetch", "--no-tags", "origin", "+refs/heads/develop:refs/remotes/origin/develop"],
      ["rev-parse", "refs/remotes/origin/develop"]
    ]);
  });

  it("rejects an advanced branch before a deployment mutation can run", () => {
    const git = (args) => (args[0] === "rev-parse" ? "b".repeat(40) : "");

    expect(() => assertCurrentDeploymentCandidate("main", candidateSha, { git })).toThrow(
      /Refusing to deploy stale main revision/
    );
  });

  it("refuses unsupported branch names and abbreviated candidate IDs", () => {
    expect(() => assertCurrentDeploymentCandidate("feature", candidateSha)).toThrow(/main or develop/);
    expect(() => assertCurrentDeploymentCandidate("main", "deadbeef")).toThrow(/full Git SHA/);
  });
});
