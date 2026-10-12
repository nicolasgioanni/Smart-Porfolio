import { createHash } from "node:crypto";
import { constants as fsConstants } from "node:fs";
import { execFile as execFileCallback } from "node:child_process";
import { chmod, lstat, mkdir, mkdtemp, open, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { artifactManifestFileName, verifyArtifactManifest } from "./artifactIntegrity.mjs";
import {
  assertCanonicalHomepageHtml,
  assertExactDeploymentText,
  assertMethodNotAllowedResponse
} from "./checkDeployedContent.mjs";
import { parseContentVersion, readContentVersion } from "./writeContentVersion.mjs";

const execFile = promisify(execFileCallback);

const apiOrigin = "https://api.cloudflare.com";
const apiPrefix = "/client/v4";
const expectedPagesProject = "smart-portfolio";
const expectedPagesDomain = "smart-portfolio-bds.pages.dev";
const expectedPublicHostnames = new Set(["nicolasmgioanni.dev"]);
const contentHashPattern = /^[a-f0-9]{64}$/;
const commitShaPattern = /^[a-f0-9]{40}$/;
const opaqueIdPattern = /^[A-Za-z0-9_-]{1,128}$/;
const apiPathPartPattern = /^[A-Za-z0-9._-]{1,253}$/;
const hostnameLabelPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/;
const responseBodyLimit = 1024 * 1024;
const operationDeadlineMs = 45_000;
const maxPaginationPages = 100;
const responseControls = new WeakMap();

export class PrivatePreviewCheckError extends Error {
  constructor(code) {
    super(code);
    this.name = "PrivatePreviewCheckError";
    this.code = code;
  }
}

function fail(code) {
  throw new PrivatePreviewCheckError(code);
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requiredString(value, code) {
  if (typeof value !== "string" || !value.trim()) fail(code);
  return value.trim();
}

function requiredOpaqueId(value, code) {
  const id = requiredString(value, code);
  if (!opaqueIdPattern.test(id)) fail(code);
  return id;
}

export function parseHostname(value, code = "private_preview_invalid_hostname") {
  const hostname = requiredString(value, code).toLowerCase();
  if (hostname.length > 253 || hostname.includes("..") || hostname.endsWith(".")) fail(code);
  const labels = hostname.split(".");
  if (labels.length < 2 || labels.some((label) => !hostnameLabelPattern.test(label))) fail(code);
  return hostname;
}

function parseHttpsOrigin(value, code) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail(code);
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.search ||
    url.hash
  ) {
    fail(code);
  }
  return url;
}

function pathForApi(parts) {
  if (!Array.isArray(parts) || parts.some((part) => typeof part !== "string" || !apiPathPartPattern.test(part))) {
    fail("private_preview_invalid_provider_path");
  }
  return `${apiPrefix}/${parts.map(encodeURIComponent).join("/")}`;
}

function apiUrl(parts, search = undefined) {
  const url = new URL(pathForApi(parts), apiOrigin);
  for (const [name, value] of search ?? []) url.searchParams.set(name, String(value));
  return url;
}

function pagesHost(label) {
  if (!hostnameLabelPattern.test(label)) fail("private_preview_invalid_pages_alias");
  return `${label}.${expectedPagesDomain}`;
}

export function parsePreviewPagesUrl(value, code = "private_preview_invalid_pages_url") {
  const url = parseHttpsOrigin(value, code);
  if (url.pathname !== "/") fail(code);
  const hostname = parseHostname(url.hostname, code);
  const suffix = `.${expectedPagesDomain}`;
  if (!hostname.endsWith(suffix)) fail(code);
  const alias = hostname.slice(0, -suffix.length);
  if (!hostnameLabelPattern.test(alias)) fail(code);
  return { url, hostname, alias };
}

function hostUrl(hostname, endpoint = "/") {
  const checkedHost = parseHostname(hostname);
  const url = new URL(`https://${checkedHost}`);
  url.pathname = endpoint;
  return url;
}

export function createPrivatePreviewConfiguration(environment = process.env) {
  const customHostname = parseHostname(
    requiredString(environment.PRIVATE_PREVIEW_CUSTOM_HOSTNAME, "private_preview_missing_custom_hostname"),
    "private_preview_invalid_custom_hostname"
  );
  const accessTeamDomain = parseHostname(
    requiredString(environment.PRIVATE_PREVIEW_ACCESS_TEAM_DOMAIN, "private_preview_missing_access_team_domain"),
    "private_preview_invalid_access_team_domain"
  );
  const accountId = requiredOpaqueId(
    environment.PRIVATE_PREVIEW_ACCOUNT_ID,
    "private_preview_invalid_account_id"
  );
  const zoneId = requiredOpaqueId(environment.PRIVATE_PREVIEW_DNS_ZONE_ID, "private_preview_invalid_zone_id");
  const serviceTokenId = requiredOpaqueId(
    environment.PRIVATE_PREVIEW_SERVICE_TOKEN_ID,
    "private_preview_invalid_service_token_id"
  );
  const apiToken = requiredString(environment.PRIVATE_PREVIEW_API_TOKEN, "private_preview_missing_api_token");
  const serviceClientId = requiredString(
    environment.PRIVATE_PREVIEW_ACCESS_CLIENT_ID,
    "private_preview_missing_service_client_id"
  );
  const serviceClientSecret = requiredString(
    environment.PRIVATE_PREVIEW_ACCESS_CLIENT_SECRET,
    "private_preview_missing_service_client_secret"
  );
  const evidenceDirectory = requiredString(
    environment.PRIVATE_PREVIEW_EVIDENCE_DIR,
    "private_preview_missing_evidence_directory"
  );

  return {
    accountId,
    apiToken,
    zoneId,
    serviceTokenId,
    serviceClientId,
    serviceClientSecret,
    customHostname,
    accessTeamDomain,
    evidenceDirectory,
    pagesProject: expectedPagesProject,
    pagesDomain: expectedPagesDomain,
    developHostname: pagesHost("develop")
  };
}

async function awaitUntilDeadline(operation, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) fail("private_preview_deadline_exceeded");
  let timer;
  try {
    return await Promise.race([
      operation,
      new Promise((_, reject) => {
        timer = setTimeout(
          () => reject(new PrivatePreviewCheckError("private_preview_deadline_exceeded")),
          remaining
        );
      })
    ]);
  } finally {
    clearTimeout(timer);
  }
}

async function readBoundedBody(response, limit = responseBodyLimit, deadline = Date.now() + operationDeadlineMs) {
  const declaredLength = response.headers.get("content-length");
  if (declaredLength && (!/^\d+$/.test(declaredLength) || Number(declaredLength) > limit)) {
    discardResponse(response);
    fail("private_preview_response_body_too_large");
  }
  if (!response.body) {
    completeResponse(response);
    return new Uint8Array();
  }

  const reader = response.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await awaitUntilDeadline(reader.read(), deadline);
      if (done) break;
      total += value.byteLength;
      if (total > limit) {
        discardResponse(response, reader);
        fail("private_preview_response_body_too_large");
      }
      chunks.push(value);
    }
  } catch (error) {
    discardResponse(response, reader);
    if (error instanceof PrivatePreviewCheckError) throw error;
    if (Date.now() >= deadline) fail("private_preview_deadline_exceeded");
    fail("private_preview_transport_failed");
  } finally {
    reader.releaseLock();
    completeResponse(response);
  }

  const body = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

function decodeUtf8(bytes, code) {
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch {
    fail(code);
  }
}

function jsonFromBytes(bytes, code) {
  try {
    return JSON.parse(decodeUtf8(bytes, code));
  } catch (error) {
    if (error instanceof PrivatePreviewCheckError) throw error;
    fail(code);
  }
}

