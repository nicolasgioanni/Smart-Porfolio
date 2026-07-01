import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package local automation scripts", () => {
  it("keeps existing scripts and exposes local automation aliases", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));

    for (const scriptName of [
      "dev",
      "generate:content",
      "build",
      "lint",
      "typecheck",
      "test",
      "verify",
      "setup:local",
      "dev:smart",
      "verify:local",
      "clean:local",
      "setup:local:node",
      "dev:smart:node",
      "verify:local:node",
      "clean:local:node"
    ]) {
      expect(packageJson.scripts[scriptName]).toBeTypeOf("string");
    }
  });
});