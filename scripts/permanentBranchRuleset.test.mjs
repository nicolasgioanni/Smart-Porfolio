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
  it("matches the bounded permanent-branch governance contract exactly", async () => {
    const ruleset = JSON.parse(await readFile(rulesetPath, "utf8"));

    expect(ruleset).toEqual({
      name: "protect-permanent-branches",
      target: "branch",
      enforcement: "active",
      conditions: {
        ref_name: {
          include: ["refs/heads/main", "refs/heads/develop"],
          exclude: []
        }
      },
      rules: [
        { type: "deletion" },
        { type: "non_fast_forward" }
      ],
      bypass_actors: []
    });
  });
});