function hashBytes(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function requireDeploymentInvariant(callback, code) {
  try {
    callback();
  } catch {
    fail(code);
  }
}

export class PrivateEvidenceStore {
  constructor(directory) {
    this.rootDirectory = directory;
    this.directory = undefined;
    this.sequence = 0;
    this.digests = [];
    this.ready = undefined;
    this.bound = false;
  }

  async prepare() {
    if (this.ready) return this.ready;
    this.ready = (async () => {
      if (!path.isAbsolute(this.rootDirectory)) fail("private_preview_invalid_evidence_directory");
      const requestedDirectory = path.resolve(this.rootDirectory);
      const worktreeRoots = await discoverGitWorktreeRoots();
      if (worktreeRoots.some((root) => pathContains(root, requestedDirectory))) {
        fail("private_preview_evidence_directory_inside_worktree");
      }
      const resolvedDirectory = await resolveEvidenceDirectory(requestedDirectory);
      if (worktreeRoots.some((root) => pathContains(root, resolvedDirectory))) {
        fail("private_preview_evidence_directory_inside_worktree");
      }
      await mkdir(resolvedDirectory, { recursive: true, mode: 0o700 });
      const metadata = await lstat(resolvedDirectory);
      if (!metadata.isDirectory() || metadata.isSymbolicLink()) {
        fail("private_preview_invalid_evidence_directory");
      }
      const verifiedDirectory = await realpath(resolvedDirectory);
      if (worktreeRoots.some((root) => pathContains(root, verifiedDirectory))) {
        fail("private_preview_evidence_directory_inside_worktree");
      }
      await chmod(verifiedDirectory, 0o700);
      this.directory = await mkdtemp(path.join(verifiedDirectory, "private-preview-operation-"));
      await chmod(this.directory, 0o700);
    })();
    return this.ready;
  }

  async writePrivateFile(filename, body) {
    await this.prepare();
    if (!/^[a-z0-9-]+\.json$/.test(filename)) fail("private_preview_invalid_evidence_filename");
    const filePath = path.join(this.directory, filename);
    let handle;
    try {
      handle = await open(
        filePath,
        fsConstants.O_WRONLY | fsConstants.O_CREAT | fsConstants.O_EXCL | (fsConstants.O_NOFOLLOW ?? 0),
        0o600
      );
      await handle.writeFile(body, { encoding: "utf8" });
    } catch (error) {
      if (error instanceof PrivatePreviewCheckError) throw error;
      fail("private_preview_evidence_write_failed");
    } finally {
      await handle?.close();
    }
  }

  async capture(kind, body) {
    if (!/^[a-z0-9-]+$/.test(kind) || typeof body !== "string") fail("private_preview_invalid_evidence");
    const filename = `${String(this.sequence += 1).padStart(3, "0")}-${kind}.json`;
    await this.writePrivateFile(filename, body);
    this.digests.push({ kind, sha256: hashBytes(body) });
  }

  async bindAccountEvidence(accountId) {
    if (this.bound) return;
    await this.writePrivateFile(
      "account-evidence.json",
      `${JSON.stringify({ accountId, observedAt: new Date().toISOString(), responses: this.digests })}\n`,
    );
    this.bound = true;
  }
}

function pathContains(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== "..");
}

async function discoverGitWorktreeRoots() {
  let output;
  try {
    ({ stdout: output } = await execFile("git", ["-C", process.cwd(), "worktree", "list", "--porcelain"], {
      encoding: "utf8",
      maxBuffer: 1024 * 1024
    }));
  } catch {
    fail("private_preview_worktree_inventory_failed");
  }
  const roots = [];
  for (const line of output.split(/\r?\n/)) {
    if (!line.startsWith("worktree ")) continue;
    const root = line.slice("worktree ".length);
    if (!path.isAbsolute(root)) fail("private_preview_worktree_inventory_failed");
    roots.push(path.resolve(root));
    try {
      roots.push(await realpath(root));
    } catch {
      fail("private_preview_worktree_inventory_failed");
    }
  }
  if (!roots.length) fail("private_preview_worktree_inventory_failed");
  return roots;
}

async function resolveEvidenceDirectory(candidate) {
  let ancestor = candidate;
  const suffix = [];
  while (true) {
    try {
      const metadata = await lstat(ancestor);
      if (!metadata.isDirectory() && !metadata.isSymbolicLink()) fail("private_preview_invalid_evidence_directory");
      return path.join(await realpath(ancestor), ...suffix);
    } catch (error) {
      if (error instanceof PrivatePreviewCheckError) throw error;
      if (error?.code !== "ENOENT") fail("private_preview_invalid_evidence_directory");
      const parent = path.dirname(ancestor);
      if (parent === ancestor) fail("private_preview_invalid_evidence_directory");
      suffix.unshift(path.basename(ancestor));
      ancestor = parent;
    }
  }
}

function completeResponse(response) {
  const control = responseControls.get(response);
  if (!control || control.complete) return;
  control.complete = true;
  clearTimeout(control.timeout);
  responseControls.delete(response);
}

function discardResponse(response, reader = undefined) {
  const control = responseControls.get(response);
  if (control && !control.complete) {
    control.complete = true;
    clearTimeout(control.timeout);
    control.controller.abort();
    responseControls.delete(response);
  }
  if (reader) {
    try {
      void Promise.resolve(reader.cancel()).catch(() => undefined);
    } catch {
      // Cancellation is best effort and must never keep the deadline path alive.
    }
  } else if (response.body) {
    try {
      void Promise.resolve(response.body.cancel()).catch(() => undefined);
    } catch {
      // Cancellation is best effort and must never keep the deadline path alive.
    }
  }
}

function failResponse(response, code) {
  discardResponse(response);
  fail(code);
}

async function boundedFetch(fetchImpl, url, options, deadline) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) fail("private_preview_deadline_exceeded");
  const controller = new AbortController();
  let rejectDeadline;
  const deadlinePromise = new Promise((_, reject) => {
    rejectDeadline = reject;
  });
  const timeout = setTimeout(() => {
    controller.abort();
    rejectDeadline(new PrivatePreviewCheckError("private_preview_deadline_exceeded"));
  }, remaining);
  try {
    const response = await Promise.race([
      fetchImpl(url, { ...options, redirect: "manual", signal: controller.signal }),
      deadlinePromise
    ]);
    responseControls.set(response, { controller, timeout, complete: false });
    return response;
  } catch (error) {
    clearTimeout(timeout);
    if (error instanceof PrivatePreviewCheckError) throw error;
    if (Date.now() >= deadline) fail("private_preview_deadline_exceeded");
    fail("private_preview_transport_failed");
  }
}

function assertNoRedirect(response) {
  if (response.status >= 300 && response.status < 400) {
    discardResponse(response);
    fail("private_preview_unexpected_redirect");
  }
}

function assertJsonResponse(response) {
  assertNoRedirect(response);
  if (!response.ok) fail(`private_preview_http_${response.status}`);
  if (!/^application\/json\b/i.test(response.headers.get("content-type") ?? "")) {
    fail("private_preview_expected_json_response");
  }
}

function assertProviderUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    fail("private_preview_invalid_provider_url");
  }
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.port ||
    url.hash ||
    url.origin !== apiOrigin ||
    !url.pathname.startsWith(`${apiPrefix}/`)
  ) {
    fail("private_preview_invalid_provider_url");
  }
  return url;
}

function assertPrivatePreviewUrl(value, configuration, allowedHostnames) {
  const url = parseHttpsOrigin(value.toString(), "private_preview_invalid_preview_url");
  const hostname = parseHostname(url.hostname, "private_preview_invalid_preview_url");
  if (allowedHostnames?.has(hostname)) return url;
  if (allowedHostnames) fail("private_preview_unapproved_service_host");
  if (hostname === configuration.customHostname) return url;
  const suffix = `.${configuration.pagesDomain}`;
  if (!hostname.endsWith(suffix) || !hostnameLabelPattern.test(hostname.slice(0, -suffix.length))) {
    fail("private_preview_invalid_preview_url");
  }
  return url;
}

