import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

describe("package and CI scripts", () => {
  it("keeps existing scripts and exposes local automation aliases", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));

    for (const scriptName of [
      "dev",
      "dev:pages",
      "generate:content",
      "build",
      "lint",
      "typecheck",
      "test",
      "test:footer",
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

  it("keeps the focused footer regression suite in CI alongside the full test suite", async () => {
    const packageJson = JSON.parse(await readFile(path.join(process.cwd(), "package.json"), "utf8"));
    const ciWorkflow = await readFile(path.join(process.cwd(), ".github", "workflows", "ci.yml"), "utf8");

    expect(packageJson.scripts["test:footer"]).toBe(
      "vitest run src/components/layout/InteractiveBlobFooter.test.tsx src/components/layout/footerStyles.test.ts"
    );
    expect(ciWorkflow).toMatch(/- name: Footer regression tests\s+run: npm run test:footer/);
    expect(ciWorkflow).toMatch(/- name: Test\s+run: npm run test/);
    expect(ciWorkflow).toMatch(/push:\s+branches: \[main, develop\]/);
    expect(ciWorkflow).toMatch(/pull_request:\s+branches: \[main, develop\]/);
  });
});
