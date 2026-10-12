import { lstat, mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { createArtifactManifest } from "./artifactIntegrity.mjs";
import {
  assertAnonymousDenied,
  assertServiceAuthenticatedExistingPreview,
  createPrivatePreviewConfiguration,
  createPrivatePreviewTransports,
  destinationOverlapsPagesNamespace,
  parseAccessApplication,
  parseAccessPolicy,
  parseCloudflareEnvelope,
  parseEntitlementEvidence,
  parsePagesDeployment,
  policyHasBroadBypassOrAllow,
  parseResultInfo,
  parseWranglerPagesDeployOutput,
  PrivateEvidenceStore,
  runPrivatePreviewPreflight,
  verifyPrivatePreviewUpload
} from "./privatePreviewCheck.mjs";

const candidateSha = "a".repeat(40);
const contentHash = "b".repeat(64);
const pagesDomain = "smart-portfolio-bds.pages.dev";
const hashHost = `abcd1234.${pagesDomain}`;
const developHost = `develop.${pagesDomain}`;
const customHost = "preview.example.test";
let temporaryRoot;
let uploadSequence = 0;

afterEach(async () => {
  vi.restoreAllMocks();
  if (temporaryRoot) await rm(temporaryRoot, { recursive: true, force: true });
  temporaryRoot = undefined;
});

async function configuration() {
  temporaryRoot = await mkdtemp(path.join(os.tmpdir(), "private-preview-check-"));
  return createPrivatePreviewConfiguration({
    PRIVATE_PREVIEW_ACCOUNT_ID: "account123",
    PRIVATE_PREVIEW_DNS_ZONE_ID: "zone123",
    PRIVATE_PREVIEW_SERVICE_TOKEN_ID: "service123",
    PRIVATE_PREVIEW_API_TOKEN: "provider-token",
    PRIVATE_PREVIEW_ACCESS_CLIENT_ID: "service-client",
    PRIVATE_PREVIEW_ACCESS_CLIENT_SECRET: "service-secret",
    PRIVATE_PREVIEW_CUSTOM_HOSTNAME: customHost,
    PRIVATE_PREVIEW_ACCESS_TEAM_DOMAIN: "team.cloudflareaccess.com",
    PRIVATE_PREVIEW_EVIDENCE_DIR: path.join(temporaryRoot, "evidence")
  });
}

function cloudflare(result, resultInfo = undefined) {
  return Response.json({ success: true, errors: [], result, ...(resultInfo ? { result_info: resultInfo } : {}) });
}

function pageInfo(page = 1, totalPages = 1, totalCount = 1) {
  return { page, per_page: 50, total_pages: totalPages, total_count: totalCount };
}

function deployment(id = "deployment123") {
  return {
    id,
    short_id: "abcd1234",
    project_name: "smart-portfolio",
    url: `https://${hashHost}`,
    aliases: [`https://${developHost}`],
    environment: "preview",
    deployment_trigger: { metadata: { branch: "develop", commit_hash: candidateSha } },
    latest_stage: { name: "deploy", status: "success" }
  };
}

function accessApplication() {
  return {
    id: "app123",
    type: "self_hosted",
    destinations: [
      { type: "public", uri: `*.${pagesDomain}/*` },
      { type: "public", uri: customHost }
    ]
  };
}

function exactHistoricalApplications() {
  return [hashHost, developHost, customHost].map((hostname, index) => ({
    id: `app${index + 1}`,
    type: "self_hosted",
    destinations: [{ type: "public", uri: hostname }]
  }));
}

function exactServicePolicy() {
  return {
    id: "policy123",
    decision: "non_identity",
    include: [{ service_token: { token_id: "service123" } }]
  };
}

async function artifactDirectory() {
  const directory = path.join(temporaryRoot, "out");
  await mkdir(directory);
  await writeFile(
    path.join(directory, "index.html"),
    "<!doctype html><link rel=\"canonical\" href=\"https://nicolasmgioanni.dev/\"><title>Private preview</title>"
  );
  await writeFile(path.join(directory, "robots.txt"), "User-agent: *\nDisallow:\n");
  await writeFile(path.join(directory, "sitemap.xml"), "<?xml version=\"1.0\"?><urlset/>");
  await writeFile(
    path.join(directory, "content-version.json"),
    JSON.stringify({
      schemaVersion: 1,
      contentHash,
      commitSha: candidateSha,
      generatedAt: "2026-10-09T00:00:00.000Z",
      deployedAt: "2026-10-09T00:01:00.000Z"
    })
  );
  await createArtifactManifest(directory);
  return directory;
}

function standardPreflightFetch({
  publicPreviewHostname = undefined,
  strictServiceTokenAuth = true,
  deployments = [deployment()],
  accountPolicies = [exactServicePolicy()],
  zonePolicies = accountPolicies,
  applications = [accessApplication()],
  dnsRecords = [{ type: "CNAME", name: customHost, content: developHost, proxied: true }],
  customDomain = { name: customHost, status: "active", validation_data: { status: "active" }, verification_data: { status: "active" } }
} = {}) {
  const remoteVersion = {
    schemaVersion: 1,
    contentHash,
    commitSha: candidateSha,
    generatedAt: "2026-10-09T00:00:00.000Z",
    deployedAt: "2026-10-09T00:01:00.000Z"
  };
  return async (url, options) => {
    const target = new URL(String(url));
    if (target.hostname === "api.cloudflare.com") {
      if (target.searchParams.get("page") === "2") return cloudflare([], { page: 2 });
      if (target.pathname.endsWith("/pages/projects/smart-portfolio")) return cloudflare({ name: "smart-portfolio", production_branch: "main", subdomain: pagesDomain, source: null });
      if (target.pathname.endsWith("/deployments")) return cloudflare(deployments, pageInfo(1, 1, deployments.length));
      if (target.pathname.endsWith("/access/apps")) return cloudflare(applications, pageInfo());
      if (target.pathname.endsWith("/policies")) {
        return cloudflare(target.pathname.includes("/zones/") ? zonePolicies : accountPolicies, pageInfo());
      }
      if (target.pathname.endsWith("/access/organizations")) return cloudflare({ strict_service_token_auth: strictServiceTokenAuth, auth_domain: "team.cloudflareaccess.com" });
      if (target.pathname.endsWith("/dns_records")) return cloudflare(dnsRecords, pageInfo());
      if (target.pathname.endsWith(`/domains/${customHost}`)) return cloudflare(customDomain);
      if (target.pathname.endsWith("/entitlements")) return cloudflare([]);
    }
    if ([pagesDomain, "nicolasmgioanni.dev"].includes(target.hostname)) {
      return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
    }
    if (!options.headers["CF-Access-Client-Id"]) {
      if (target.hostname === publicPreviewHostname) {
        return new Response("public", { status: 200, headers: { "content-type": "text/html" } });
      }
      return new Response("", { status: 401 });
    }
    if (target.pathname === "/content-version.json") return Response.json(remoteVersion);
    return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
  };
}

async function successfulUploadFixture(config, directory, overrides = {}) {
  const manifest = JSON.parse(await readFile(path.join(directory, "artifact-integrity.json"), "utf8"));
  const html = await readFile(path.join(directory, "index.html"), "utf8");
  const robots = await readFile(path.join(directory, "robots.txt"), "utf8");
  const sitemap = await readFile(path.join(directory, "sitemap.xml"), "utf8");
  const wranglerOutputPath = path.join(temporaryRoot, `wrangler-${uploadSequence += 1}.jsonl`);
  await writeFile(wranglerOutputPath, [
    JSON.stringify({ type: "pages-deploy", version: 1, pages_project: "smart-portfolio", deployment_id: "deployment123", url: `https://${hashHost}` }),
    JSON.stringify({ type: "pages-deploy-detailed", version: 1, pages_project: "smart-portfolio", deployment_id: "deployment123", url: `https://${hashHost}`, alias: `https://${developHost}`, environment: "preview", deployment_trigger: { metadata: { commit_hash: candidateSha } } })
  ].join("\n"));
  const version = {
    schemaVersion: 1,
    contentHash,
    commitSha: candidateSha,
    generatedAt: "2026-10-09T00:00:00.000Z",
    deployedAt: "2026-10-09T00:01:00.000Z"
  };
  const fetchMock = vi.fn(async (url, options) => {
    const target = new URL(String(url));
    if (target.hostname === "api.cloudflare.com") {
      if (target.searchParams.get("page") === "2") return cloudflare([], { page: 2 });
      if (target.pathname.endsWith("/deployments/deployment123")) return cloudflare(overrides.deployment ?? deployment());
      if (target.pathname.endsWith("/pages/projects/smart-portfolio")) return cloudflare({ name: "smart-portfolio", production_branch: "main", subdomain: pagesDomain, source: null });
      if (target.pathname.endsWith("/deployments")) return cloudflare([overrides.deployment ?? deployment()], pageInfo());
      if (target.pathname.endsWith("/access/apps")) return cloudflare([accessApplication()], pageInfo());
      if (target.pathname.endsWith("/policies")) return cloudflare([exactServicePolicy()], pageInfo());
      if (target.pathname.endsWith("/access/organizations")) return cloudflare(overrides.organization ?? { strict_service_token_auth: true, auth_domain: "team.cloudflareaccess.com" });
      if (target.pathname.endsWith("/dns_records")) return cloudflare([{ type: "CNAME", name: customHost, content: developHost, proxied: true }], pageInfo());
      if (target.pathname.endsWith(`/domains/${customHost}`)) return cloudflare({ name: customHost, status: "active", validation_data: { status: "active" }, verification_data: { status: "active" } });
      if (target.pathname.endsWith("/entitlements")) return cloudflare([]);
    }
    if ([pagesDomain, "nicolasmgioanni.dev"].includes(target.hostname)) {
      return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
    }
    if (!options.headers["CF-Access-Client-Id"]) {
      if (target.hostname === overrides.publicPreviewHostname) {
        return new Response("public", { status: 200, headers: { "content-type": "text/html" } });
      }
      return new Response("", { status: 401 });
    }
    if (target.pathname === "/content-version.json") return Response.json(overrides.versionByHost?.[target.hostname] ?? overrides.version ?? version);
    if (target.pathname === "/artifact-integrity.json") return Response.json(overrides.manifest ?? manifest);
    if (target.pathname === "/") return new Response(overrides.html ?? html, { status: 200, headers: { "content-type": "text/html" } });
    if (target.pathname === "/robots.txt") return new Response(overrides.robots ?? robots, { status: 200, headers: { "content-type": "text/plain" } });
    if (target.pathname === "/sitemap.xml") return new Response(overrides.sitemap ?? sitemap, { status: 200, headers: { "content-type": "application/xml" } });
    if (["/api/contact/verify", "/api/contact"].includes(target.pathname)) {
      return Response.json(overrides.contactBody ?? { ok: false, error: "method_not_allowed" }, { status: overrides.contactStatus ?? 405 });
    }
    return new Response("missing", { status: 404 });
  });
  return { fetchMock, wranglerOutputPath };
}

describe("private preview checker parsers", () => {
  it("accepts only Wrangler 4.131 detailed output bound to the exact candidate", async () => {
    const config = await configuration();
    const source = [
      JSON.stringify({
        type: "pages-deploy",
        version: 1,
        pages_project: "smart-portfolio",
        deployment_id: "deployment123",
        url: `https://${hashHost}`
      }),
      JSON.stringify({
        type: "pages-deploy-detailed",
        version: 1,
        pages_project: "smart-portfolio",
        deployment_id: "deployment123",
        url: `https://${hashHost}`,
        alias: `https://${developHost}`,
        environment: "preview",
        production_branch: "main",
        deployment_trigger: { metadata: { commit_hash: candidateSha } }
      })
    ].join("\n");

    expect(parseWranglerPagesDeployOutput(source, config, candidateSha)).toMatchObject({
      id: "deployment123",
      hostname: hashHost,
      commitHash: candidateSha
    });
    expect(() => parseWranglerPagesDeployOutput(`${source}\n${source}`, config, candidateSha)).toThrow(
      "private_preview_ambiguous_wrangler_output"
    );
    expect(() => parseWranglerPagesDeployOutput(source.replace(candidateSha, "c".repeat(40)), config, candidateSha)).toThrow(
      "private_preview_deployment_identity_mismatch"
    );
  });

  it("rejects incomplete pagination and unreviewed entitlement shapes", () => {
    expect(() => parseResultInfo({ page: 1, per_page: 0 }, 1)).toThrow(
      "private_preview_invalid_pagination"
    );
    expect(() => parseResultInfo({ page: 2, per_page: 50, total_pages: 2, total_count: 2 }, 1)).toThrow(
      "private_preview_invalid_pagination"
    );
    expect(parseResultInfo({ page: 1 }, 1)).toMatchObject({ page: 1 });
    expect(parseResultInfo({ per_page: 50 }, 1)).toMatchObject({ perPage: 50 });
    expect(() => parseEntitlementEvidence([{ id: "one", feature: {}, allocation: {} }])).toThrow(
      "private_preview_invalid_entitlement_response"
    );
    expect(() => parseCloudflareEnvelope({ success: true, result: {} })).toThrow(
      "private_preview_invalid_provider_response"
    );
    expect(() => parseCloudflareEnvelope({ success: true, errors: [{ code: 1 }], result: {} })).toThrow(
      "private_preview_invalid_provider_response"
    );
    expect(parseEntitlementEvidence([{
      id: "entitlement-one",
      feature: { id: 1, feature_set: "access", key: "private-preview", name: "Private preview" },
      allocation: { type: "bool", value: true },
      deleted_date: ""
    }])).toEqual({ count: 1 });
  });

  it("uses destinations in preference to legacy domains and rejects public path overrides or unknown policy selectors", () => {
    expect(() => parseAccessApplication({
      id: "app123",
      type: "self_hosted",
      destinations: [{ type: "public", uri: `${customHost}/locked`, overrides: [{ behavior: "public", path_pattern: "/open" }] }],
      self_hosted_domains: [customHost]
    }, "account")).not.toThrow();
    expect(() => parseAccessApplication({
      id: "app123",
      type: "self_hosted",
      destinations: [{ type: "public", uri: customHost, overrides: [{ behavior: "public", path_pattern: "/" }] }]
    }, "account")).not.toThrow();
    expect(() => parseAccessApplication({
      id: "app126",
      type: "self_hosted",
      destinations: [{ type: "public", uri: `${customHost}/users/@me:current` }]
    }, "account")).not.toThrow();
    expect(() => parseAccessPolicy({
      id: "policy123",
      decision: "non_identity",
      include: [{ unknown_selector: "any" }]
    })).toThrow("private_preview_invalid_access_policy");
    expect(() => parseAccessPolicy({
      id: "policy123",
      decision: "non_identity",
      include: [{ service_token: { token_id: "service123", unexpected: "value" } }]
    })).toThrow("private_preview_invalid_access_policy");
  });

  it("audits overlapping partial Pages wildcards and rejects malformed wildcard labels", async () => {
    const config = await configuration();
    const partial = parseAccessApplication({
      id: "app123",
      type: "self_hosted",
      destinations: [{ type: "public", uri: `foo*.${pagesDomain}` }]
    }, "account").destinations[0];
    const disjoint = parseAccessApplication({
      id: "app124",
      type: "self_hosted",
      destinations: [{ type: "public", uri: `*.nested.${pagesDomain}` }]
    }, "account").destinations[0];
    const edgeWildcard = parseAccessApplication({
      id: "app126",
      type: "self_hosted",
      destinations: [{ type: "public", uri: `*-preview.${pagesDomain}` }]
    }, "account").destinations[0];
    expect(destinationOverlapsPagesNamespace(partial, config)).toBe(true);
    expect(destinationOverlapsPagesNamespace(disjoint, config)).toBe(false);
    expect(destinationOverlapsPagesNamespace(edgeWildcard, config)).toBe(true);
    expect(() => parseAccessApplication({
      id: "app125",
      type: "self_hosted",
      destinations: [{ type: "public", uri: `foo**.${pagesDomain}` }]
    }, "account")).toThrow("private_preview_invalid_access_application");
  });

  it("requires a Pages short ID to bind the immutable preview URL and permits a failed historical record", async () => {
    const config = await configuration();
    const historical = { ...deployment(), latest_stage: { name: "build", status: "failure" } };
    expect(parsePagesDeployment(historical, config, { requireSuccessful: false })).toMatchObject({ shortId: "abcd1234" });
    expect(() => parsePagesDeployment(historical, config)).toThrow("private_preview_deployment_not_successful");
    for (const [field, value] of [
      ["short_id", "wrong123"],
      ["short_id", "abcd123"],
      ["aliases", undefined]
    ]) {
      expect(() => parsePagesDeployment({ ...deployment(), [field]: value }, config, { requireSuccessful: false })).toThrow();
    }
  });

  it("rejects a post-upload record whose exact ID, SHA, branch, stage, or short ID changed", async () => {
    const config = await configuration();
    const expected = { expectedDeploymentId: "deployment123", expectedCommitSha: candidateSha, expectedBranch: "develop" };
    const variations = [
      { record: { ...deployment("other123") }, code: "private_preview_deployment_identity_mismatch" },
      { record: { ...deployment(), deployment_trigger: { metadata: { branch: "develop", commit_hash: "c".repeat(40) } } }, code: "private_preview_deployment_commit_mismatch" },
      { record: { ...deployment(), deployment_trigger: { metadata: { branch: "main", commit_hash: candidateSha } } }, code: "private_preview_deployment_branch_mismatch" },
      { record: { ...deployment(), latest_stage: { name: "deploy", status: "failure" } }, code: "private_preview_deployment_not_successful" },
      { record: { ...deployment(), short_id: "efgh5678" }, code: "private_preview_deployment_identity_mismatch" }
    ];
    for (const { record, code } of variations) {
      expect(() => parsePagesDeployment(record, config, expected)).toThrow(code);
    }
  });

  it("treats unresolved Allow audiences as broad while exclude and require remain narrowing", () => {
    const certificate = parseAccessPolicy({ id: "policy123", decision: "allow", include: [{ certificate: {} }] });
    const authMethod = parseAccessPolicy({ id: "policy124", decision: "allow", include: [{ auth_method: { auth_method: "mfa" } }] });
    const exactEmail = parseAccessPolicy({
      id: "policy125",
      decision: "allow",
      include: [{ email: { email: "person@example.test" } }],
      exclude: [{ everyone: {} }],
      require: [{ certificate: {} }]
    });
    expect(policyHasBroadBypassOrAllow(certificate, "service123")).toBe(true);
    expect(policyHasBroadBypassOrAllow(authMethod, "service123")).toBe(true);
    expect(policyHasBroadBypassOrAllow(exactEmail, "service123")).toBe(false);
    for (const email of ["person@example..test", "person@-example.test"]) {
      expect(() => parseAccessPolicy({ id: "policy126", decision: "allow", include: [{ email: { email } }] }))
        .toThrow("private_preview_invalid_access_policy");
    }
  });
});

describe("private preview checker transports", () => {
  it("keeps provider, service-token, and anonymous headers isolated and rejects redirects", async () => {
    const config = await configuration();
    const fetchMock = vi.fn(async (url, options) => {
      if (String(url).startsWith("https://api.cloudflare.com")) return cloudflare({ ok: true });
      if (options.headers["CF-Access-Client-Id"]) {
        return new Response("", { status: 302, headers: { location: "https://elsewhere.example.test/" } });
      }
      return new Response("", { status: 401 });
    });
    const transports = createPrivatePreviewTransports({ configuration: config, fetchImpl: fetchMock });

    await expect(
      transports.providerJson(new URL("https://api.cloudflare.com/client/v4/accounts/account123/entitlements"), "test")
    ).resolves.toEqual({ success: true, errors: [], result: { ok: true } });
    await expect(transports.serviceRequest(new URL(`https://${developHost}/`))).rejects.toThrow(
      "private_preview_unexpected_redirect"
    );
    await expect(transports.serviceRequest(new URL(`https://${hashHost}/`))).rejects.toThrow(
      "private_preview_unapproved_service_host"
    );
    await expect(transports.serviceRequest(new URL(`https://${developHost}/`), {
      method: "POST"
    })).rejects.toThrow("private_preview_request_not_read_only");
    await expect(transports.serviceRequest(new URL(`https://${developHost}/`), {
      headers: new Headers({ authorization: "Bearer leaked", "CF-Access-Client-Secret": "leaked" })
    })).rejects.toThrow("private_preview_unapproved_request_header");
    await expect(transports.anonymousRequest(new URL(`https://${developHost}/`), {
      headers: { Cookie: "leaked", "cF-aCcEsS-cLiEnT-iD": "leaked" }
    })).rejects.toThrow("private_preview_unapproved_request_header");
    await expect(assertAnonymousDenied(transports, config, developHost)).resolves.toBeUndefined();

    const providerHeaders = fetchMock.mock.calls[0][1].headers;
    const serviceHeaders = fetchMock.mock.calls[1][1].headers;
    const anonymousHeaders = fetchMock.mock.calls[2][1].headers;
    expect(fetchMock.mock.calls.every(([, options]) => options.redirect === "manual")).toBe(true);
    expect(providerHeaders.Authorization).toBe("Bearer provider-token");
    expect(providerHeaders["CF-Access-Client-Secret"]).toBeUndefined();
    expect(serviceHeaders.Authorization).toBeUndefined();
    expect(serviceHeaders["CF-Access-Client-Secret"]).toBe("service-secret");
    expect(anonymousHeaders.Authorization).toBeUndefined();
    expect(anonymousHeaders["CF-Access-Client-Id"]).toBeUndefined();
  });

  it("rejects anonymous access and a stalled request before it can hang a gate", async () => {
    const config = await configuration();
    const denied = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: async () => new Response("public", { status: 200 })
    });
    await expect(assertAnonymousDenied(denied, config, developHost)).rejects.toThrow(
      "private_preview_anonymous_access_not_denied"
    );

    const stalled = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: () => new Promise(() => {}),
      deadlineMs: 5
    });
    await expect(
      stalled.providerJson(new URL("https://api.cloudflare.com/client/v4/accounts/account123/entitlements"), "stall")
    ).rejects.toThrow("private_preview_deadline_exceeded");

    const bodyStalled = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: async () => new Response(
        new ReadableStream({ start() {} }),
        { status: 200, headers: { "content-type": "application/json" } }
      ),
      deadlineMs: 5
    });
    await expect(
      bodyStalled.providerJson(new URL("https://api.cloudflare.com/client/v4/accounts/account123/entitlements"), "body-stall")
    ).rejects.toThrow("private_preview_deadline_exceeded");

    let oversizedCancelled = false;
    const oversized = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: async () => new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(new Uint8Array(1024 * 1024 + 1));
          },
          cancel() {
            oversizedCancelled = true;
            return new Promise(() => {});
          }
        }),
        { status: 200, headers: { "content-type": "application/json" } }
      )
    });
    await expect(
      oversized.providerJson(new URL("https://api.cloudflare.com/client/v4/accounts/account123/entitlements"), "oversized")
    ).rejects.toThrow("private_preview_response_body_too_large");
    expect(oversizedCancelled).toBe(true);
  });

  it("cancels an unread failed response instead of holding the operation deadline", async () => {
    const config = await configuration();
    let cancelled = false;
    const transports = createPrivatePreviewTransports({
      configuration: config,
      deadlineMs: 500,
      fetchImpl: async (url) => {
        const target = new URL(String(url));
        if (target.pathname === "/content-version.json") {
          return Response.json({
            schemaVersion: 1,
            contentHash,
            commitSha: candidateSha,
            generatedAt: "2026-10-09T00:00:00.000Z",
            deployedAt: "2026-10-09T00:01:00.000Z"
          });
        }
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }), {
          status: 500,
          headers: { "content-type": "text/html" }
        });
      }
    });
    await expect(assertServiceAuthenticatedExistingPreview(transports, developHost))
      .rejects.toThrow("private_preview_service_auth_failed");
    await Promise.resolve();
    expect(cancelled).toBe(true);
  });
});

