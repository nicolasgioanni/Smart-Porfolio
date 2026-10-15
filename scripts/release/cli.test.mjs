// @vitest-environment node
import { execFile } from "node:child_process";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const execFileAsync = promisify(execFile);
const script = path.resolve("scripts/release.mjs");

describe("release command-line parsing", () => {
  it("rejects repeated option names before invoking a release stage", async () => {
    await expect(execFileAsync(process.execPath, [script, "compile", "--out", "out", "--out", "other", "--sha", "a".repeat(40)])).rejects.toMatchObject({
      stderr: expect.stringContaining("unique --name value pairs")
    });
  });
});
