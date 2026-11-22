import { describe, expect, it, vi } from "vitest";
import { chmod, mkdtemp, mkdir, readFile, realpath, rm, stat, symlink } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { assessClassic, assessRepository, assessRuleset, request, runChecks, writeEvidence } from "./check.mjs";

const url = "https://api.github.com/repos/nicolasgioanni/Smart-Porfolio/rulesets/24763569";
const rule = { id: 24763569, name: "protect-permanent-branches", target: "branch", enforcement: "active", conditions: { ref_name: { include: ["refs/heads/main", "refs/heads/develop"], exclude: [] } }, rules: [{ type: "deletion" }, { type: "non_fast_forward" }], bypass_actors: [] };
const repo = { full_name: "nicolasgioanni/Smart-Porfolio", default_branch: "main", private: false, archived: false, disabled: false, permissions: { admin: true } };
const classic = { required_pull_request_reviews: { dismiss_stale_reviews: false, require_code_owner_reviews: false, required_approving_review_count: 0, require_last_push_approval: false, bypass_pull_request_allowances: { users: [], teams: [], apps: [] } }, required_status_checks: { strict: true, checks: [{ context: "verify", app_id: 15368 }] }, enforce_admins: { enabled: true }, allow_force_pushes: { enabled: false }, allow_deletions: { enabled: false } };