function assertAnonymousPreviewOrProductionUrl(value, configuration) {
  const url = parseHttpsOrigin(value.toString(), "private_preview_invalid_preview_url");
  const hostname = parseHostname(url.hostname, "private_preview_invalid_preview_url");
  if (hostname === configuration.pagesDomain || expectedPublicHostnames.has(hostname)) return url;
  return assertPrivatePreviewUrl(url, configuration);
}

function assertReadOnlyRequestOptions(options) {
  if (options === undefined) return;
  if (!isRecord(options) || Object.keys(options).some((key) => key !== "method" && key !== "headers")) {
    fail("private_preview_invalid_request_options");
  }
  if (options.method !== undefined && String(options.method).toUpperCase() !== "GET") {
    fail("private_preview_request_not_read_only");
  }
  if (options.headers !== undefined) {
    let headers;
    try {
      headers = new Headers(options.headers);
    } catch {
      fail("private_preview_invalid_request_options");
    }
    if ([...headers.keys()].length > 0) fail("private_preview_unapproved_request_header");
  }
}

export function parseCloudflareEnvelope(value) {
  if (
    !isRecord(value) ||
    value.success !== true ||
    !("result" in value) ||
    !Array.isArray(value.errors) ||
    value.errors.length !== 0
  ) {
    fail("private_preview_invalid_provider_response");
  }
  return value.result;
}

