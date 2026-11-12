import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validatePermanentBranchRuleset, validatePermanentBranchRulesetFile } from "./permanentBranchRuleset.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const source = JSON.parse(await readFile(path.join(projectRoot, ".github/rulesets/protect-permanent-branches.json"), "utf8"));

describe("permanent-branch ruleset source contract", () => {
  it("accepts the tracked payload, independently of array order", async () => {
    await expect(validatePermanentBranchRulesetFile(projectRoot)).resolves.toBeUndefined();
    const reordered = structuredClone(source);
    reordered.conditions.ref_name.include.reverse();
    reordered.rules.reverse();
    expect(() => validatePermanentBranchRuleset(reordered)).not.toThrow();
  });

  it.each([
    ["missing ref", (r) => r.conditions.ref_name.include.pop()],
    ["extra ref", (r) => r.conditions.ref_name.include.push("refs/heads/other")],
    ["exclusion", (r) => r.conditions.ref_name.exclude.push("refs/heads/main")],
    ["disabled enforcement", (r) => { r.enforcement = "disabled"; }],
    ["bypass actor", (r) => r.bypass_actors.push({ actor_id: 1 })],
    ["missing deletion protection", (r) => { r.rules = r.rules.filter((rule) => rule.type !== "deletion"); }],
    ["missing non-fast-forward protection", (r) => { r.rules = r.rules.filter((rule) => rule.type !== "non_fast_forward"); }],
    ["additional update restriction", (r) => r.rules.push({ type: "update" })],
    ["unexpected rule parameters", (r) => { r.rules[0].parameters = {}; }],
    ["duplicate ref", (r) => { r.conditions.ref_name.include[1] = r.conditions.ref_name.include[0]; }]
  ])("rejects %s", (_label, mutate) => {
    const invalid = structuredClone(source);
    mutate(invalid);
    expect(() => validatePermanentBranchRuleset(invalid)).toThrow("bounded source contract");
  });
});
