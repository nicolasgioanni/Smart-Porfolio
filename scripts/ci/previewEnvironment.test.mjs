// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { verifyPreviewEnvironment } from "./previewEnvironment.mjs";

const env = { GITHUB_REPOSITORY: "owner/repo", GH_TOKEN: "token" };
const settings = { id: 161088068, name: "preview", deployment_branch_policy: { protected_branches: false, custom_branch_policies: true }, protection_rules: [{ id: 3756, type: "branch_policy" }] };
const policies = { total_count: 1, branch_policies: [{ id: 361471, node_id: "node", name: "develop" }] };
function api(first = settings, second = policies) { return vi.fn(async (url, options) => { expect(options.redirect).toBe("manual"); return new Response(JSON.stringify(url.includes("deployment-branch-policies") ? second : first), { headers: { "content-type": "application/json; charset=utf-8" } }); }); }
describe("preview GitHub environment preflight", () => {
  it("accepts the existing exact develop branch policy", async () => { const fetcher = api(); await verifyPreviewEnvironment({ environment: env, fetcher }); expect(fetcher).toHaveBeenCalledTimes(2); });
  it.each([
    ["wrong name", { ...settings, name: "production" }, policies],
    ["all branches", { ...settings, deployment_branch_policy: null }, policies],
    ["no branch protection", { ...settings, protection_rules: [] }, policies],
    ["administrator bypass", { ...settings, can_admins_bypass: true }, policies],
    ["wildcard", settings, { ...policies, branch_policies: [{ name: "*" }] }],
    ["multiple policies", settings, { total_count: 2, branch_policies: [{ name: "develop" }, { name: "main" }] }],
    ["tag policy", settings, { ...policies, branch_policies: [{ name: "develop", type: "tag" }] }]
  ])("rejects %s", async (_name, a, b) => { await expect(verifyPreviewEnvironment({ environment: env, fetcher: api(a, b) })).rejects.toThrow(); });
  it("rejects missing or redirected evidence", async () => { await expect(verifyPreviewEnvironment({ environment: env, fetcher: async () => new Response(null, { status: 404 }) })).rejects.toThrow(); });
});