describe("bounded posture observations", () => {
  it("accepts known provider shapes and treats bypass visibility as authenticated evidence", () => {
    expect(assessRepository(repo)).toBe("pass");
    expect(assessRepository({ ...repo, full_name: "other/repo" })).toBe("fail");
    expect(assessRuleset(rule, true)).toEqual({ ruleset: "pass", bypass: "pass" });
    expect(assessRuleset(rule, false).bypass).toBe("unavailable");
    expect(assessRuleset({ ...rule, bypass_actors: undefined }, true).bypass).toBe("unavailable");
    expect(assessRuleset({ ...rule, bypass_actors: [{}] }, true).bypass).toBe("fail");
    expect(assessRuleset({ ...rule, conditions: { ref_name: { include: ["~ALL"], exclude: [] } } }, true).ruleset).toBe("fail");
    expect(assessClassic(classic)).toBe("pass");
    expect(assessClassic({ ...classic, enforce_admins: { enabled: false } })).toBe("fail");
    for (const invalid of [undefined, null, [], {}, { ...classic.required_pull_request_reviews, required_approving_review_count: -1 }, { ...classic.required_pull_request_reviews, dismiss_stale_reviews: "false" }, { ...classic.required_pull_request_reviews, bypass_pull_request_allowances: null }, { ...classic.required_pull_request_reviews, bypass_pull_request_allowances: {} }, { ...classic.required_pull_request_reviews, bypass_pull_request_allowances: { users: [{}], teams: [], apps: [] } }, { ...classic.required_pull_request_reviews, bypass_pull_request_allowances: { users: [], teams: [{}], apps: [] } }, { ...classic.required_pull_request_reviews, bypass_pull_request_allowances: { users: [], teams: [], apps: [{}] } }]) {
      expect(assessClassic({ ...classic, required_pull_request_reviews: invalid })).toBe("fail");
    }
    expect(assessClassic({ ...classic, required_pull_request_reviews: { dismiss_stale_reviews: false, require_code_owner_reviews: false, required_approving_review_count: 0 } })).toBe("pass");
  });
  it("does not follow redirects or send credentials to another host or path", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://evil.example/" } }));
    expect((await request(url, { token: "secret", fetcher })).status).toBe(302);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].redirect).toBe("manual");
    await expect(request("https://evil.example/", { token: "secret", fetcher })).rejects.toThrow();
    await expect(request("https://nicolasmgioanni.dev/", { token: "secret", fetcher })).rejects.toThrow();
    await expect(request("https://api.github.com/repos/elsewhere", { token: "secret", fetcher })).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("bounds declared and streamed bodies and a stalled response", async () => {
    await expect(request(url, { fetcher: async () => new Response("x", { headers: { "content-length": "999999" } }) })).rejects.toThrow();
    await expect(request(url, { fetcher: async () => new Response("x".repeat(140000)) })).rejects.toThrow();
    await expect(request(url, { deadline: 10, fetcher: async () => new Response(new ReadableStream({ pull() { return new Promise(() => {}); } })) })).rejects.toThrow();
    await expect(request(url, { deadline: 10, fetcher: () => new Promise(() => {}) })).rejects.toThrow();
  });
  it("collapses malformed and provider errors without leaking remote text and marks missing authenticated evidence", async () => {
    const fetcher = async () => new Response("PRIVATE-TEXT", { status: 200, headers: { "content-type": "application/json" } });
    const report = await runChecks({ fetcher });
    expect(report.findings.find((f) => f.check === "github-classic-main").status).toBe("unavailable");
    expect(report.findings.find((f) => f.check === "github-ruleset-bypass").status).toBe("unavailable");
    expect(JSON.stringify(report.findings)).not.toContain("PRIVATE-TEXT");
  });
  it("accepts a complete positive fixture and distinguishes static from Function headers", async () => {
    const common = { "strict-transport-security": "max-age=31536000", "x-content-type-options": "nosniff", "x-frame-options": "DENY", "permissions-policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()" };
    const staticHeaders = { ...common, "referrer-policy": "strict-origin-when-cross-origin", "content-security-policy": "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'sha256-example'" };
    const functionHeaders = { ...common, "referrer-policy": "no-referrer", "cache-control": "no-store", allow: "POST", "content-security-policy": "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'" };
    const identity = { schemaVersion: 2, commitSha: "a".repeat(40), contentHash: "b".repeat(64), generatedAt: "2026-01-01T00:00:00Z", deployedAt: "2026-01-01T00:00:00Z", target: "production", publicBuildInputDigest: "c".repeat(64), producer: { kind: "github-actions", runId: "1", runNumber: 1, attempt: 1 } };
    const fetcher = async (address) => {
      const u = new URL(address);
      if (u.origin === "https://api.github.com") {
        const value = u.pathname.endsWith("/protection") ? classic : u.pathname.endsWith("/24763569") ? rule : repo;
        return Response.json(value);
      }
      if (u.hostname.startsWith("www.")) return new Response(null, { status: 301, headers: { location: "https://nicolasmgioanni.dev/", "strict-transport-security": "max-age=31536000" } });
      if (u.pathname === "/") return new Response(null, { headers: staticHeaders });
      if (u.pathname === "/content-version.json") return Response.json({ ...identity, target: u.hostname.startsWith("develop.") ? "preview" : "production" }, { headers: { "cache-control": "no-store", pragma: "no-cache" } });
      return new Response(null, { status: 405, headers: functionHeaders });
    };
    const report = await runChecks({ token: "secret", expectedCommit: "a".repeat(40), fetcher });
    expect(report.findings.filter((f) => f.status !== "pass")).toEqual([]);
    expect(JSON.stringify(report.findings)).not.toContain("sha256-example");
    const limited = await runChecks({ token: "secret", fetcher: async (address, options) => {
      if (address === "https://api.github.com/repos/nicolasgioanni/Smart-Porfolio") return Response.json({ ...repo, permissions: { admin: false } });
      return fetcher(address, options);
    } });
    expect(limited.findings.find((f) => f.check === "github-ruleset-bypass").status).toBe("unavailable");
  });
  it("writes only an exclusive private artifact outside worktrees", async () => {
    const root = await mkdtemp(path.join(await realpath(os.tmpdir()), "posture-test-"));
    try {
      await chmod(root, 0o700);
      const output = path.join(root, "evidence.json");
      await writeEvidence(output, { evidence: ["private"] });
      expect((await stat(output)).mode & 0o777).toBe(0o600);
      expect(await readFile(output, "utf8")).toContain("private");
      await expect(writeEvidence(output, {})).rejects.toThrow();
      await mkdir(path.join(root, ".git"));
      await expect(writeEvidence(path.join(root, "inside.json"), {})).rejects.toThrow();
      const alias = `${root}-alias`; await symlink(root, alias);
      try { await expect(writeEvidence(path.join(alias, "alias.json"), {})).rejects.toThrow(); } finally { await rm(alias); }
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