describe("private preview evidence", () => {
  it("uses a fresh private operation directory and refuses a worktree destination before writing", async () => {
    const config = await configuration();
    const first = new PrivateEvidenceStore(config.evidenceDirectory);
    const second = new PrivateEvidenceStore(config.evidenceDirectory);
    await first.capture("provider", "{\"one\":true}");
    await first.bindAccountEvidence("account123");
    await second.capture("provider", "{\"two\":true}");
    await second.bindAccountEvidence("account123");
    expect(first.directory).not.toBe(second.directory);

    const rejectedPath = path.join(process.cwd(), ".private-preview-evidence-test");
    const rejected = new PrivateEvidenceStore(rejectedPath);
    await expect(rejected.capture("provider", "{}"))
      .rejects.toThrow("private_preview_evidence_directory_inside_worktree");

    const linkedParent = path.join(temporaryRoot, "linked-worktree");
    const linkedTarget = path.join(linkedParent, "must-not-be-created");
    await symlink(process.cwd(), linkedParent);
    await expect(new PrivateEvidenceStore(linkedTarget).capture("provider", "{}"))
      .rejects.toThrow("private_preview_evidence_directory_inside_worktree");
    await expect(lstat(linkedTarget)).rejects.toMatchObject({ code: "ENOENT" });
  });
});

