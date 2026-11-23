import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("dependency update configuration", () => {
  it("schedules weekly reviews for npm, actions, and every Terraform state root", () => {
    const config = parse(readFileSync(".github/dependabot.yml", "utf8"));
    expect(config.version).toBe(2);
    expect(config.updates.map((entry) => entry["package-ecosystem"])).toEqual(["npm", "github-actions", "terraform"]);
    expect(config.updates.every((entry) => entry.schedule.interval === "weekly")).toBe(true);
    // Dependabot uses the first matching group and defaults applies-to to version updates.
    expect(Object.entries(config.updates[0].groups)).toEqual([
      ["next-framework", { patterns: ["next", "@next/eslint-plugin-next"] }],
      ["routine-patches", { patterns: ["*"], "update-types": ["patch"] }],
    ]);
    expect(Object.entries(config.updates[1].groups)).toEqual([
      ["codeql-action", { patterns: ["github/codeql-action", "github/codeql-action/*"] }],
      ["routine-patches", { patterns: ["*"], "update-types": ["patch"] }],
    ]);
    expect(config.updates[2].directories).toEqual(["/infra/modules/edge-controls", "/infra/modules/pages-environments", "/infra/modules/preview-access", "/infra/states/cloudflare-audit", "/infra/states/cloudflare-preview", "/infra/states/cloudflare-production", "/infra/states/cloudflare-shared", "/infra/states/github-governance"]);
    expect(config.updates[2].groups["terraform-providers"]["group-by"]).toBe("dependency-name");
    expect(config.updates[2].groups["terraform-providers"].patterns).toEqual(["*"]);
  });
});
