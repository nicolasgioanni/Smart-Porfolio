// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { privatePreviewEnabled, previewAccessConfig, previewHeaders, verifyPreviewAccess, verifyPreviewDenial } from "./previewAccess.mjs";
import { readDeployedIdentity } from "./deployedIdentity.mjs";

const config = { emails: ["owner@example.com"], groups: [], hostname: "preview.example.com", humanAppId: "11111111-1111-1111-1111-111111111111", idpId: "22222222-2222-2222-2222-222222222222", pagesAppId: "33333333-3333-3333-3333-333333333333", serviceTokenId: "44444444-4444-4444-4444-444444444444" };
const environment = { PREVIEW_ACCESS_ENABLED: "true", PREVIEW_ACCESS_CONFIG: JSON.stringify(config), PREVIEW_ACCESS_CLIENT_ID: "test-client-id", PREVIEW_ACCESS_CLIENT_SECRET: "test-secret", CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "api-token", CLOUDFLARE_PAGES_PROJECT_NAME: "smart-portfolio", CLOUDFLARE_PAGES_DOMAIN: "smart-portfolio-bds.pages.dev" };
const humanPolicy = { id: "human-policy", decision: "allow", precedence: 1, include: [{ email: { email: "owner@example.com" } }], exclude: [], require: [{ login_method: { id: config.idpId } }] };
const servicePolicy = { id: "service-policy", decision: "non_identity", precedence: 1, include: [{ service_token: { token_id: config.serviceTokenId } }], exclude: [], require: [] };
const apps = [
  { id: config.humanAppId, type: "self_hosted", domain: config.hostname, allow_authenticate_via_warp: false, options_preflight_bypass: false, auto_redirect_to_identity: true },
  { id: config.pagesAppId, type: "self_hosted", domain: "*.smart-portfolio-bds.pages.dev", allow_authenticate_via_warp: false, options_preflight_bypass: false, auto_redirect_to_identity: false }
];
const policies = [[humanPolicy], [servicePolicy, { ...humanPolicy, precedence: 2 }]];
function provider(data = apps, rules = policies, mutate = (x) => x) {
  return vi.fn(async (url, options) => {
    expect(options.redirect).toBe("manual");
    expect(options.headers.Authorization).toBe("Bearer api-token");
    if (url.includes("/access/service_tokens/")) return new Response(JSON.stringify({ success: true, errors: [], result: { id: config.serviceTokenId, client_id: "test-client-id", enabled: true, expires_at: "2099-01-01T00:00:00Z" } }), { headers: { "content-type": "application/json" } });
    const values = url.includes(`${config.humanAppId}/policies`) ? rules[0] : url.includes(`${config.pagesAppId}/policies`) ? rules[1] : data;
    return new Response(JSON.stringify(mutate({ success: true, errors: [], messages: [], result: values, result_info: { page: 1, per_page: 100, total_pages: 1, total_count: values.length, count: values.length } })), { headers: { "content-type": "application/json" } });
  });
}

