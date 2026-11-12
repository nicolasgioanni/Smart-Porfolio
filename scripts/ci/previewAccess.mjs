import { randomUUID } from "node:crypto";
import { reviewedPagesDomain } from "./deployedIdentity.mjs";
import { cloudflareReadJson } from "./cloudflarePagesPreflight.mjs";

const uuid = /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/;
const fail = () => new Error("Private preview Access configuration or evidence was rejected.");

export function privatePreviewEnabled(environment = process.env) {
  const value = environment.PREVIEW_ACCESS_ENABLED ?? "";
  if (value === "" || value === "false") return false;
  if (value === "true") return true;
  throw fail();
}

export function previewAccessConfig(environment = process.env) {
  if (!privatePreviewEnabled(environment)) return null;
  let value;
  try { value = JSON.parse(environment.PREVIEW_ACCESS_CONFIG); } catch { throw fail(); }
  if (!value || Array.isArray(value) || JSON.stringify(value) !== environment.PREVIEW_ACCESS_CONFIG ||
      Object.keys(value).sort().join(",") !== "emails,groups,hostname,humanAppId,idpId,pagesAppId,serviceTokenId" ||
      !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+$/.test(value.hostname) ||
      value.hostname.endsWith(".pages.dev") || !uuid.test(value.humanAppId) || !uuid.test(value.pagesAppId) ||
      value.humanAppId === value.pagesAppId || !uuid.test(value.idpId) || !uuid.test(value.serviceTokenId) ||
      !Array.isArray(value.emails) || value.emails.length === 0 ||
      value.emails.some((email) => typeof email !== "string" || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) ||
      !Array.isArray(value.groups) || value.groups.some((group) => typeof group !== "string" || !uuid.test(group)) ||
      new Set(value.emails).size !== value.emails.length || new Set(value.groups).size !== value.groups.length ||
      typeof environment.PREVIEW_ACCESS_CLIENT_ID !== "string" || !/^[\x21-\x7e]{1,512}$/.test(environment.PREVIEW_ACCESS_CLIENT_ID) ||
      typeof environment.PREVIEW_ACCESS_CLIENT_SECRET !== "string" || !/^[\x21-\x7e]{1,512}$/.test(environment.PREVIEW_ACCESS_CLIENT_SECRET)) throw fail();
  return value;
}

export function previewHeaders(origin, environment = process.env) {
  if (!privatePreviewEnabled(environment)) return {};
  previewAccessConfig(environment);
  if (!new RegExp(`^https://(?:develop|[a-f0-9]{8})\\.${reviewedPagesDomain.replaceAll(".", "\\.")}$`).test(origin)) throw fail();
  return { "CF-Access-Client-Id": environment.PREVIEW_ACCESS_CLIENT_ID, "CF-Access-Client-Secret": environment.PREVIEW_ACCESS_CLIENT_SECRET };
}

function rulesEqual(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const normalize = (rules) => rules.map((rule) => JSON.stringify(rule)).sort();
  return JSON.stringify(normalize(actual)) === JSON.stringify(normalize(expected));
}

function policyOk(policy, expected) {
  return policy && policy.decision === expected.decision && policy.precedence === expected.precedence &&
    rulesEqual(policy.include, expected.include) && rulesEqual(policy.exclude, []) && rulesEqual(policy.require, expected.require);
}

// The authenticated API read must cover the whole account list. Refuse pagination
// rather than silently accepting an incomplete inventory of overlapping apps.
async function list(path, credentials, fetcher) {
  const body = await cloudflareReadJson(`${path}?per_page=100`, { ...credentials, fetcher });
  const info = body.result_info;
  if (!Array.isArray(body.result) || !info || info.page !== 1 || info.total_pages > 1 ||
      info.total_count !== body.result.length || info.count !== body.result.length) throw fail();
  return body.result;
}


