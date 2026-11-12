// @vitest-environment node

import { describe, expect, it } from "vitest";
import { scanSealedCandidate } from "./releaseStages.mjs";

const manifest = {
  candidate: {
    sourceCommit: "a".repeat(40),
    contentHash: "b".repeat(64),
    target: "production",
    publicBuildInputDigest: "c".repeat(64),
    snapshotRecordDigest: "d".repeat(64)
  }
};

const environment = {
  CI_GITLEAKS: "/runner/tools/gitleaks/gitleaks",
  RUNNER_TEMP: "/runner/temp"
};

describe("sealed built-output scanner admission", () => {
  it("scans the sealed directory and verifies the same candidate before and after a clean report", async () => {
    const verifies = [], scans = [];
    await scanSealedCandidate({
      projectRoot: "/candidate",
      releaseDirectory: "/runner/temp/portfolio-ci/release",
      manifest,
      environment,
      verifyRelease: async (directory, expected) => { verifies.push({ directory, expected }); },
      runScans: async (options) => { scans.push(options); return [{ tool: "gitleaks", status: "clean", findings: 0 }]; }
    });

    expect(scans).toEqual([{
      gitleaks: environment.CI_GITLEAKS,
      gitleaksMode: "dir",
      target: "/runner/temp/portfolio-ci/release",
      tempRoot: "/runner/temp/portfolio-ci-built-output-scan",
      root: "/candidate"
    }]);
    expect(verifies).toHaveLength(2);
    expect(verifies[0]).toEqual(verifies[1]);
  });

  it.each([
    ["findings", async () => [{ tool: "gitleaks", status: "findings", findings: 1 }]],
    ["missing report", async () => [{ tool: "gitleaks", status: "error", findings: 0 }]],
    ["malformed report", async () => { throw new Error("scanner report malformed"); }],
    ["missing scanner", async () => [{ tool: "zizmor", status: "clean", findings: 0 }]]
  ])("fails closed for a %s built-output scan", async (_name, runScans) => {
    await expect(scanSealedCandidate({
      projectRoot: "/candidate",
      releaseDirectory: "/runner/temp/portfolio-ci/release",
      manifest,
      environment,
      verifyRelease: async () => {},
      runScans
    })).rejects.toThrow("Sealed candidate security scan failed.");
  });

  it("does not allow an unavailable pinned scanner path", async () => {
    await expect(scanSealedCandidate({
      releaseDirectory: "/runner/temp/portfolio-ci/release",
      manifest,
      environment: { ...environment, CI_GITLEAKS: "" },
      verifyRelease: async () => {},
      runScans: async () => [{ tool: "gitleaks", status: "clean", findings: 0 }]
    })).rejects.toThrow("Sealed candidate security scan failed.");
  });
});
