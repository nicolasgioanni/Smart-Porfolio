import { readFile } from "node:fs/promises";
import path from "node:path";

const exactKeys = (value, keys) => value !== null && typeof value === "object" && !Array.isArray(value)
  && Object.keys(value).length === keys.length && keys.every((key) => Object.hasOwn(value, key));
const exactMembers = (value, members) => Array.isArray(value) && value.length === members.length
  && members.every((member) => value.filter((item) => item === member).length === 1);

// Source contract only: this does not inspect or mutate GitHub's live settings.
export function validatePermanentBranchRuleset(ruleset) {
  if (!exactKeys(ruleset, ["name", "target", "enforcement", "conditions", "rules", "bypass_actors"])
    || ruleset.name !== "protect-permanent-branches" || ruleset.target !== "branch" || ruleset.enforcement !== "active"
    || !exactKeys(ruleset.conditions, ["ref_name"]) || !exactKeys(ruleset.conditions.ref_name, ["include", "exclude"])
    || !exactMembers(ruleset.conditions.ref_name.include, ["refs/heads/main", "refs/heads/develop"])
    || !exactMembers(ruleset.conditions.ref_name.exclude, []) || !exactMembers(ruleset.bypass_actors, [])
    || !Array.isArray(ruleset.rules) || ruleset.rules.length !== 2
    || !ruleset.rules.every((rule) => exactKeys(rule, ["type"]))
    || !exactMembers(ruleset.rules.map((rule) => rule.type), ["deletion", "non_fast_forward"])) {
    throw new Error("Permanent-branch ruleset violates the bounded source contract.");
  }
}

export async function validatePermanentBranchRulesetFile(root) {
  const source = await readFile(path.join(root, ".github/rulesets/protect-permanent-branches.json"), "utf8");
  validatePermanentBranchRuleset(JSON.parse(source));
}
