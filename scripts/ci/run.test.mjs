import { describe, expect, it, vi } from "vitest";
import { run, upstreamDiagnostics } from "./run.mjs";

describe("aggregate upstream diagnostics", () => {
  it("reports preparation and preflight failure without requiring a plan or emitting outputs", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    const needs = {
      "prepare-content": { result: "failure", outputs: { preflight_result: "failure", plan: "sensitive-marker-plan" } },
      "resolve-candidate": { result: "success" },
      quality: { result: "skipped" },
      "untrusted-job-marker": { result: "failure" }
    };
    try {
      await expect(run("verify", { CI_NEEDS: JSON.stringify(needs) })).rejects.toThrow("Missing or invalid prepared output");
      const message = error.mock.calls[0][0];
      expect(message).toContain("prepare-content=failure");
      expect(message).toContain("prepare-content preflight=failure");
      expect(message).toContain("quality=skipped");
      expect(message).not.toContain("sensitive-marker");
    } finally { error.mockRestore(); }
  });

  it("accepts only known status literals and never reports untrusted input", () => {
    const result = upstreamDiagnostics({ "prepare-content": { result: "sensitive-marker", outputs: { preflight_result: "sensitive-marker" } } });
    expect(result).toContain("prepare-content=unknown");
    expect(result).toContain("prepare-content preflight=unknown");
    expect(result).not.toContain("sensitive-marker");
  });

  it("fails closed with malformed needs and does not echo its contents", async () => {
    const error = vi.spyOn(console, "error").mockImplementation(() => {});
    try {
      await expect(run("verify", { CI_NEEDS: "sensitive-marker{" })).rejects.toThrow("CI_NEEDS is not valid JSON");
      expect(error.mock.calls[0][0]).not.toContain("sensitive-marker");
    } finally { error.mockRestore(); }
  });
});
