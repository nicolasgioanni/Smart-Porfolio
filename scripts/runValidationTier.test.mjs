import { existsSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  priorityTestDirectories,
  priorityTestTargets,
  requiredPriorityFiles
} from "./runValidationTier.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");

describe("priority validation tier", () => {
  it("selects the required trust-boundary contracts before running Vitest", () => {
    expect(priorityTestTargets).toContain("functions");

    for (const directory of priorityTestDirectories) {
      expect(existsSync(path.join(projectRoot, directory))).toBe(true);
      expect(priorityTestTargets).toContain(directory);
    }

    for (const requiredFile of requiredPriorityFiles) {
      expect(existsSync(path.join(projectRoot, requiredFile))).toBe(true);
    }
  });
});