describe("private preview preflight", () => {
  it("proves the existing service path and returns an explicit entitlement-mapping activation block", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const remoteVersion = {
      schemaVersion: 1,
      contentHash,
      commitSha: candidateSha,
      generatedAt: "2026-10-09T00:00:00.000Z",
      deployedAt: "2026-10-09T00:01:00.000Z"
    };
    const fetchMock = vi.fn(async (url, options) => {
      const target = new URL(String(url));
      if (target.hostname === "api.cloudflare.com") {
        if (target.searchParams.get("page") === "2") return cloudflare([], pageInfo(2, 1, 0));
        if (target.pathname.endsWith("/pages/projects/smart-portfolio")) {
          return cloudflare({
            name: "smart-portfolio",
            production_branch: "main",
            subdomain: pagesDomain,
            source: null
          });
        }
        if (target.pathname.endsWith("/deployments")) return cloudflare([deployment()], pageInfo());
        if (target.pathname.endsWith("/access/apps")) return cloudflare([accessApplication()], pageInfo());
        if (target.pathname.endsWith("/policies")) return cloudflare([exactServicePolicy()], pageInfo());
        if (target.pathname.endsWith("/access/organizations")) {
          return cloudflare({ strict_service_token_auth: true, auth_domain: "team.cloudflareaccess.com" });
        }
        if (target.pathname.endsWith("/dns_records")) {
          return cloudflare([{ type: "CNAME", name: customHost, content: developHost, proxied: true }]);
        }
        if (target.pathname.endsWith(`/domains/${customHost}`)) {
          return cloudflare({
            name: customHost,
            status: "active",
            validation_data: { status: "active" },
            verification_data: { status: "active" }
          });
        }
        if (target.pathname.endsWith("/entitlements")) return cloudflare([]);
      }
      if (target.hostname === pagesDomain) {
        return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
      }
      if (["nicolasmgioanni.dev", "www.nicolasmgioanni.dev"].includes(target.hostname)) {
        return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
      }
      if (!options.headers["CF-Access-Client-Id"]) return new Response("", { status: 401 });
      if (target.pathname === "/content-version.json") return Response.json(remoteVersion);
      return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
    });
    const transports = createPrivatePreviewTransports({ configuration: config, fetchImpl: fetchMock });

    await expect(
      runPrivatePreviewPreflight({
        artifactDirectory: directory,
        expectedContentHash: contentHash,
        expectedCommitSha: candidateSha,
        configuration: config,
        transports
      })
    ).resolves.toMatchObject({
      status: "activation_blocked",
      reason: "entitlement_mapping_unreviewed",
      inventoryCount: 1,
      protectedHostCount: 3
    });
    const dnsRequest = fetchMock.mock.calls.find(([url]) => new URL(String(url)).pathname.endsWith("/dns_records"));
    expect(new URL(String(dnsRequest[0])).searchParams.get("name.exact")).toBe(customHost);
    expect(new URL(String(dnsRequest[0])).searchParams.get("type")).toBe("CNAME");
  });

  it("fails closed when the organization setting or either current preview host is public", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const cases = [
      { options: { strictServiceTokenAuth: false }, code: "private_preview_strict_service_token_auth_disabled" },
      { options: { publicPreviewHostname: developHost }, code: "private_preview_anonymous_access_not_denied" },
      { options: { publicPreviewHostname: customHost }, code: "private_preview_anonymous_access_not_denied" }
    ];
    for (const { options, code } of cases) {
      const transports = createPrivatePreviewTransports({ configuration: config, fetchImpl: standardPreflightFetch(options) });
      await expect(runPrivatePreviewPreflight({
        artifactDirectory: directory,
        expectedContentHash: contentHash,
        expectedCommitSha: candidateSha,
        configuration: config,
        transports
      })).rejects.toThrow(code);
    }
  });

  it("keeps an advertised failed historical alias in anonymous-denial coverage without requiring its old content", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const failedHistorical = {
      id: "olddeploy123",
      short_id: "old12345",
      project_name: "smart-portfolio",
      url: `https://old12345.${pagesDomain}`,
      aliases: [],
      environment: "preview",
      latest_stage: { name: "build", status: "failure" }
    };
    const transports = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: standardPreflightFetch({ deployments: [deployment(), failedHistorical] })
    });
    await expect(runPrivatePreviewPreflight({
      artifactDirectory: directory,
      expectedContentHash: contentHash,
      expectedCommitSha: candidateSha,
      configuration: config,
      transports
    })).resolves.toMatchObject({ status: "activation_blocked", protectedHostCount: 4 });
  });

  it("rejects broad or public Access posture and incorrect DNS or custom-domain state", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const publicOverride = {
      ...accessApplication(),
      destinations: [
        { type: "public", uri: `*.${pagesDomain}/*`, overrides: [{ behavior: "public", path_pattern: "/public" }] },
        { type: "public", uri: customHost }
      ]
    };
    const cases = [
      {
        options: { accountPolicies: [exactServicePolicy(), { id: "bypass123", decision: "bypass", include: [{ everyone: {} }] }] },
        code: "private_preview_access_broad_policy"
      },
      { options: { applications: [publicOverride] }, code: "private_preview_access_public_override" },
      {
        options: { dnsRecords: [{ type: "CNAME", name: customHost, content: `wrong.${pagesDomain}`, proxied: true }] },
        code: "private_preview_dns_mapping_invalid"
      },
      {
        options: { customDomain: { name: customHost, status: "pending", validation_data: { status: "active" }, verification_data: { status: "active" } } },
        code: "private_preview_custom_domain_inactive"
      }
    ];
    for (const { options, code } of cases) {
      const transports = createPrivatePreviewTransports({ configuration: config, fetchImpl: standardPreflightFetch(options) });
      await expect(runPrivatePreviewPreflight({
        artifactDirectory: directory,
        expectedContentHash: contentHash,
        expectedCommitSha: candidateSha,
        configuration: config,
        transports
      })).rejects.toThrow(code);
    }
  });

  it("rejects exact historical applications before mutation when they do not cover a future hash", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const remoteVersion = {
      schemaVersion: 1,
      contentHash,
      commitSha: candidateSha,
      generatedAt: "2026-10-09T00:00:00.000Z",
      deployedAt: "2026-10-09T00:01:00.000Z"
    };
    const fetchMock = async (url, options) => {
      const target = new URL(String(url));
      if (target.hostname === "api.cloudflare.com") {
        if (target.searchParams.get("page") === "2") return cloudflare([], pageInfo(2, 1, 0));
        if (target.pathname.endsWith("/pages/projects/smart-portfolio")) {
          return cloudflare({ name: "smart-portfolio", production_branch: "main", subdomain: pagesDomain, source: null });
        }
        if (target.pathname.endsWith("/deployments")) return cloudflare([deployment()], pageInfo());
        if (target.pathname.endsWith("/access/apps")) return cloudflare(exactHistoricalApplications(), pageInfo(1, 1, 3));
        if (target.pathname.endsWith("/policies")) return cloudflare([exactServicePolicy()], pageInfo());
        if (target.pathname.endsWith("/access/organizations")) return cloudflare({ strict_service_token_auth: true, auth_domain: "team.cloudflareaccess.com" });
        if (target.pathname.endsWith("/dns_records")) return cloudflare([{ type: "CNAME", name: customHost, content: developHost, proxied: true }]);
        if (target.pathname.endsWith(`/domains/${customHost}`)) return cloudflare({ name: customHost, status: "active", validation_data: { status: "active" }, verification_data: { status: "active" } });
        if (target.pathname.endsWith("/entitlements")) return cloudflare([]);
      }
      if (target.hostname === pagesDomain) return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
      if (["nicolasmgioanni.dev", "www.nicolasmgioanni.dev"].includes(target.hostname)) {
        return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
      }
      if (!options.headers["CF-Access-Client-Id"]) return new Response("", { status: 401 });
      if (target.pathname === "/content-version.json") return Response.json(remoteVersion);
      return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
    };
    const transports = createPrivatePreviewTransports({ configuration: config, fetchImpl: fetchMock });
    await expect(runPrivatePreviewPreflight({
      artifactDirectory: directory,
      expectedContentHash: contentHash,
      expectedCommitSha: candidateSha,
      configuration: config,
      transports
    })).rejects.toThrow("private_preview_future_hash_access_missing");
  });

  it("rejects duplicate deployment IDs and bounded pagination that never terminates", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const duplicate = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: standardPreflightFetch({ deployments: [deployment(), { ...deployment() }] })
    });
    await expect(runPrivatePreviewPreflight({
      artifactDirectory: directory,
      expectedContentHash: contentHash,
      expectedCommitSha: candidateSha,
      configuration: config,
      transports: duplicate
    })).rejects.toThrow("private_preview_duplicate_deployment");

    const nonterminating = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: async (url) => {
        const target = new URL(String(url));
        if (target.pathname.endsWith("/pages/projects/smart-portfolio")) {
          return cloudflare({ name: "smart-portfolio", production_branch: "main", subdomain: pagesDomain, source: null });
        }
        if (target.pathname.endsWith("/deployments")) {
          return cloudflare([deployment()], { page: Number(target.searchParams.get("page")), per_page: 50 });
        }
        return cloudflare([]);
      }
    });
    await expect(runPrivatePreviewPreflight({
      artifactDirectory: directory,
      expectedContentHash: contentHash,
      expectedCommitSha: candidateSha,
      configuration: config,
      transports: nonterminating
    })).rejects.toThrow("private_preview_incomplete_pagination");
  });

  it("deduplicates only consistent account and zone Access applications", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const fetchMock = async (url) => {
      const target = new URL(String(url));
      if (target.hostname !== "api.cloudflare.com") return new Response("", { status: 500 });
      if (target.searchParams.get("page") === "2") return cloudflare([], { page: 2 });
      if (target.pathname.endsWith("/pages/projects/smart-portfolio")) {
        return cloudflare({ name: "smart-portfolio", production_branch: "main", subdomain: pagesDomain, source: null });
      }
      if (target.pathname.endsWith("/deployments")) return cloudflare([deployment()], pageInfo());
      if (target.pathname.includes("/accounts/account123/access/apps")) return cloudflare([accessApplication()], pageInfo());
      if (target.pathname.includes("/zones/zone123/access/apps")) {
        return cloudflare([{ ...accessApplication(), destinations: [{ type: "public", uri: customHost }] }], pageInfo());
      }
      return cloudflare([]);
    };
    const transports = createPrivatePreviewTransports({ configuration: config, fetchImpl: fetchMock });
    await expect(runPrivatePreviewPreflight({
      artifactDirectory: directory,
      expectedContentHash: contentHash,
      expectedCommitSha: candidateSha,
      configuration: config,
      transports
    })).rejects.toThrow("private_preview_conflicting_access_application");
  });

  it("accepts reordered equivalent cross-scope policies and rejects a policy mismatch", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const accountPolicies = [
      exactServicePolicy(),
      { id: "deny123", decision: "deny", include: [{ saml: { attribute_name: "role", attribute_value: "viewer", identity_provider_id: "idp123" } }] }
    ];
    const reorderedPolicies = [
      { id: "deny123", decision: "deny", include: [{ saml: { identity_provider_id: "idp123", attribute_value: "viewer", attribute_name: "role" } }] },
      exactServicePolicy()
    ];
    const equivalent = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: standardPreflightFetch({ accountPolicies, zonePolicies: reorderedPolicies })
    });
    await expect(runPrivatePreviewPreflight({
      artifactDirectory: directory,
      expectedContentHash: contentHash,
      expectedCommitSha: candidateSha,
      configuration: config,
      transports: equivalent
    })).resolves.toMatchObject({ status: "activation_blocked" });

    const conflicting = createPrivatePreviewTransports({
      configuration: config,
      fetchImpl: standardPreflightFetch({
        accountPolicies,
        zonePolicies: [exactServicePolicy(), { id: "deny123", decision: "deny", include: [{ saml: { attribute_name: "role", attribute_value: "editor", identity_provider_id: "idp123" } }] }]
      })
    });
    await expect(runPrivatePreviewPreflight({
      artifactDirectory: directory,
      expectedContentHash: contentHash,
      expectedCommitSha: candidateSha,
      configuration: config,
      transports: conflicting
    })).rejects.toThrow("private_preview_conflicting_access_application");
  });

  it("verifies one exact uploaded deployment and every current private host", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const manifest = JSON.parse(await readFile(path.join(directory, "artifact-integrity.json"), "utf8"));
    const html = await readFile(path.join(directory, "index.html"), "utf8");
    const robots = await readFile(path.join(directory, "robots.txt"), "utf8");
    const sitemap = await readFile(path.join(directory, "sitemap.xml"), "utf8");
    const wranglerOutputPath = path.join(temporaryRoot, "wrangler.jsonl");
    await writeFile(wranglerOutputPath, [
      JSON.stringify({ type: "pages-deploy", version: 1, pages_project: "smart-portfolio", deployment_id: "deployment123", url: `https://${hashHost}` }),
      JSON.stringify({ type: "pages-deploy-detailed", version: 1, pages_project: "smart-portfolio", deployment_id: "deployment123", url: `https://${hashHost}`, alias: `https://${developHost}`, environment: "preview", deployment_trigger: { metadata: { commit_hash: candidateSha } } })
    ].join("\n"));
    const version = {
      schemaVersion: 1,
      contentHash,
      commitSha: candidateSha,
      generatedAt: "2026-10-09T00:00:00.000Z",
      deployedAt: "2026-10-09T00:01:00.000Z"
    };
    const fetchMock = vi.fn(async (url, options) => {
      const target = new URL(String(url));
      if (target.hostname === "api.cloudflare.com") {
        if (target.searchParams.get("page") === "2") return cloudflare([], { page: 2 });
        if (target.pathname.endsWith("/deployments/deployment123")) return cloudflare(deployment());
        if (target.pathname.endsWith("/pages/projects/smart-portfolio")) return cloudflare({ name: "smart-portfolio", production_branch: "main", subdomain: pagesDomain, source: null });
        if (target.pathname.endsWith("/deployments")) return cloudflare([deployment()], pageInfo());
        if (target.pathname.endsWith("/access/apps")) return cloudflare([accessApplication()], pageInfo());
        if (target.pathname.endsWith("/policies")) return cloudflare([exactServicePolicy()], pageInfo());
        if (target.pathname.endsWith("/access/organizations")) return cloudflare({ strict_service_token_auth: true, auth_domain: "team.cloudflareaccess.com" });
        if (target.pathname.endsWith("/dns_records")) return cloudflare([{ type: "CNAME", name: customHost, content: developHost, proxied: true }], pageInfo());
        if (target.pathname.endsWith(`/domains/${customHost}`)) return cloudflare({ name: customHost, status: "active", validation_data: { status: "active" }, verification_data: { status: "active" } });
        if (target.pathname.endsWith("/entitlements")) return cloudflare([]);
      }
      if ([pagesDomain, "nicolasmgioanni.dev", "www.nicolasmgioanni.dev"].includes(target.hostname)) {
        return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
      }
      if (!options.headers["CF-Access-Client-Id"]) return new Response("", { status: 401 });
      if (target.pathname === "/content-version.json") return Response.json(version);
      if (target.pathname === "/artifact-integrity.json") return Response.json(manifest);
      if (target.pathname === "/") return new Response(html, { status: 200, headers: { "content-type": "text/html" } });
      if (target.pathname === "/robots.txt") return new Response(robots, { status: 200, headers: { "content-type": "text/plain" } });
      if (target.pathname === "/sitemap.xml") return new Response(sitemap, { status: 200, headers: { "content-type": "application/xml" } });
      if (["/api/contact/verify", "/api/contact"].includes(target.pathname)) {
        return Response.json({ ok: false, error: "method_not_allowed" }, { status: 405 });
      }
      return new Response("missing", { status: 404 });
    });
    const transports = createPrivatePreviewTransports({ configuration: config, fetchImpl: fetchMock });
    await expect(verifyPrivatePreviewUpload({
      artifactDirectory: directory,
      expectedContentHash: contentHash,
      expectedCommitSha: candidateSha,
      wranglerOutputPath,
      configuration: config,
      transports
    })).resolves.toEqual({ status: "verified", hostCount: 3 });
    const serviceHosts = new Set(fetchMock.mock.calls
      .filter(([, options]) => options.headers["CF-Access-Client-Id"])
      .map(([url]) => new URL(String(url)).hostname));
    expect(serviceHosts).toEqual(new Set([hashHost, developHost, customHost]));
  });

  it("rejects mutated post-upload content contracts and refreshed provider posture", async () => {
    const config = await configuration();
    const directory = await artifactDirectory();
    const expectedVersion = {
      schemaVersion: 1,
      contentHash,
      commitSha: candidateSha,
      generatedAt: "2026-10-09T00:00:00.000Z",
      deployedAt: "2026-10-09T00:01:00.000Z"
    };
    const cases = [
      { options: { versionByHost: { [hashHost]: { ...expectedVersion, commitSha: "c".repeat(40) } } }, code: "private_preview_candidate_identity_mismatch" },
      { options: { versionByHost: { [hashHost]: { ...expectedVersion, contentHash: "d".repeat(64) } } }, code: "private_preview_candidate_identity_mismatch" },
      { options: { manifest: { unexpected: true } }, code: "private_preview_candidate_manifest_mismatch" },
      { options: { html: "changed root" }, code: "private_preview_candidate_static_content_mismatch" },
      { options: { robots: "changed robots" }, code: "private_preview_candidate_static_content_mismatch" },
      { options: { sitemap: "<changed/>" }, code: "private_preview_candidate_static_content_mismatch" },
      { options: { contactBody: { ok: true } }, code: "private_preview_service_auth_failed" },
      { options: { contactStatus: 200 }, code: "private_preview_service_auth_failed" },
      { options: { publicPreviewHostname: developHost }, code: "private_preview_anonymous_access_not_denied" },
      { options: { publicPreviewHostname: customHost }, code: "private_preview_anonymous_access_not_denied" },
      { options: { organization: { strict_service_token_auth: false, auth_domain: "team.cloudflareaccess.com" } }, code: "private_preview_strict_service_token_auth_disabled" },
      { options: { organization: { strict_service_token_auth: true, auth_domain: "wrong.cloudflareaccess.com" } }, code: "private_preview_strict_service_token_auth_unknown" }
    ];
    for (const { options, code } of cases) {
      const { fetchMock, wranglerOutputPath } = await successfulUploadFixture(config, directory, options);
      const transports = createPrivatePreviewTransports({ configuration: config, fetchImpl: fetchMock });
      await expect(verifyPrivatePreviewUpload({
        artifactDirectory: directory,
        expectedContentHash: contentHash,
        expectedCommitSha: candidateSha,
        wranglerOutputPath,
        configuration: config,
        transports
      })).rejects.toThrow(code);
    }
  });
});