function overlaps(domain, hostname) {
  if (typeof domain !== "string" || !domain) return true;
  const host = domain.replace(/^https?:\/\//, "").split("/")[0].toLowerCase();
  if (host.includes("*")) {
    if (!/^\*\.[a-z0-9.-]+$/.test(host)) return true;
    const suffix = host.slice(2);
    return hostname.endsWith(`.${suffix}`) || reviewedPagesDomain === suffix || reviewedPagesDomain.endsWith(`.${suffix}`);
  }
  if (!/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(host)) return true;
  return host === hostname || host === reviewedPagesDomain || host.endsWith(`.${reviewedPagesDomain}`);
}

function appOverlaps(app, hostname) {
  if (!app || typeof app !== "object" || Array.isArray(app) || typeof app.type !== "string") throw fail();
  if (app.self_hosted_domains != null && !Array.isArray(app.self_hosted_domains)) throw fail();
  if (app.destinations != null && !Array.isArray(app.destinations)) throw fail();
  const domains = [];
  if (app.domain != null) domains.push(app.domain);
  if (app.self_hosted_domains) domains.push(...app.self_hosted_domains);
  for (const destination of app.destinations ?? []) {
    if (!destination || typeof destination !== "object" || Array.isArray(destination)) throw fail();
    if (destination.uri != null) domains.push(destination.uri);
    else throw fail();
  }
  if (["self_hosted", "end_user"].includes(app.type) && domains.length === 0) throw fail();
  return domains.some((domain) => overlaps(domain, hostname));
}

export async function verifyPreviewAccess({ environment = process.env, fetcher = fetch } = {}) {
  const config = previewAccessConfig(environment);
  if (!config) return;
  const account = environment.CLOUDFLARE_ACCOUNT_ID;
  const credentials = { accountId: account, apiToken: environment.CLOUDFLARE_API_TOKEN };
  const root = `/accounts/${account}/access/apps`;
  const apps = await list(root, credentials, fetcher);
  const human = apps.find((app) => app.id === config.humanAppId);
  const pages = apps.find((app) => app.id === config.pagesAppId);
  const validApp = (app, domain, redirect) => app && app.type === "self_hosted" && app.domain === domain &&
    app.allow_authenticate_via_warp === false && app.options_preflight_bypass === false && app.auto_redirect_to_identity === redirect &&
    (!app.destinations || (app.destinations.length === 1 && app.destinations[0].uri === domain && !app.destinations[0].overrides?.length)) &&
    (!app.self_hosted_domains || (app.self_hosted_domains.length === 1 && app.self_hosted_domains[0] === domain));
  if (!validApp(human, config.hostname, true) || !validApp(pages, `*.${reviewedPagesDomain}`, false) ||
      apps.filter((app) => appOverlaps(app, config.hostname)).length !== 2) throw fail();
  const [humanPolicies, pagesPolicies, tokenEvidence] = await Promise.all([list(`${root}/${config.humanAppId}/policies`, credentials, fetcher), list(`${root}/${config.pagesAppId}/policies`, credentials, fetcher), cloudflareReadJson(`/accounts/${account}/access/service_tokens/${config.serviceTokenId}`, { ...credentials, fetcher })]);
  const token = tokenEvidence.result;
  if (!token || token.id !== config.serviceTokenId || token.client_id !== environment.PREVIEW_ACCESS_CLIENT_ID || token.enabled !== true ||
      token.leak_reported_at || !(token.duration === "forever" || (typeof token.expires_at === "string" && Date.parse(token.expires_at) > Date.now()))) throw fail();
  const humanRule = { decision: "allow", precedence: 1, include: [...config.emails.map((email) => ({ email: { email } })), ...config.groups.map((group) => ({ group: { id: group } }))], require: [{ login_method: { id: config.idpId } }] };
  const serviceRule = { decision: "non_identity", precedence: 1, include: [{ service_token: { token_id: config.serviceTokenId } }], require: [] };
  if (humanPolicies.length !== 1 || pagesPolicies.length !== 2 || !policyOk(humanPolicies[0], humanRule) ||
      !policyOk(pagesPolicies.find((p) => p.precedence === 1), serviceRule) ||
      !policyOk(pagesPolicies.find((p) => p.precedence === 2), { ...humanRule, precedence: 2 }) ||
      humanPolicies[0].id !== pagesPolicies.find((p) => p.precedence === 2)?.id) throw fail();
}

export async function verifyPreviewDenial(origin, { environment = process.env, fetcher = fetch } = {}) {
  previewHeaders(origin, environment); // Also checks that credentials can only target reviewed origins.
  const url = new URL("/content-version.json", origin);
  url.searchParams.set("ci", randomUUID());
  let response;
  try { response = await fetcher(url, { headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }, redirect: "manual", signal: AbortSignal.timeout(20_000) }); }
  catch { throw fail(); }
  const location = response.headers.get("location");
  let login = false;
  try { const dest = new URL(location); login = dest.protocol === "https:" && dest.hostname.endsWith(".cloudflareaccess.com") && dest.pathname.startsWith("/cdn-cgi/access/login"); } catch { /* no redirect */ }
  void response.body?.cancel().catch(() => {});
  if (![401, 403].includes(response.status) && !(response.status === 302 && login)) throw fail();
}
