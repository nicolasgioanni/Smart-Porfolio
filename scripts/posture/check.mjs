import { randomUUID } from "node:crypto";
import { constants } from "node:fs";
import { lstat, open, realpath, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseContentVersion } from "../writeContentVersion.mjs";

const repo = "/repos/nicolasgioanni/Smart-Porfolio";
const origins = ["https://nicolasmgioanni.dev", "https://smart-portfolio-bds.pages.dev", "https://develop.smart-portfolio-bds.pages.dev"];
const apiPaths = [repo, `${repo}/rulesets/24763569`, `${repo}/branches/main/protection`];
const cap = 128 * 1024;
const timeout = 8000;
const execFileAsync = promisify(execFile);

function cancel(value) { try { void Promise.resolve(value?.cancel()).catch(() => {}); } catch { /* best effort */ } }

// The deadline covers both headers and the complete bounded body. Redirects are never followed.
export async function request(url, { method = "GET", token, fetcher = fetch, deadline = timeout } = {}) {
  const parsed = new URL(url);
  const github = parsed.origin === "https://api.github.com" && apiPaths.includes(parsed.pathname) && !parsed.search;
  const site = origins.includes(parsed.origin) && (["/", "/content-version.json", "/api/contact", "/api/contact/verify"].includes(parsed.pathname)) && (!parsed.search || (parsed.pathname === "/content-version.json" && /^\?posture=[0-9a-f-]{36}$/.test(parsed.search)));
  const canonical = parsed.href === "https://www.nicolasmgioanni.dev/";
  if (parsed.username || parsed.password || parsed.hash || (!github && !site && !canonical) || (token && !github) || !["GET", "HEAD"].includes(method)) throw new Error("Invalid request target");
  const controller = new AbortController();
  let reader;
  let response;
  let expired = false;
  let timer;
  const operation = (async () => {
    response = await fetcher(url, { method, redirect: "manual", signal: controller.signal, headers: {
      "User-Agent": "smart-portfolio-posture-check", "Cache-Control": "no-cache", Pragma: "no-cache",
      ...(github ? { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {})
    } });
    if (expired) { cancel(response.body); throw new Error("Deadline"); }
    const length = response.headers.get("content-length");
    if (method !== "HEAD" && length !== null && (!/^(0|[1-9][0-9]*)$/.test(length) || Number(length) > cap)) throw new Error("Size");
    let body = "";
    if (method !== "HEAD" && response.body && !(response.status >= 300 && response.status < 400)) {
      reader = response.body.getReader();
      if (expired) { cancel(reader); throw new Error("Deadline"); }
      const chunks = []; let size = 0;
      for (;;) {
        const item = await reader.read();
        if (item.done) break;
        if (Object.prototype.toString.call(item.value) !== "[object Uint8Array]" || (size += item.value.byteLength) > cap) throw new Error("Size");
        chunks.push(item.value);
      }
      body = new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks));
    }
    return { status: response.status, headers: Object.fromEntries(response.headers), body };
  })();
  const limit = new Promise((_, reject) => { timer = setTimeout(() => { expired = true; controller.abort(); cancel(reader); cancel(response?.body); reject(new Error("Deadline")); }, deadline); });
  try { return await Promise.race([operation, limit]); }
  finally { clearTimeout(timer); cancel(reader); cancel(response?.body); void operation.catch(() => {}); }
}

