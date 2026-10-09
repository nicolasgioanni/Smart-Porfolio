import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const rulesetPath = path.join(
  projectRoot,
  ".github",
  "rulesets",
  "protect-permanent-branches.json"
);

describe("permanent-branch ruleset", () => {
  it("blocks deletion and non-fast-forward updates only on the exact permanent refs", async () => {
    const ruleset = JSON.parse(await readFile(rulesetPath, "utf8"));

    expect(ruleset.name).toBe("protect-permanent-branches");
    expect(ruleset.target).toBe("branch");
    expect(ruleset.enforcement).toBe("active");
    expect(ruleset.conditions).toEqual({
      ref_name: {
        include: ["refs/heads/main", "refs/heads/develop"],
        exclude: []
      }
    });
    expect(ruleset.rules).toEqual([
      { type: "deletion" },
      { type: "non_fast_forward" }
    ]);
    expect(ruleset.bypass_actors).toEqual([]);

    expect(ruleset.rules.map(({ type }) => type)).not.toEqual(
      expect.arrayContaining(["creation", "update"])
    );
  });
});