export function createPrivatePreviewTransports({
  configuration,
  fetchImpl = fetch,
  evidenceStore = new PrivateEvidenceStore(configuration.evidenceDirectory),
  now = () => Date.now(),
  deadlineMs = operationDeadlineMs
}) {
  const deadline = now() + deadlineMs;
  const serviceHostnames = new Set([configuration.developHostname, configuration.customHostname]);

  async function providerJson(url, kind) {
    const checkedUrl = assertProviderUrl(url);
    const response = await boundedFetch(
      fetchImpl,
      checkedUrl,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${configuration.apiToken}`
        }
      },
      deadline
    );
    const bytes = await readBoundedBody(response, responseBodyLimit, deadline);
    const text = decodeUtf8(bytes, "private_preview_invalid_provider_json");
    await evidenceStore.capture(kind, text);
    assertJsonResponse(response);
    return jsonFromBytes(bytes, "private_preview_invalid_provider_json");
  }

  async function serviceRequest(url, options = {}) {
    const checkedUrl = assertPrivatePreviewUrl(url, configuration, serviceHostnames);
    assertReadOnlyRequestOptions(options);
    const response = await boundedFetch(
      fetchImpl,
      checkedUrl,
      {
        headers: {
          "CF-Access-Client-Id": configuration.serviceClientId,
          "CF-Access-Client-Secret": configuration.serviceClientSecret,
          "Cache-Control": "no-cache",
          Pragma: "no-cache"
        }
      },
      deadline
    );
    assertNoRedirect(response);
    return response;
  }

  async function anonymousRequest(url, options = {}) {
    const checkedUrl = assertAnonymousPreviewOrProductionUrl(url, configuration);
    assertReadOnlyRequestOptions(options);
    return boundedFetch(
      fetchImpl,
      checkedUrl,
      {
        headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }
      },
      deadline
    );
  }

  return {
    providerJson,
    serviceRequest,
    anonymousRequest,
    readBody: (response) => readBoundedBody(response, responseBodyLimit, deadline),
    bindEvidence: () => evidenceStore.bindAccountEvidence(configuration.accountId),
    allowServiceHost: (hostname) => serviceHostnames.add(parsePreviewPagesUrl(`https://${hostname}`).hostname),
    deadline
  };
}

export function parseResultInfo(value, expectedPage) {
  if (value === undefined) return undefined;
  if (!isRecord(value)) fail("private_preview_invalid_pagination");
  const page = value.page;
  const perPage = value.per_page;
  if (page !== undefined && (!Number.isInteger(page) || page !== expectedPage || page < 1)) {
    fail("private_preview_invalid_pagination");
  }
  if (perPage !== undefined && (!Number.isInteger(perPage) || perPage < 1)) {
    fail("private_preview_invalid_pagination");
  }
  for (const name of ["count", "total_count", "total_pages"]) {
    if (value[name] !== undefined && (!Number.isInteger(value[name]) || value[name] < 0)) {
      fail("private_preview_invalid_pagination");
    }
  }
  return { page, perPage };
}

async function listAllPages(transports, makeUrl, kind) {
  const records = [];
  for (let page = 1; page <= maxPaginationPages; page += 1) {
    const url = makeUrl(page);
    const envelope = await transports.providerJson(url, kind);
    const result = parseCloudflareEnvelope(envelope);
    if (!Array.isArray(result)) {
      fail("private_preview_invalid_paginated_result");
    }
    parseResultInfo(envelope.result_info, page);
    if (result.length === 0) return records;
    records.push(...result);
  }
  fail("private_preview_incomplete_pagination");
}

async function providerEnvelope(transports, url, kind) {
  const response = await transports.providerJson(url, kind);
  return parseCloudflareEnvelope(response);
}

export function parsePagesDeployment(
  value,
  configuration,
  { expectedDeploymentId, expectedCommitSha, expectedBranch, requireSuccessful = true } = {}
) {
  if (!isRecord(value)) fail("private_preview_invalid_pages_deployment");
  const id = requiredOpaqueId(value.id, "private_preview_invalid_pages_deployment");
  const project = requiredString(value.project_name, "private_preview_invalid_pages_deployment");
  if (project !== configuration.pagesProject) fail("private_preview_pages_identity_mismatch");
  if (expectedDeploymentId && id !== expectedDeploymentId) fail("private_preview_deployment_identity_mismatch");
  if (value.environment !== "preview") fail("private_preview_pages_environment_mismatch");
  const deployed = parsePreviewPagesUrl(value.url, "private_preview_invalid_pages_deployment_url");
  const shortId = requiredString(value.short_id, "private_preview_invalid_pages_deployment");
  if (shortId.length !== 8 || shortId !== shortId.trim() || deployed.alias !== shortId.toLowerCase()) {
    fail("private_preview_deployment_identity_mismatch");
  }
  const commitHash = value.deployment_trigger?.metadata?.commit_hash;
  const branch = value.deployment_trigger?.metadata?.branch;
  if (commitHash !== undefined && !commitShaPattern.test(commitHash)) fail("private_preview_invalid_pages_deployment");
  if (expectedCommitSha && commitHash !== expectedCommitSha) fail("private_preview_deployment_commit_mismatch");
  if (expectedBranch && branch !== expectedBranch) fail("private_preview_deployment_branch_mismatch");
  const stage = value.latest_stage;
  const knownStageNames = new Set(["queued", "initialize", "clone_repo", "build", "deploy"]);
  const knownStageStatuses = new Set(["idle", "active", "success", "failure", "canceled", "skipped"]);
  if (!isRecord(stage) || !knownStageNames.has(stage.name) || !knownStageStatuses.has(stage.status)) {
    fail("private_preview_invalid_pages_deployment");
  }
  if (requireSuccessful && (stage.name !== "deploy" || stage.status !== "success")) {
    fail("private_preview_deployment_not_successful");
  }
  const aliases = value.aliases;
  if (!Array.isArray(aliases) || aliases.some((alias) => typeof alias !== "string")) {
    fail("private_preview_invalid_pages_deployment");
  }
  const parsedAliases = aliases.map((alias) => parsePreviewPagesUrl(alias, "private_preview_invalid_pages_deployment_url"));
  return { id, shortId, url: deployed.url.toString(), hostname: deployed.hostname, commitHash, branch, aliases: parsedAliases };
}

export function parsePagesProject(value, configuration) {
  if (!isRecord(value) || value.name !== configuration.pagesProject || value.production_branch !== "main") {
    fail("private_preview_pages_identity_mismatch");
  }
  if (parseHostname(value.subdomain, "private_preview_pages_identity_mismatch") !== configuration.pagesDomain) {
    fail("private_preview_pages_identity_mismatch");
  }
  if (value.source !== undefined && value.source !== null) fail("private_preview_pages_not_direct_upload");
  return value;
}

export function parseWranglerPagesDeployOutput(source, configuration, expectedCommitSha) {
  if (typeof source !== "string" || !source.trim()) fail("private_preview_missing_wrangler_output");
  if (!commitShaPattern.test(expectedCommitSha)) fail("private_preview_invalid_candidate_sha");
  const records = [];
  for (const line of source.split(/\r?\n/)) {
    if (!line.trim()) continue;
    let record;
    try {
      record = JSON.parse(line);
    } catch {
      fail("private_preview_invalid_wrangler_output");
    }
    if (!isRecord(record)) fail("private_preview_invalid_wrangler_output");
    if (record.type === "pages-deploy" || record.type === "pages-deploy-detailed") records.push(record);
  }
  const compact = records.filter((record) => record.type === "pages-deploy");
  const detailed = records.filter((record) => record.type === "pages-deploy-detailed");
  if (compact.length !== 1 || detailed.length !== 1) fail("private_preview_ambiguous_wrangler_output");
  const output = detailed[0];
  if (output.version !== 1 || compact[0].version !== 1) fail("private_preview_invalid_wrangler_output");
  if (
    compact[0].pages_project !== output.pages_project ||
    compact[0].deployment_id !== output.deployment_id ||
    compact[0].url !== output.url
  ) {
    fail("private_preview_ambiguous_wrangler_output");
  }
  if (
    output.pages_project !== configuration.pagesProject ||
    output.environment !== "preview" ||
    (output.production_branch !== undefined && output.production_branch !== "main") ||
    output.deployment_trigger?.metadata?.commit_hash !== expectedCommitSha
  ) {
    fail("private_preview_deployment_identity_mismatch");
  }
  const deployed = parsePreviewPagesUrl(output.url, "private_preview_invalid_pages_deployment_url");
  const alias = output.alias === undefined || output.alias === null
    ? undefined
    : parsePreviewPagesUrl(output.alias, "private_preview_invalid_pages_deployment_url");
  return {
    id: requiredOpaqueId(output.deployment_id, "private_preview_invalid_wrangler_output"),
    url: deployed.url.toString(),
    hostname: deployed.hostname,
    commitHash: expectedCommitSha,
    aliases: alias ? [alias] : []
  };
}

export function parseAccessApplication(value, scope) {
  if (!isRecord(value)) fail("private_preview_invalid_access_application");
  const id = requiredOpaqueId(value.id, "private_preview_invalid_access_application");
  if (scope !== "account" && scope !== "zone") fail("private_preview_invalid_access_application");
  const knownApplicationTypes = new Set([
    "self_hosted", "saas", "ssh", "vnc", "app_launcher", "warp", "biso", "bookmark", "dash_sso",
    "infrastructure", "rdp", "mcp", "mcp_portal", "proxy_endpoint"
  ]);
  if (typeof value.type !== "string" || !knownApplicationTypes.has(value.type)) {
    fail("private_preview_invalid_access_application");
  }
  const destinations = [];
  if (Array.isArray(value.destinations) && value.destinations.length > 0) {
    for (const source of value.destinations) {
      destinations.push(...parseApplicationDestination(source));
    }
  } else {
    if (value.destinations !== undefined && !Array.isArray(value.destinations)) {
      fail("private_preview_invalid_access_application");
    }
    if (value.self_hosted_domains !== undefined && !Array.isArray(value.self_hosted_domains)) {
      fail("private_preview_invalid_access_application");
    }
    for (const domain of value.self_hosted_domains ?? []) {
      destinations.push({
        ...parsePublicDestinationUri(domain),
        overrides: [],
        raw: { uri: domain }
      });
    }
    const requiredDomainTypes = new Set(["self_hosted", "ssh", "vnc", "rdp"]);
    const optionalDomainTypes = new Set(["mcp_portal"]);
    if (requiredDomainTypes.has(value.type)) {
      if (typeof value.domain !== "string") fail("private_preview_invalid_access_application");
      destinations.push({
        ...parsePublicDestinationUri(value.domain),
        overrides: [],
        raw: { uri: value.domain }
      });
    } else if (optionalDomainTypes.has(value.type) && value.domain !== undefined) {
      if (typeof value.domain !== "string") fail("private_preview_invalid_access_application");
      destinations.push({
        ...parsePublicDestinationUri(value.domain),
        overrides: [],
        raw: { uri: value.domain }
      });
    } else if (value.domain !== undefined && typeof value.domain !== "string") {
      fail("private_preview_invalid_access_application");
    }
  }
  return { id, scope, type: value.type, destinations, raw: value };
}

function parseApplicationDestination(source) {
  if (!isRecord(source)) fail("private_preview_invalid_access_application");
  if (source.type === undefined) {
    if (typeof source.uri === "string") {
      if (!hasExactObjectKeys(source, ["uri"], ["overrides"])) fail("private_preview_invalid_access_application");
      return [{ ...parsePublicDestinationUri(source.uri), overrides: parsePublicOverrides(source.overrides), raw: source }];
    }
    if (hasExactObjectKeys(source, [], ["cidr", "hostname", "l4_protocol", "port_range", "vnet_id"]) && Object.keys(source).length > 0) {
      return [];
    }
    if (hasExactObjectKeys(source, [], ["mcp_server_id"]) && typeof source.mcp_server_id === "string") return [];
    fail("private_preview_invalid_access_application");
  }
  if (source.type === "public") {
    if (!hasExactObjectKeys(source, ["type", "uri"], ["overrides"]) || typeof source.uri !== "string") {
      fail("private_preview_invalid_access_application");
    }
    return [{ ...parsePublicDestinationUri(source.uri), overrides: parsePublicOverrides(source.overrides), raw: source }];
  }
  if (source.type === "private") {
    if (!hasExactObjectKeys(source, ["type"], ["cidr", "hostname", "l4_protocol", "port_range", "vnet_id"])) {
      fail("private_preview_invalid_access_application");
    }
    return [];
  }
  if (source.type === "via_mcp_server_portal") {
    if (!hasExactObjectKeys(source, ["type"], ["mcp_server_id"])) fail("private_preview_invalid_access_application");
    return [];
  }
  if (source.type === "worker" || source.type === "preview_worker") {
    if (!hasExactObjectKeys(source, ["type", "worker_id"], ["overrides"]) || !isStringProperty(source, "worker_id")) {
      fail("private_preview_invalid_access_application");
    }
    parsePublicOverrides(source.overrides);
    return [];
  }
  if (source.type === "all_workers" || source.type === "all_preview_workers") {
    if (!hasExactObjectKeys(source, ["type"], ["overrides"])) fail("private_preview_invalid_access_application");
    parsePublicOverrides(source.overrides);
    return [];
  }
  fail("private_preview_invalid_access_application");
}

function parsePublicDestinationUri(value) {
  if (typeof value !== "string" || !value || value !== value.trim() || /[\s?#\\]/.test(value)) {
    fail("private_preview_invalid_access_application");
  }
  const separator = value.indexOf("/");
  const hostname = separator === -1 ? value : value.slice(0, separator);
  const destinationPath = separator === -1 ? "/" : value.slice(separator);
  if (/[:@]/.test(hostname) || !destinationPath.startsWith("/") || !/^[A-Za-z0-9._~!$&'()*+,;=:@/%-]*$/.test(destinationPath)) {
    fail("private_preview_invalid_access_application");
  }
  return { hostname: parseApplicationDestinationHostname(hostname), path: destinationPath };
}

function parsePublicOverrides(value) {
  if (value === undefined) return [];
  if (!Array.isArray(value) || value.some((override) => !isRecord(override))) {
    fail("private_preview_invalid_access_application");
  }
  for (const override of value) {
    if (
      override.behavior !== "public" ||
      typeof override.path_pattern !== "string" ||
      !override.path_pattern.startsWith("/") ||
      /[\s?#\\]/.test(override.path_pattern)
    ) {
      fail("private_preview_invalid_access_application");
    }
  }
  return value;
}

function hostMatchesApplicationDestination(hostname, destinationHostname) {
  const labels = hostname.split(".");
  const patterns = destinationHostname.split(".");
  return labels.length === patterns.length && labels.every((label, index) => wildcardLabelMatches(label, patterns[index]));
}

function destinationCoversRoot(destination) {
  return destination.path === "/" || destination.path === "/*";
}

function parseApplicationDestinationHostname(value) {
  const hostname = requiredString(value, "private_preview_invalid_access_application").toLowerCase();
  if (hostname.length > 253 || hostname.includes("..") || hostname.endsWith(".")) {
    fail("private_preview_invalid_access_application");
  }
  const labels = hostname.split(".");
  if (labels.length < 2 || labels.some((label) => !validApplicationHostnameLabel(label))) {
    fail("private_preview_invalid_access_application");
  }
  return hostname;
}

function validApplicationHostnameLabel(label) {
  if (!label || label.length > 63) return false;
  const wildcardCount = [...label].filter((character) => character === "*").length;
  if (wildcardCount > 1) return false;
  if (wildcardCount === 0) return hostnameLabelPattern.test(label);
  const literal = label.replace("*", "");
  return literal === "" || /^[a-z0-9-]+$/.test(literal);
}

function wildcardLabelMatches(label, pattern) {
  if (!pattern.includes("*")) return label === pattern;
  const [prefix, suffix] = pattern.split("*");
  return label.startsWith(prefix) && label.endsWith(suffix) && label.length >= prefix.length + suffix.length;
}

function policyConditions(value, code) {
  if (!Array.isArray(value) || value.some((entry) => !isRecord(entry))) fail(code);
  for (const entry of value) {
    const keys = Object.keys(entry);
    if (keys.length !== 1 || !policySelectorIsValid(keys[0], entry[keys[0]])) fail(code);
  }
  return value;
}

function hasExactObjectKeys(value, required, optional = []) {
  if (!isRecord(value)) return false;
  const keys = Object.keys(value);
  return required.every((key) => key in value) && keys.every((key) => required.includes(key) || optional.includes(key));
}

function isStringProperty(value, name) {
  return typeof value[name] === "string" && value[name].length > 0;
}

function policySelectorIsValid(selector, value) {
  const stringField = (field) => hasExactObjectKeys(value, [field]) && isStringProperty(value, field);
  switch (selector) {
    case "group": return stringField("id");
    case "any_valid_service_token":
    case "certificate":
    case "everyone": return hasExactObjectKeys(value, []);
    case "auth_context": return hasExactObjectKeys(value, ["id", "ac_id", "identity_provider_id"]) &&
      ["id", "ac_id", "identity_provider_id"].every((field) => isStringProperty(value, field));
    case "auth_method": return stringField("auth_method");
    case "azureAD": return hasExactObjectKeys(value, ["id", "identity_provider_id"]) &&
      isStringProperty(value, "id") && isStringProperty(value, "identity_provider_id");
    case "common_name": return stringField("common_name");
    case "geo": return stringField("country_code");
    case "device_posture": return hasExactObjectKeys(value, ["integration_uid"], ["account_id"]) &&
      isStringProperty(value, "integration_uid") && (value.account_id === undefined || isStringProperty(value, "account_id"));
    case "email_domain": return stringField("domain");
    case "email_list": return stringField("id");
    case "email": return hasExactObjectKeys(value, ["email"]) && isExactIndividualEmail(value.email);
    case "external_evaluation": return hasExactObjectKeys(value, ["evaluate_url", "keys_url"]) &&
      isStringProperty(value, "evaluate_url") && isStringProperty(value, "keys_url");
    case "github-organization": return hasExactObjectKeys(value, ["identity_provider_id", "name"], ["team"]) &&
      isStringProperty(value, "identity_provider_id") && isStringProperty(value, "name") &&
      (value.team === undefined || isStringProperty(value, "team"));
    case "gsuite": return hasExactObjectKeys(value, ["email", "identity_provider_id"]) &&
      isStringProperty(value, "email") && isStringProperty(value, "identity_provider_id");
    case "login_method": return stringField("id");
    case "ip_list": return stringField("id");
    case "ip": return stringField("ip");
    case "okta": return hasExactObjectKeys(value, ["identity_provider_id", "name"]) &&
      isStringProperty(value, "identity_provider_id") && isStringProperty(value, "name");
    case "saml": return hasExactObjectKeys(value, ["attribute_name", "attribute_value", "identity_provider_id"]) &&
      ["attribute_name", "attribute_value", "identity_provider_id"].every((field) => isStringProperty(value, field));
    case "oidc": return hasExactObjectKeys(value, ["claim_name", "claim_value", "identity_provider_id"]) &&
      ["claim_name", "claim_value", "identity_provider_id"].every((field) => isStringProperty(value, field));
    case "service_token": return hasExactObjectKeys(value, ["token_id"]) && opaqueIdPattern.test(value.token_id ?? "");
    case "linked_app_token": return stringField("app_uid");
    case "user_risk_score": return hasExactObjectKeys(value, ["user_risk_score"]) &&
      Array.isArray(value.user_risk_score) && value.user_risk_score.length > 0 &&
      value.user_risk_score.every((score) => ["low", "medium", "high", "unscored"].includes(score));
    case "cloudflare_account_member": return hasExactObjectKeys(value, [], ["account_id"]) &&
      (value.account_id === undefined || isStringProperty(value, "account_id"));
    default: return false;
  }
}

function isExactIndividualEmail(value) {
  if (typeof value !== "string") return false;
  for (const character of value) {
    const codePoint = character.codePointAt(0);
    if (character === "*" || /\s/u.test(character) || codePoint <= 0x1f || codePoint === 0x7f) return false;
  }
  const parts = value.split("@");
  if (parts.length !== 2 || !/^[A-Za-z0-9.!#$%&'+/=?^_`{|}~-]+$/.test(parts[0]) ||
      parts[0].startsWith(".") || parts[0].endsWith(".") || parts[0].includes("..")) {
    return false;
  }
  try {
    parseHostname(parts[1], "private_preview_invalid_access_policy");
    return true;
  } catch {
    return false;
  }
}

export function parseAccessPolicy(value) {
  if (!isRecord(value)) fail("private_preview_invalid_access_policy");
  const id = requiredOpaqueId(value.id, "private_preview_invalid_access_policy");
  const decision = requiredString(value.decision, "private_preview_invalid_access_policy");
  if (!["allow", "deny", "non_identity", "bypass"].includes(decision)) {
    fail("private_preview_invalid_access_policy");
  }
  const include = policyConditions(value.include, "private_preview_invalid_access_policy");
  const exclude = value.exclude === undefined ? [] : policyConditions(value.exclude, "private_preview_invalid_access_policy");
  const require = value.require === undefined ? [] : policyConditions(value.require, "private_preview_invalid_access_policy");
  return { id, decision, include, exclude, require };
}

function isExactServiceTokenPolicy(policy, serviceTokenId) {
  return (
    policy.decision === "non_identity" &&
    policy.include.length === 1 &&
    policy.exclude.length === 0 &&
    policy.require.length === 0 &&
    isRecord(policy.include[0].service_token) &&
    policy.include[0].service_token.token_id === serviceTokenId
  );
}

export function policyHasBroadBypassOrAllow(policy, serviceTokenId) {
  const allowHasUnresolvedAudience = policy.include.some((condition) =>
    !Object.prototype.hasOwnProperty.call(condition, "email")
  );
  return policy.decision === "bypass" || (policy.decision === "allow" && allowHasUnresolvedAudience) ||
    (policy.decision === "non_identity" && !isExactServiceTokenPolicy(policy, serviceTokenId));
}

async function listAccessPolicies(transports, configuration, application, cache) {
  const key = `${application.scope}:${application.id}`;
  const cached = cache.get(key);
  if (cached) return cached;
  const root = application.scope === "account"
    ? ["accounts", configuration.accountId, "access", "apps", application.id, "policies"]
    : ["zones", configuration.zoneId, "access", "apps", application.id, "policies"];
  const values = await listAllPages(
    transports,
    (page) => apiUrl(root, [["page", page], ["per_page", 50]]),
    "access-policies"
  );
  const policies = values.map(parseAccessPolicy);
  const identifiers = new Set();
  for (const policy of policies) {
    if (identifiers.has(policy.id)) fail("private_preview_duplicate_access_policy");
    identifiers.add(policy.id);
  }
  cache.set(key, policies);
  return policies;
}

async function assertAccessCoverage(transports, configuration, applications, hostname, policyCache) {
  const matched = applications.filter((application) =>
    application.destinations.some((destination) => hostMatchesApplicationDestination(hostname, destination.hostname))
  );
  if (!matched.length) fail("private_preview_access_application_missing");
  if (!matched.some((application) => application.destinations.some((destination) =>
    hostMatchesApplicationDestination(hostname, destination.hostname) && destinationCoversRoot(destination)
  ))) {
    fail("private_preview_access_root_coverage_missing");
  }
  for (const application of matched) {
    if (application.destinations.some((destination) =>
      hostMatchesApplicationDestination(hostname, destination.hostname) && destination.overrides.length > 0
    )) {
      fail("private_preview_access_public_override");
    }
    const policies = await listAccessPolicies(transports, configuration, application, policyCache);
    if (policies.some((policy) => policyHasBroadBypassOrAllow(policy, configuration.serviceTokenId))) {
      fail("private_preview_access_broad_policy");
    }
    if (!policies.some((policy) => isExactServiceTokenPolicy(policy, configuration.serviceTokenId))) {
      fail("private_preview_access_service_policy_missing");
    }
  }
}

export function destinationOverlapsPagesNamespace(destination, configuration) {
  const destinationLabels = destination.hostname.split(".");
  const pagesLabels = configuration.pagesDomain.split(".");
  if (destinationLabels.length !== pagesLabels.length + 1) return false;
  return pagesLabels.every((label, index) => wildcardLabelMatches(label, destinationLabels[index + 1]));
}

async function assertFuturePagesHashCoverage(transports, configuration, applications, policyCache) {
  const namespaceApplications = applications.filter((application) =>
    application.destinations.some((destination) => destinationOverlapsPagesNamespace(destination, configuration))
  );
  const wildcardApplications = namespaceApplications.filter((application) =>
    application.destinations.some((destination) =>
      destination.hostname === `*.${configuration.pagesDomain}` && destinationCoversRoot(destination)
    )
  );
  if (!wildcardApplications.length) fail("private_preview_future_hash_access_missing");

  for (const application of namespaceApplications) {
    for (const destination of application.destinations) {
      if (destinationOverlapsPagesNamespace(destination, configuration) && destination.overrides.length > 0) {
        fail("private_preview_access_public_override");
      }
    }
    const policies = await listAccessPolicies(transports, configuration, application, policyCache);
    if (policies.some((policy) => policyHasBroadBypassOrAllow(policy, configuration.serviceTokenId))) {
      fail("private_preview_access_broad_policy");
    }
    if (!policies.some((policy) => isExactServiceTokenPolicy(policy, configuration.serviceTokenId))) {
      fail("private_preview_access_service_policy_missing");
    }
  }
}

function parseStrictServiceTokenSetting(value, configuration) {
  if (
    !isRecord(value) ||
    typeof value.strict_service_token_auth !== "boolean" ||
    parseHostname(value.auth_domain, "private_preview_access_tenant_mismatch") !== configuration.accessTeamDomain
  ) {
    fail("private_preview_strict_service_token_auth_unknown");
  }
  if (value.strict_service_token_auth !== true) fail("private_preview_strict_service_token_auth_disabled");
}

export function parseEntitlementEvidence(value) {
  if (!Array.isArray(value)) fail("private_preview_invalid_entitlement_response");
  const identifiers = new Set();
  for (const record of value) {
    if (!isRecord(record) || (record.deleted_date !== "" && record.deleted_date !== undefined)) {
      fail("private_preview_invalid_entitlement_response");
    }
    const id = requiredString(record.id, "private_preview_invalid_entitlement_response");
    if (!isRecord(record.feature) || !Number.isInteger(record.feature.id) ||
        !requiredString(record.feature.feature_set, "private_preview_invalid_entitlement_response") ||
        !requiredString(record.feature.key, "private_preview_invalid_entitlement_response") ||
        !requiredString(record.feature.name, "private_preview_invalid_entitlement_response")) {
      fail("private_preview_invalid_entitlement_response");
    }
    if (!isRecord(record.allocation) || !["bool", "max_count", "enum_number", "range", "string"].includes(record.allocation.type)) {
      fail("private_preview_invalid_entitlement_response");
    }
    const validAllocation = (
      (record.allocation.type === "bool" && typeof record.allocation.value === "boolean") ||
      (record.allocation.type === "max_count" && Number.isInteger(record.allocation.value)) ||
      (record.allocation.type === "enum_number" && Array.isArray(record.allocation.value) && record.allocation.value.every(Number.isFinite)) ||
      (record.allocation.type === "range" && isRecord(record.allocation.value) &&
        Number.isInteger(record.allocation.value.min) && Number.isInteger(record.allocation.value.max)) ||
      (record.allocation.type === "string" && typeof record.allocation.value === "string")
    );
    if (!validAllocation) fail("private_preview_invalid_entitlement_response");
    if (identifiers.has(id)) fail("private_preview_invalid_entitlement_response");
    identifiers.add(id);
  }
  return { count: identifiers.size };
}

function accessRedirectIsExpected(response, configuration) {
  if (response.status !== 302) return false;
  const location = response.headers.get("location");
  if (!location) return false;
  let redirect;
  try {
    redirect = new URL(location);
  } catch {
    return false;
  }
  return (
    redirect.protocol === "https:" &&
    !redirect.username &&
    !redirect.password &&
    !redirect.port &&
    !redirect.hash &&
    redirect.hostname === configuration.accessTeamDomain &&
    redirect.pathname.startsWith("/cdn-cgi/access/login/")
  );
}

export async function assertAnonymousDenied(transports, configuration, hostname) {
  const response = await transports.anonymousRequest(hostUrl(hostname));
  await transports.readBody(response);
  if (response.status === 401 || response.status === 403 || accessRedirectIsExpected(response, configuration)) return;
  fail("private_preview_anonymous_access_not_denied");
}

async function responseJson(transports, response, code, expectedStatus = 200) {
  const body = await transports.readBody(response);
  if (response.status !== expectedStatus) fail("private_preview_unexpected_response_status");
  assertNoRedirect(response);
  if (!/^application\/json\b/i.test(response.headers.get("content-type") ?? "")) {
    fail("private_preview_expected_json_response");
  }
  return jsonFromBytes(body, code);
}

export async function assertServiceAuthenticatedExistingPreview(transports, hostname) {
  const version = parseContentVersion(
    await responseJson(
      transports,
      await transports.serviceRequest(hostUrl(hostname, "/content-version.json")),
      "private_preview_invalid_existing_identity"
    )
  );
  if (!contentHashPattern.test(version.contentHash) || !commitShaPattern.test(version.commitSha)) {
    fail("private_preview_invalid_existing_identity");
  }
  const root = await transports.serviceRequest(hostUrl(hostname));
  if (!root.ok || !/text\/html\b/i.test(root.headers.get("content-type") ?? "")) {
    failResponse(root, "private_preview_service_auth_failed");
  }
  await transports.readBody(root);
}

async function collectProviderState(transports, configuration) {
  const project = parsePagesProject(
    await providerEnvelope(
      transports,
      apiUrl(["accounts", configuration.accountId, "pages", "projects", configuration.pagesProject]),
      "pages-project"
    ),
    configuration
  );
  const pages = await listAllPages(
    transports,
    (page) => apiUrl(
      ["accounts", configuration.accountId, "pages", "projects", configuration.pagesProject, "deployments"],
      [["env", "preview"], ["page", page], ["per_page", 50]]
    ),
    "pages-deployments"
  );
  const deploymentIds = new Set();
  const historicalAliases = new Set();
  for (const page of pages) {
    const deployment = parsePagesDeployment(page, configuration, { requireSuccessful: false });
    if (deploymentIds.has(deployment.id)) fail("private_preview_duplicate_deployment");
    deploymentIds.add(deployment.id);
    historicalAliases.add(deployment.hostname);
    for (const alias of deployment.aliases) historicalAliases.add(alias.hostname);
  }
  if (!historicalAliases.size) fail("private_preview_preview_inventory_empty");

  const accountApplications = await listAllPages(
    transports,
    (page) => apiUrl(["accounts", configuration.accountId, "access", "apps"], [["page", page], ["per_page", 50]]),
    "account-access-applications"
  );
  const zoneApplications = await listAllPages(
    transports,
    (page) => apiUrl(["zones", configuration.zoneId, "access", "apps"], [["page", page], ["per_page", 50]]),
    "zone-access-applications"
  );
  const applications = [
    ...accountApplications.map((application) => parseAccessApplication(application, "account")),
    ...zoneApplications.map((application) => parseAccessApplication(application, "zone"))
  ];
  const uniqueApplications = new Map();
  const policyCache = new Map();
  for (const application of applications) {
    const existing = uniqueApplications.get(application.id);
    if (!existing) {
      uniqueApplications.set(application.id, application);
      continue;
    }
    if (existing.scope === application.scope || accessApplicationIdentity(existing) !== accessApplicationIdentity(application)) {
      fail("private_preview_conflicting_access_application");
    }
    const [existingPolicies, duplicatePolicies] = await Promise.all([
      listAccessPolicies(transports, configuration, existing, policyCache),
      listAccessPolicies(transports, configuration, application, policyCache)
    ]);
    if (accessPolicyIdentity(existingPolicies) !== accessPolicyIdentity(duplicatePolicies)) {
      fail("private_preview_conflicting_access_application");
    }
  }
  return {
    project,
    historicalAliases,
    applications: [...uniqueApplications.values()],
    pagesCount: pages.length,
    policyCache
  };
}

function accessApplicationIdentity(application) {
  const destinations = application.destinations.map((destination) => ({
    hostname: destination.hostname,
    path: destination.path,
    overrides: destination.overrides.map((override) => ({
      behavior: override.behavior,
      path_pattern: override.path_pattern
    })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)))
  })).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  return JSON.stringify({ type: application.type, destinations });
}

function accessPolicyIdentity(policies) {
  return JSON.stringify(policies.map((policy) => ({
    id: policy.id,
    decision: policy.decision,
    include: canonicalPolicyConditions(policy.include),
    exclude: canonicalPolicyConditions(policy.exclude),
    require: canonicalPolicyConditions(policy.require)
  })).sort((left, right) => left.id.localeCompare(right.id)));
}

function canonicalPolicyConditions(conditions) {
  return conditions.map((condition) => JSON.stringify(canonicalizePolicyValue(condition))).sort();
}

function canonicalizePolicyValue(value) {
  if (Array.isArray(value)) {
    return value.map(canonicalizePolicyValue).sort((left, right) => JSON.stringify(left).localeCompare(JSON.stringify(right)));
  }
  if (!isRecord(value)) return value;
  return Object.fromEntries(Object.keys(value).sort().map((key) => [key, canonicalizePolicyValue(value[key])]));
}

async function assertDnsMapping(transports, configuration) {
  const result = await listAllPages(
    transports,
    (page) => apiUrl(
      ["zones", configuration.zoneId, "dns_records"],
      [["name.exact", configuration.customHostname], ["type", "CNAME"], ["match", "all"], ["page", page], ["per_page", 50]]
    ),
    "preview-dns-record"
  );
  const expectedTarget = configuration.developHostname;
  const matches = result.filter((record) =>
    isRecord(record) &&
    record.type === "CNAME" &&
    typeof record.name === "string" &&
    typeof record.content === "string" &&
    parseHostname(record.name, "private_preview_invalid_dns_response") === configuration.customHostname &&
    parseHostname(record.content.replace(/\.$/, ""), "private_preview_invalid_dns_response") === expectedTarget &&
    record.proxied === true
  );
  if (matches.length !== 1 || result.length !== 1) fail("private_preview_dns_mapping_invalid");
}

async function assertActiveCustomPagesDomain(transports, configuration) {
  const domain = await providerEnvelope(
    transports,
    apiUrl([
      "accounts",
      configuration.accountId,
      "pages",
      "projects",
      configuration.pagesProject,
      "domains",
      configuration.customHostname
    ]),
    "preview-pages-domain"
  );
  if (
    !isRecord(domain) ||
    parseHostname(domain.name, "private_preview_custom_domain_inactive") !== configuration.customHostname ||
    domain.status !== "active" ||
    domain.validation_data?.status !== "active" ||
    domain.verification_data?.status !== "active"
  ) {
    fail("private_preview_custom_domain_inactive");
  }
}

async function assertPublicProductionReachability(transports, configuration) {
  for (const hostname of [configuration.pagesDomain, ...expectedPublicHostnames]) {
    const response = await transports.anonymousRequest(hostUrl(hostname));
    if (!response.ok || !/text\/html\b/i.test(response.headers.get("content-type") ?? "")) {
      failResponse(response, "private_preview_production_not_publicly_reachable");
    }
    await transports.readBody(response);
  }
}

async function assertProviderPreflight(transports, configuration, state) {
  const organization = await providerEnvelope(
    transports,
    apiUrl(["accounts", configuration.accountId, "access", "organizations"]),
    "access-organization"
  );
  parseStrictServiceTokenSetting(organization, configuration);
  await assertDnsMapping(transports, configuration);
  await assertActiveCustomPagesDomain(transports, configuration);
  await assertPublicProductionReachability(transports, configuration);

  const protectedHosts = new Set([
    ...state.historicalAliases,
    configuration.developHostname,
    configuration.customHostname
  ]);
  const policyCache = state.policyCache;
  await assertFuturePagesHashCoverage(transports, configuration, state.applications, policyCache);
  for (const hostname of protectedHosts) {
    await assertAccessCoverage(transports, configuration, state.applications, hostname, policyCache);
  }
  for (const hostname of protectedHosts) await assertAnonymousDenied(transports, configuration, hostname);

  const entitlementResult = await providerEnvelope(
    transports,
    apiUrl(["accounts", configuration.accountId, "entitlements"]),
    "account-entitlements"
  );
  const entitlement = parseEntitlementEvidence(entitlementResult);
  await transports.bindEvidence();
  return { protectedHosts, entitlement };
}

async function verifyLocalArtifact(artifactDirectory, expectedContentHash, expectedCommitSha) {
  if (!contentHashPattern.test(expectedContentHash)) fail("private_preview_invalid_content_hash");
  if (!commitShaPattern.test(expectedCommitSha)) fail("private_preview_invalid_candidate_sha");
  await verifyArtifactManifest(artifactDirectory, expectedCommitSha);
  const version = await readContentVersion(path.join(artifactDirectory, "content-version.json"));
  if (version.contentHash !== expectedContentHash || version.commitSha !== expectedCommitSha) {
    fail("private_preview_local_artifact_identity_mismatch");
  }
  const [manifestSource, indexHtml, robotsText, sitemapText] = await Promise.all([
    readFile(path.join(artifactDirectory, artifactManifestFileName), "utf8"),
    readFile(path.join(artifactDirectory, "index.html")),
    readFile(path.join(artifactDirectory, "robots.txt"), "utf8"),
    readFile(path.join(artifactDirectory, "sitemap.xml"), "utf8")
  ]);
  return {
    manifest: JSON.parse(manifestSource),
    indexHtmlHash: hashBytes(indexHtml),
    robotsText,
    sitemapText
  };
}

export async function runPrivatePreviewPreflight({
  artifactDirectory,
  expectedContentHash,
  expectedCommitSha,
  configuration,
  transports
}) {
  await verifyLocalArtifact(artifactDirectory, expectedContentHash, expectedCommitSha);
  const state = await collectProviderState(transports, configuration);
  const preflight = await assertProviderPreflight(transports, configuration, state);
  for (const hostname of [configuration.developHostname, configuration.customHostname]) {
    await assertServiceAuthenticatedExistingPreview(transports, hostname);
  }
  return {
    status: "activation_blocked",
    reason: "entitlement_mapping_unreviewed",
    inventoryCount: state.pagesCount,
    protectedHostCount: preflight.protectedHosts.size,
    entitlementCount: preflight.entitlement.count
  };
}

async function assertExactCandidateHost(transports, hostname, localArtifact, expectedContentHash, expectedCommitSha) {
  const version = parseContentVersion(
    await responseJson(
      transports,
      await transports.serviceRequest(hostUrl(hostname, "/content-version.json")),
      "private_preview_invalid_candidate_identity"
    )
  );
  if (version.contentHash !== expectedContentHash || version.commitSha !== expectedCommitSha) {
    fail("private_preview_candidate_identity_mismatch");
  }
  const manifest = await responseJson(
    transports,
    await transports.serviceRequest(hostUrl(hostname, `/${artifactManifestFileName}`)),
    "private_preview_invalid_candidate_manifest"
  );
  if (JSON.stringify(manifest) !== JSON.stringify(localArtifact.manifest)) {
    fail("private_preview_candidate_manifest_mismatch");
  }
  const root = await transports.serviceRequest(hostUrl(hostname));
  if (!root.ok || !/text\/html\b/i.test(root.headers.get("content-type") ?? "")) {
    failResponse(root, "private_preview_candidate_static_content_missing");
  }
  const rootBytes = await transports.readBody(root);
  if (hashBytes(rootBytes) !== localArtifact.indexHtmlHash) fail("private_preview_candidate_static_content_mismatch");
  requireDeploymentInvariant(
    () => assertCanonicalHomepageHtml(decodeUtf8(rootBytes, "private_preview_candidate_static_content_mismatch")),
    "private_preview_candidate_canonical_mismatch"
  );
  for (const [endpoint, expectedText, mediaType] of [
    ["/robots.txt", localArtifact.robotsText, /^text\/plain\b/i],
    ["/sitemap.xml", localArtifact.sitemapText, /^(?:application|text)\/(?:xml|[a-z0-9!#$&^_.+-]+\+xml)(?:\s*;|$)/i]
  ]) {
    const response = await transports.serviceRequest(hostUrl(hostname, endpoint));
    if (!response.ok) failResponse(response, "private_preview_candidate_static_content_missing");
    const text = decodeUtf8(await transports.readBody(response), "private_preview_candidate_static_content_mismatch");
    requireDeploymentInvariant(
      () => assertExactDeploymentText({ contentType: response.headers.get("content-type"), body: text }, expectedText, mediaType, endpoint),
      "private_preview_candidate_static_content_mismatch"
    );
  }
  for (const endpoint of ["/api/contact/verify", "/api/contact"]) {
    const response = await transports.serviceRequest(hostUrl(hostname, endpoint));
    if (response.status !== 405) failResponse(response, "private_preview_service_auth_failed");
    const body = await responseJson(transports, response, "private_preview_service_auth_failed", 405);
    requireDeploymentInvariant(
      () => assertMethodNotAllowedResponse(response.status, response.headers.get("content-type"), body, endpoint.slice(1)),
      "private_preview_service_auth_failed"
    );
  }
}

export async function verifyPrivatePreviewUpload({
  artifactDirectory,
  expectedContentHash,
  expectedCommitSha,
  wranglerOutputPath,
  configuration,
  transports
}) {
  const localArtifact = await verifyLocalArtifact(artifactDirectory, expectedContentHash, expectedCommitSha);
  const output = await readFile(wranglerOutputPath, "utf8");
  const wranglerDeployment = parseWranglerPagesDeployOutput(output, configuration, expectedCommitSha);
  const apiDeployment = parsePagesDeployment(
    await providerEnvelope(
      transports,
      apiUrl([
        "accounts",
        configuration.accountId,
        "pages",
        "projects",
        configuration.pagesProject,
        "deployments",
        wranglerDeployment.id
      ]),
      "uploaded-pages-deployment"
    ),
    configuration,
    { expectedDeploymentId: wranglerDeployment.id, expectedCommitSha, expectedBranch: "develop" }
  );
  if (apiDeployment.url !== wranglerDeployment.url) fail("private_preview_deployment_identity_mismatch");
  const postUploadState = await collectProviderState(transports, configuration);
  const postUploadPreflight = await assertProviderPreflight(transports, configuration, postUploadState);
  if (!postUploadPreflight.protectedHosts.has(wranglerDeployment.hostname)) {
    fail("private_preview_uploaded_deployment_missing_from_inventory");
  }
  transports.allowServiceHost(wranglerDeployment.hostname);
  const aliases = new Set(apiDeployment.aliases.map((alias) => alias.hostname));
  if (!aliases.has(configuration.developHostname)) fail("private_preview_develop_alias_missing");
  const hosts = new Set([wranglerDeployment.hostname, configuration.developHostname, configuration.customHostname]);
  for (const hostname of hosts) {
    await assertExactCandidateHost(transports, hostname, localArtifact, expectedContentHash, expectedCommitSha);
  }
  await transports.bindEvidence();
  return { status: "verified", hostCount: hosts.size };
}

async function runCli() {
  const [command, artifactDirectory, expectedContentHash, expectedCommitSha, wranglerOutputPath] = process.argv.slice(2);
  const configuration = createPrivatePreviewConfiguration();
  const transports = createPrivatePreviewTransports({ configuration });
  if (command === "preflight" && !wranglerOutputPath) {
    const result = await runPrivatePreviewPreflight({
      artifactDirectory,
      expectedContentHash,
      expectedCommitSha,
      configuration,
      transports
    });
    console.log(
      `private-preview status=${result.status} reason=${result.reason} inventory=${result.inventoryCount} hosts=${result.protectedHostCount} entitlements=${result.entitlementCount}`
    );
    fail("private_preview_activation_blocked");
  }
  if (command === "verify-upload" && wranglerOutputPath) {
    const result = await verifyPrivatePreviewUpload({
      artifactDirectory,
      expectedContentHash,
      expectedCommitSha,
      wranglerOutputPath,
      configuration,
      transports
    });
    console.log(`private-preview status=${result.status} hosts=${result.hostCount}`);
    return;
  }
  fail("private_preview_usage");
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli().catch((error) => {
    console.error(error instanceof PrivatePreviewCheckError ? error.code : "private_preview_failed");
    process.exitCode = 1;
  });
}