const ok = (condition) => condition ? "pass" : "fail";
const json = (response) => { if (response.status !== 200 || !/^application\/json\b/i.test(response.headers["content-type"] ?? "")) throw new Error("Invalid JSON response"); return JSON.parse(response.body); };
const same = (a, b) => Array.isArray(a) && a.length === b.length && [...a].sort().every((v, i) => v === [...b].sort()[i]);
export function assessRepository(v) { return ok(v?.full_name === "nicolasgioanni/Smart-Porfolio" && v?.default_branch === "main" && v?.private === false && v?.archived === false && v?.disabled === false); }
export function assessRuleset(v, authenticated) {
  const scope = v?.conditions?.ref_name;
  const rules = v?.rules;
  const base = v?.id === 24763569 && v?.name === "protect-permanent-branches" && v?.target === "branch" && v?.enforcement === "active" && same(scope?.include, ["refs/heads/main", "refs/heads/develop"]) && same(scope?.exclude, []) && Array.isArray(rules) && same(rules.map((r) => r?.type), ["deletion", "non_fast_forward"]);
  if (!base) return { ruleset: "fail", bypass: "unavailable" };
  return { ruleset: "pass", bypass: authenticated && Array.isArray(v.bypass_actors) ? ok(v.bypass_actors.length === 0) : "unavailable" };
}
export function assessClassic(v) {
  const checks = v?.required_status_checks;
  const reviews = v?.required_pull_request_reviews;
  const bypass = reviews?.bypass_pull_request_allowances;
  const validReviews = reviews && typeof reviews === "object" && !Array.isArray(reviews) &&
    typeof reviews.dismiss_stale_reviews === "boolean" && typeof reviews.require_code_owner_reviews === "boolean" &&
    Number.isSafeInteger(reviews.required_approving_review_count) && reviews.required_approving_review_count >= 0 &&
    (reviews.require_last_push_approval === undefined || typeof reviews.require_last_push_approval === "boolean") &&
    (bypass === undefined || (bypass && typeof bypass === "object" && !Array.isArray(bypass) &&
      Object.keys(bypass).every((key) => ["users", "teams", "apps"].includes(key)) &&
      ["users", "teams", "apps"].every((key) => Array.isArray(bypass[key]) && bypass[key].length === 0)));
  return ok(validReviews && checks?.strict === true && Array.isArray(checks.checks) && checks.checks.some((c) => c.context === "verify" && c.app_id === 15368) && v?.enforce_admins?.enabled === true && v?.allow_force_pushes?.enabled === false && v?.allow_deletions?.enabled === false);
}
function hasHsts(h) {
  const match = /(?:^|;)\s*max-age\s*=\s*(\d+)(?:\s*;|\s*$)/i.exec(h["strict-transport-security"] ?? "");
  return Boolean(match && Number(match[1]) >= 31536000);
}
function assessHeaders(h, functionResponse = false) {
  const csp = h["content-security-policy"] ?? "";
  const entries = csp.split(";").map((part) => part.trim().split(/\s+/)).filter((x) => x[0]).map(([name, ...values]) => [name.toLowerCase(), values]);
  if (new Set(entries.map(([name]) => name)).size !== entries.length) return "fail";
  const directives = new Map(entries);
  const exact = (d, values) => same(directives.get(d), values);
  const common = hasHsts(h) && h["x-content-type-options"]?.toLowerCase() === "nosniff" && h["x-frame-options"]?.toUpperCase() === "DENY" && h["permissions-policy"] === "camera=(), geolocation=(), microphone=(), payment=(), usb=()";
  if (functionResponse) return ok(common && h["referrer-policy"] === "no-referrer" && /\bno-store\b/i.test(h["cache-control"] ?? "") && exact("default-src", ["'none'"]) && exact("base-uri", ["'none'"]) && exact("form-action", ["'none'"]) && exact("frame-ancestors", ["'none'"]));
  const scripts = directives.get("script-src");
  return ok(common && h["referrer-policy"] === "strict-origin-when-cross-origin" && exact("default-src", ["'self'"]) && exact("object-src", ["'none'"]) && exact("frame-ancestors", ["'none'"]) && exact("base-uri", ["'self'"]) && exact("form-action", ["'self'"]) && Array.isArray(scripts) && scripts.includes("'self'") && scripts.every((v) => v === "'self'" || v === "https://challenges.cloudflare.com" || /^'sha256-[A-Za-z0-9+/]+={0,2}'$/.test(v)));
}