describe("private preview activation", () => {
  it("is strictly default-off and requires the complete canonical configuration", () => {
    expect(privatePreviewEnabled({})).toBe(false);
    expect(previewAccessConfig({ PREVIEW_ACCESS_ENABLED: "false" })).toBe(null);
    expect(() => privatePreviewEnabled({ PREVIEW_ACCESS_ENABLED: "TRUE" })).toThrow();
    expect(previewAccessConfig(environment)).toEqual(config);
    for (const patch of [{ PREVIEW_ACCESS_CLIENT_SECRET: "" }, { PREVIEW_ACCESS_CONFIG: `${JSON.stringify(config)} ` }, { PREVIEW_ACCESS_CONFIG: JSON.stringify({ ...config, groups: ["*"] }) }]) expect(() => previewAccessConfig({ ...environment, ...patch })).toThrow();
  });
  it("limits credentials to exact reviewed branch and hash origins", () => {
    expect(previewHeaders("https://develop.smart-portfolio-bds.pages.dev", environment)).toEqual({ "CF-Access-Client-Id": "test-client-id", "CF-Access-Client-Secret": "test-secret" });
    expect(previewHeaders("https://0123abcd.smart-portfolio-bds.pages.dev", environment)).toHaveProperty("CF-Access-Client-Secret");
    for (const origin of ["https://smart-portfolio-bds.pages.dev", "https://evil.smart-portfolio-bds.pages.dev", "https://develop.smart-portfolio-bds.pages.dev.evil.test", "http://develop.smart-portfolio-bds.pages.dev"]) expect(() => previewHeaders(origin, environment)).toThrow();
  });
  it("reads the complete authenticated applications and exact policy attachments", async () => {
    const fetcher = provider();
    await verifyPreviewAccess({ environment, fetcher });
    expect(fetcher).toHaveBeenCalledTimes(4);
  });
  it.each([
    ["extra broad app", [...apps, { type: "self_hosted", domain: "*.pages.dev" }], policies],
    ["preflight bypass", [apps[0], { ...apps[1], options_preflight_bypass: true }], policies],
    ["public destination", [apps[0], { ...apps[1], destinations: [{ uri: "*.smart-portfolio-bds.pages.dev", overrides: [{ behavior: "public", path_pattern: "/" }] }] }], policies],
    ["everyone policy", apps, [[{ ...humanPolicy, include: [{ everyone: {} }] }], policies[1]]],
    ["incorrect token", apps, [policies[0], [{ ...servicePolicy, include: [{ service_token: { token_id: "other" } }] }, policies[1][1]]]],
    ["bypass decision", apps, [policies[0], [{ ...servicePolicy, decision: "bypass" }, policies[1][1]]]]
  ])("rejects %s", async (_name, data, rules) => { await expect(verifyPreviewAccess({ environment, fetcher: provider(data, rules) })).rejects.toThrow(); });
  it("rejects incomplete pagination and provider failures", async () => {
    await expect(verifyPreviewAccess({ environment, fetcher: provider(apps, policies, (body) => ({ ...body, result_info: { ...body.result_info, total_pages: 2 } })) })).rejects.toThrow();
    await expect(verifyPreviewAccess({ environment, fetcher: async () => new Response(null, { status: 302, headers: { location: "https://evil.test" } }) })).rejects.toThrow();
  });
  it.each([
    { id: config.serviceTokenId, client_id: "different", enabled: true, expires_at: "2099-01-01T00:00:00Z" },
    { id: config.serviceTokenId, client_id: "test-client-id", enabled: false, expires_at: "2099-01-01T00:00:00Z" },
    { id: config.serviceTokenId, client_id: "test-client-id", enabled: true, expires_at: "2000-01-01T00:00:00Z" }
  ])("rejects a mismatched, disabled, or expired adopted token", async (token) => {
    const base = provider();
    const fetcher = async (url, options) => url.includes("/access/service_tokens/")
      ? new Response(JSON.stringify({ success: true, errors: [], result: token }), { headers: { "content-type": "application/json" } })
      : base(url, options);
    await expect(verifyPreviewAccess({ environment, fetcher })).rejects.toThrow();
  });
  it("checks anonymous denial without credentials or following redirects", async () => {
    const fetcher = vi.fn(async () => new Response(null, { status: 302, headers: { location: "https://team.cloudflareaccess.com/cdn-cgi/access/login/example" } }));
    await verifyPreviewDenial("https://develop.smart-portfolio-bds.pages.dev", { environment, fetcher });
    expect(fetcher.mock.calls[0][1]).toMatchObject({ redirect: "manual", headers: { "Cache-Control": "no-cache", Pragma: "no-cache" } });
    await expect(verifyPreviewDenial("https://develop.smart-portfolio-bds.pages.dev", { environment, fetcher: async () => new Response("public") })).rejects.toThrow();
    await expect(verifyPreviewDenial("https://develop.smart-portfolio-bds.pages.dev", { environment, fetcher: async () => new Response(null, { status: 302, headers: { location: "https://evil.test/" } }) })).rejects.toThrow();
  });
  it("sends credentials only to approved preview observations and rejects missing active metadata", async () => {
    const fetchImplementation = vi.fn(async () => new Response(null, { status: 404 }));
    await expect(readDeployedIdentity("preview", { environment, fetchImplementation })).rejects.toThrow();
    expect(fetchImplementation.mock.calls[0][1]).toMatchObject({ redirect: "error", headers: { "CF-Access-Client-Id": "test-client-id", "CF-Access-Client-Secret": "test-secret" } });
    await readDeployedIdentity("production", { environment, fetchImplementation });
    expect(fetchImplementation.mock.calls[1][1].headers).not.toHaveProperty("CF-Access-Client-Secret");
  });
});
