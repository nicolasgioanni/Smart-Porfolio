import { pagesDomain, pagesProjectName } from "./releaseEnvelope.mjs";
import { fileURLToPath } from "node:url";

const cloudflareApiOrigin = "https://api.cloudflare.com/client/v4";
const accountIdPattern = /^[a-f0-9]{32}$/i;
const maxResponseBytes = 32 * 1024;
const operationTimeoutMs = 10_000;

function preflightFailure() {
  return new Error("Cloudflare Pages preflight rejected the reviewed deployment target");
}

function cancelReader(reader) {
  try {
    void Promise.resolve(reader.cancel()).catch(() => undefined);
  } catch {
    // The bounded operation has already failed; a late cleanup error is not diagnostic output.
  }
}

async function readBoundedBody(response, registerReader) {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxResponseBytes) throw preflightFailure();
  if (!response.body) throw preflightFailure();
  const reader = response.body.getReader();
  registerReader(reader);
  const chunks = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > maxResponseBytes) {
        cancelReader(reader);
        throw preflightFailure();
      }
      chunks.push(value);
    }
  } catch (error) {
    if (error instanceof Error && error.message === "Cloudflare Pages preflight rejected the reviewed deployment target") {
      throw error;
    }
    throw preflightFailure();
  }
  return new TextDecoder().decode(Buffer.concat(chunks));
}

function parseProject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw preflightFailure();
  const result = value.result;
  if (value.success !== true || !result || typeof result !== "object" || Array.isArray(result)) throw preflightFailure();
  if (
    result.name !== pagesProjectName ||
    result.subdomain !== pagesDomain ||
    result.production_branch !== "main"
  ) {
    throw preflightFailure();
  }
  return { name: result.name, subdomain: result.subdomain, productionBranch: result.production_branch };
}

export async function verifyCloudflarePagesProject({ accountId, apiToken, fetcher = fetch }) {
  if (typeof accountId !== "string" || !accountIdPattern.test(accountId) ||
      typeof apiToken !== "string" || apiToken.length === 0) {
    throw preflightFailure();
  }

  const controller = new AbortController();
  let reader;
  let deadlineExpired = false;
  let timeoutId;
  const operation = (async () => {
    const response = await fetcher(
      `${cloudflareApiOrigin}/accounts/${accountId}/pages/projects/${pagesProjectName}`,
      {
        method: "GET",
        headers: { Accept: "application/json", Authorization: `Bearer ${apiToken}` },
        redirect: "manual",
        signal: controller.signal
      }
    );
    if (!response || !response.ok || response.status >= 300 && response.status < 400) throw preflightFailure();
    const body = await readBoundedBody(response, (nextReader) => {
      reader = nextReader;
      if (deadlineExpired) cancelReader(nextReader);
    });
    return JSON.parse(body);
  })();
  const deadline = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      deadlineExpired = true;
      controller.abort();
      if (reader) cancelReader(reader);
      reject(preflightFailure());
    }, operationTimeoutMs);
  });

  try {
    return parseProject(await Promise.race([operation, deadline]));
  } catch {
    throw preflightFailure();
  } finally {
    clearTimeout(timeoutId);
    void operation.catch(() => undefined);
  }
}

async function runCli() {
  await verifyCloudflarePagesProject({
    accountId: process.env.CLOUDFLARE_ACCOUNT_ID,
    apiToken: process.env.CLOUDFLARE_API_TOKEN
  });
  console.log("Cloudflare Pages deployment target is valid.");
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  runCli().catch(() => {
    console.error("Cloudflare Pages preflight rejected the reviewed deployment target");
    process.exitCode = 1;
  });
}
