import {
  reviewedPagesDomain,
  reviewedPagesProductionBranch,
  reviewedPagesProjectName
} from "./deployedIdentity.mjs";

const cloudflareApiOrigin = "https://api.cloudflare.com/client/v4";
const accountIdPattern = /^[a-f0-9]{32}$/i;
const maxResponseBytes = 32 * 1024;
const operationTimeoutMs = 10_000;

function preflightFailure() {
  return new Error("Cloudflare Pages preflight rejected the reviewed deployment target.");
}

function cancelReader(reader) {
  try {
    void Promise.resolve(reader.cancel()).catch(() => undefined);
  } catch {
    // The caller has already failed. A stalled provider cleanup must not delay it.
  }
}

function rejectResponse(response) {
  try {
    void response?.body?.cancel().catch(() => undefined);
  } catch {
    // The provider response is only best-effort cleanup after a rejected target.
  }
  throw preflightFailure();
}

async function readBoundedJson(response, registerReader) {
  const declaredLength = response.headers?.get("content-length");
  if (declaredLength !== null && declaredLength !== undefined &&
      (!/^(?:0|[1-9][0-9]*)$/.test(declaredLength) || Number(declaredLength) > maxResponseBytes)) {
    rejectResponse(response);
  }
  if (!response.body || typeof response.body.getReader !== "function") rejectResponse(response);

  let reader;
  let completed = false;
  const chunks = [];
  let length = 0;
  try {
    reader = response.body.getReader();
    registerReader(reader);
    for (;;) {
      const item = await reader.read();
      if (!item || typeof item.done !== "boolean") throw preflightFailure();
      if (item.done) {
        completed = true;
        break;
      }
      if (Object.prototype.toString.call(item.value) !== "[object Uint8Array]") throw preflightFailure();
      length += item.value.byteLength;
      if (length > maxResponseBytes) throw preflightFailure();
      chunks.push(item.value);
    }
    return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)));
  } catch {
    throw preflightFailure();
  } finally {
    if (reader && !completed) cancelReader(reader);
  }
}

function parseProject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw preflightFailure();
  const result = value.result;
  if (value.success !== true || !Array.isArray(value.errors) || value.errors.length !== 0 ||
      !result || typeof result !== "object" || Array.isArray(result) ||
      result.name !== reviewedPagesProjectName || result.subdomain !== reviewedPagesDomain ||
      result.production_branch !== reviewedPagesProductionBranch ||
      (Object.hasOwn(result, "source") && result.source !== null && result.source !== undefined)) {
    throw preflightFailure();
  }
  return {
    name: result.name,
    subdomain: result.subdomain,
    productionBranch: result.production_branch,
    source: "direct-upload"
  };
}

/**
 * Verifies the one reviewed Direct Upload project before a deployment can
 * mutate D1 or ask Wrangler to upload. All provider failures deliberately
 * collapse to one credential-safe diagnostic.
 */
export async function cloudflareReadJson(apiPath, { accountId, apiToken, fetcher = fetch }) {
  if (typeof accountId !== "string" || !accountIdPattern.test(accountId) ||
      typeof apiToken !== "string" || apiToken.trim().length === 0) {
    throw preflightFailure();
  }

  const controller = new AbortController();
  let reader;
  let deadlineExpired = false;
  let timeoutId;
  const operation = Promise.resolve().then(async () => {
    const response = await fetcher(
      `${cloudflareApiOrigin}${apiPath}`,
      {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
        redirect: "manual",
        signal: controller.signal
      }
    );
    if (!response || response.status !== 200 || !/^application\/json\b/i.test(response.headers?.get("content-type") ?? "")) {
      rejectResponse(response);
    }
    return readBoundedJson(response, (nextReader) => {
      reader = nextReader;
      if (deadlineExpired) cancelReader(nextReader);
    });
  });
  const deadline = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      deadlineExpired = true;
      controller.abort();
      if (reader) cancelReader(reader);
      reject(preflightFailure());
    }, operationTimeoutMs);
  });

  try {
    const value = await Promise.race([operation, deadline]);
    if (!value || value.success !== true || !Array.isArray(value.errors) || value.errors.length !== 0) throw preflightFailure();
    return value;
  } catch {
    throw preflightFailure();
  } finally {
    clearTimeout(timeoutId);
    void operation.catch(() => undefined);
  }
}

export async function verifyCloudflarePagesProject({ accountId, apiToken, fetcher = fetch }) {
  return parseProject(await cloudflareReadJson(`/accounts/${accountId}/pages/projects/${reviewedPagesProjectName}`, { accountId, apiToken, fetcher }));
}

// A smoke-only retry must prove which immutable deployment currently owns the
// branch alias. Refuse incomplete or ambiguous provider inventories.
export async function findCurrentPreviewDeployment({ accountId, apiToken, sourceSha, fetcher = fetch }) {
  if (!/^[a-f0-9]{40}$/.test(sourceSha)) throw preflightFailure();
  const value = await cloudflareReadJson(`/accounts/${accountId}/pages/projects/${reviewedPagesProjectName}/deployments?env=preview&per_page=100`, { accountId, apiToken, fetcher });
  const info = value.result_info;
  if (!Array.isArray(value.result) || !info || info.page !== 1 || info.total_pages > 1 ||
      info.total_count !== value.result.length || info.count !== value.result.length) throw preflightFailure();
  const matches = value.result.filter((item) => Array.isArray(item.aliases) && item.aliases.includes(`https://develop.${reviewedPagesDomain}`));
  if (matches.length !== 1) throw preflightFailure();
  const item = matches[0];
  if (item.project_name !== reviewedPagesProjectName || item.environment !== "preview" || item.is_skipped !== false ||
      item.latest_stage?.name !== "deploy" || item.latest_stage?.status !== "success" ||
      item.deployment_trigger?.metadata?.branch !== "develop" || item.deployment_trigger?.metadata?.commit_dirty !== false ||
      item.deployment_trigger?.metadata?.commit_hash !== sourceSha ||
      !/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/.test(item.id) ||
      item.url !== `https://${item.id.slice(0, 8)}.${reviewedPagesDomain}`) throw preflightFailure();
  return item.url;
}
