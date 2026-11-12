import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";

describe("dependency update configuration", () => {
  it("schedules weekly reviews for npm, actions, and every Terraform state root", () => {
    const config = parse(readFileSync(".github/dependabot.yml", "utf8"));
    expect(config.version).toBe(2);
    expect(config.updates.map((entry) => entry["package-ecosystem"])).toEqual(["npm", "github-actions", "terraform"]);
    expect(config.updates.every((entry) => entry.schedule.interval === "weekly")).toBe(true);
    expect(config.updates[0].groups["next-framework"].patterns).toEqual(["next", "@next/eslint-plugin-next"]);
    expect(config.updates[2].directories).toEqual(["/infra/states/cloudflare-audit", "/infra/states/cloudflare-preview", "/infra/states/cloudflare-production", "/infra/states/cloudflare-shared", "/infra/states/github-governance"]);
  });
});