export async function runChecks({ token, expectedCommit, fetcher = fetch, deadline } = {}) {
  const findings = []; const evidence = [];
  let githubAdmin = false;
  const record = (check, status) => findings.push({ check, status });
  const observe = async (check, url, options, assess) => {
    try { const result = await request(url, { ...options, fetcher, deadline }); evidence.push({ check, response: result }); assess(result); }
    catch { record(check, "unavailable"); }
  };
  for (const [i, origin] of origins.entries()) {
    const label = ["apex", "production-pages", "develop-preview"][i];
    await observe(`${label}-static`, `${origin}/`, { method: "HEAD" }, (r) => { record(`${label}-static`, ok(r.status === 200)); record(`${label}-static-headers`, assessHeaders(r.headers)); });
    const suffix = `?posture=${randomUUID()}`;
    await observe(`${label}-identity`, `${origin}/content-version.json${suffix}`, {}, (r) => {
      const v = parseContentVersion(json(r));
      record(`${label}-identity`, "pass");
      record(`${label}-schema-v2`, ok(v.schemaVersion === 2 && v.target === (i === 2 ? "preview" : "production")));
      if (expectedCommit) record(`${label}-expected-commit`, ok(v.commitSha === expectedCommit));
      record(`${label}-identity-cache`, ok(/\bno-store\b/i.test(r.headers["cache-control"] ?? "") && /\bno-cache\b/i.test(r.headers.pragma ?? "")));
    });
    for (const endpoint of ["contact", "contact/verify"]) {
      for (const method of ["GET", "HEAD"]) {
        const name = `${label}-${endpoint.replace("/", "-")}-${method.toLowerCase()}`;
        await observe(name, `${origin}/api/${endpoint}`, { method }, (r) => { record(name, ok(r.status === 405 && r.headers.allow === "POST")); record(`${name}-headers`, assessHeaders(r.headers, true)); });
      }
    }
  }
  await observe("www-redirect", "https://www.nicolasmgioanni.dev/", { method: "HEAD" }, (r) => {
    let target; try { target = new URL(r.headers.location, "https://www.nicolasmgioanni.dev/").href; } catch { target = ""; }
    record("www-redirect", ok([301, 308].includes(r.status) && target === "https://nicolasmgioanni.dev/"));
    record("www-redirect-hsts", ok(hasHsts(r.headers)));
  });
  await observe("github-repository", `https://api.github.com${apiPaths[0]}`, { token }, (r) => { const value = json(r); const status = assessRepository(value); githubAdmin = Boolean(token) && status === "pass" && value?.permissions?.admin === true; record("github-repository", status); });
  await observe("github-ruleset", `https://api.github.com${apiPaths[1]}`, { token }, (r) => { const result = assessRuleset(json(r), githubAdmin); record("github-ruleset", result.ruleset); record("github-ruleset-bypass", result.bypass); });
  if (token) await observe("github-classic-main", `https://api.github.com${apiPaths[2]}`, { token }, (r) => record("github-classic-main", assessClassic(json(r))));
  else record("github-classic-main", "unavailable");
  if (!findings.some((f) => f.check === "github-ruleset-bypass")) record("github-ruleset-bypass", "unavailable");
  return { findings, evidence };
}

// An existing private directory and an exclusive file prevent accidental publication or overwrite.
export async function writeEvidence(destination, report) {
  if (!path.isAbsolute(destination)) throw new Error("Evidence destination must be absolute");
  const parent = await realpath(path.dirname(destination));
  if (parent !== path.dirname(destination) || path.basename(destination) === "." || path.basename(destination) === "..") throw new Error("Invalid evidence path");
  const info = await stat(parent);
  if (!info.isDirectory() || (info.mode & 0o777) !== 0o700 || info.uid !== process.getuid()) throw new Error("Evidence directory must be private");
  for (let cursor = parent;; cursor = path.dirname(cursor)) {
    try { await lstat(path.join(cursor, ".git")); throw new Error("Evidence directory is in a Git worktree"); } catch (e) { if (e.code !== "ENOENT") throw e; }
    if (path.dirname(cursor) === cursor) break;
  }
  try { const result = await execFileAsync("git", ["-C", parent, "rev-parse", "--is-inside-work-tree"]); if (result.stdout.trim() === "true") throw new Error("Evidence directory is in a Git worktree"); }
  catch (e) { if (!e.code || typeof e.code !== "number") throw e; }
  const handle = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
  try { await handle.writeFile(`${JSON.stringify(report, null, 2)}\n`); } finally { await handle.close(); }
}

async function main(args) {
  let expectedCommit; let evidencePath;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--expected-commit" && !expectedCommit) expectedCommit = args[++i];
    else if (args[i] === "--evidence" && !evidencePath) evidencePath = args[++i];
    else throw new Error("Invalid arguments");
  }
  if (args.includes("--expected-commit") && !/^[a-f0-9]{40}$/.test(expectedCommit ?? "")) throw new Error("Expected commit must be a lowercase full SHA");
  if (args.includes("--evidence") && !evidencePath) throw new Error("Evidence destination required");
  if (process.env.GH_TOKEN && (process.env.CI || process.env.GITHUB_ACTIONS)) throw new Error("Credentials require a trusted local operator");
  const report = await runChecks({ token: process.env.GH_TOKEN || undefined, expectedCommit });
  if (evidencePath) await writeEvidence(evidencePath, report);
  for (const f of report.findings) console.log(`${f.check}: ${f.status}`);
  const counts = ["pass", "fail", "unavailable"].map((s) => `${s}=${report.findings.filter((f) => f.status === s).length}`);
  console.log(`counts: ${counts.join(" ")}`);
  if (report.findings.some((f) => f.status !== "pass")) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main(process.argv.slice(2)).catch(() => { console.error("posture-check: unavailable"); process.exitCode = 1; });
