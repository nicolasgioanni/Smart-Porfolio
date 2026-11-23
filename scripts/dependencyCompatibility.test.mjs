import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const estreeRequire = createRequire(require.resolve("@typescript-eslint/typescript-estree"));

describe("scoped dependency compatibility", () => {
  it("preserves the minimatch API used by typescript-estree's project service", () => {
    const { minimatch } = estreeRequire("minimatch");
    expect(minimatch(".config/example.ts", ".config/*.ts", { dot: true })).toBe(true);
    expect(minimatch(".config/example.js", ".config/*.ts", { dot: true })).toBe(false);
  });
});
