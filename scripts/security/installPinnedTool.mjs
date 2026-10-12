import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { constants } from "node:fs";
import { chmod, mkdir, mkdtemp, open, readFile, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const manifestPath = new URL("./pinnedTools.json", import.meta.url);
const digestPattern = /^[a-f0-9]{64}$/;
const maximumPayloadBytes = 100 * 1024 * 1024;
const downloadTimeoutMs = 30_000;
const pinnedToolHosts = new Set(["github.com", "releases.hashicorp.com"]);
const githubReleaseAssetHosts = new Set(["objects.githubusercontent.com", "release-assets.githubusercontent.com"]);

function parsePinnedToolUrl(value, errorMessage) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(errorMessage);
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.pathname.startsWith("/")) {
    throw new Error(errorMessage);
  }
  return url;
}

function pinnedToolSourceUrl(value) {
  const url = parsePinnedToolUrl(value, "Pinned tool does not use an approved HTTPS source.");
  if (!pinnedToolHosts.has(url.hostname) || url.search || url.hash) {
    throw new Error("Pinned tool does not use an approved HTTPS source.");
  }
  if (url.hostname === "github.com" && !/^\/[^/]+\/[^/]+\/releases\/download\/[^/]+\/[^/]+$/.test(url.pathname)) {
    throw new Error("Pinned tool does not use an approved HTTPS source.");
  }
  return url;
}

function pinnedToolRedirectUrl(sourceUrl, value) {
  const url = parsePinnedToolUrl(value, "Pinned tool redirected outside its approved download hosts.");
  const isGithubReleaseAsset = sourceUrl.hostname === "github.com" && githubReleaseAssetHosts.has(url.hostname);
  const isHashicorpRedirect = sourceUrl.hostname === "releases.hashicorp.com" && url.hostname === "releases.hashicorp.com";
  if (!isGithubReleaseAsset && !isHashicorpRedirect) {
    throw new Error("Pinned tool redirected outside its approved download hosts.");
  }
  return url;
}

function validateTool(name, descriptor) {
  if (!/^[a-z0-9-]+$/.test(name) || !descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error("Pinned tool manifest is malformed.");
  }
  const expectedKeys = ["archive", "executable", "sha256", "url"];
  if (Object.keys(descriptor).sort().join(",") !== expectedKeys.join(",")) throw new Error(`Pinned tool ${name} has unsupported fields.`);
  let url;
  try {
    url = pinnedToolSourceUrl(descriptor.url);
  } catch {
    throw new Error(`Pinned tool ${name} does not use an approved HTTPS source.`);
  }
  if (!digestPattern.test(descriptor.sha256) || !["raw", "tar.gz", "zip"].includes(descriptor.archive) || !/^[A-Za-z0-9_.-]+$/.test(descriptor.executable)) {
    throw new Error(`Pinned tool ${name} is malformed.`);
  }
  return { ...descriptor, url: url.toString() };
}

export async function readPinnedTools() {
  const document = JSON.parse(await readFile(manifestPath, "utf8"));
  if (document?.schemaVersion !== 1 || !document.tools || typeof document.tools !== "object" || Array.isArray(document.tools)) {
    throw new Error("Pinned tool manifest is malformed.");
  }
  return Object.fromEntries(Object.entries(document.tools).map(([name, descriptor]) => [name, validateTool(name, descriptor)]));
}

export function sha256(body) {
  return createHash("sha256").update(body).digest("hex");
}

function responseHeader(response, name) {
  return typeof response?.headers?.get === "function" ? response.headers.get(name) : null;
}

function isRedirect(response) {
  return [301, 302, 303, 307, 308].includes(response?.status);
}

function cancelResponseBody(response) {
  if (typeof response?.body?.cancel === "function") {
    void response.body.cancel().catch(() => {});
  }
}

function remainingDownloadTime(deadline, controller) {
  const remaining = deadline - Date.now();
  if (remaining <= 0) {
    controller.abort();
    throw new Error("Pinned tool download timed out.");
  }
  return remaining;
}

async function beforeDownloadDeadline(operation, deadline, controller) {
  const remaining = remainingDownloadTime(deadline, controller);
  return new Promise((resolve, reject) => {
    let finished = false;
    const finish = (callback, value) => {
      if (finished) return;
      finished = true;
      clearTimeout(timeout);
      callback(value);
    };
    const timeout = setTimeout(() => {
      controller.abort();
      finish(reject, new Error("Pinned tool download timed out."));
    }, remaining);
    Promise.resolve(operation).then((value) => finish(resolve, value), (error) => finish(reject, error));
  });
}

async function readBoundedResponseBody(response, deadline, controller, maximumBytes) {
  if (!response?.body || typeof response.body.getReader !== "function") {
    throw new Error("Pinned tool download did not include a readable body.");
  }
  const contentLength = responseHeader(response, "content-length");
  if (contentLength && /^\d+$/.test(contentLength) && Number(contentLength) > maximumBytes) {
    cancelResponseBody(response);
    throw new Error("Pinned tool download has an invalid size.");
  }

  const reader = response.body.getReader();
  const chunks = [];
  let bytesRead = 0;
  let completed = false;
  try {
    for (;;) {
      const next = await beforeDownloadDeadline(reader.read(), deadline, controller);
      if (next.done) {
        completed = true;
        break;
      }
      const chunk = Buffer.from(next.value);
      bytesRead += chunk.length;
      if (bytesRead > maximumBytes) throw new Error("Pinned tool download has an invalid size.");
      chunks.push(chunk);
    }
  } finally {
    if (!completed) void reader.cancel().catch(() => {});
    try {
      reader.releaseLock();
    } catch {
      // A read that is being cancelled can retain the lock until it settles.
    }
  }
  if (bytesRead === 0) throw new Error("Pinned tool download has an invalid size.");
  return Buffer.concat(chunks);
}

export async function downloadPinnedTool(descriptor, fetchImpl = globalThis.fetch, { timeoutMs = downloadTimeoutMs, maximumBytes = maximumPayloadBytes } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("Pinned tool installer requires fetch.");
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0 || !Number.isSafeInteger(maximumBytes) || maximumBytes <= 0) {
    throw new Error("Pinned tool download limits are invalid.");
  }
  const controller = new AbortController();
  const deadline = Date.now() + timeoutMs;
  let currentUrl = pinnedToolSourceUrl(descriptor.url);
  let followedRedirect = false;
  let response;
  for (;;) {
    response = await beforeDownloadDeadline(fetchImpl(currentUrl.toString(), { redirect: "manual", signal: controller.signal }), deadline, controller);
    if (!isRedirect(response)) break;
    cancelResponseBody(response);
    if (followedRedirect) throw new Error("Pinned tool download used too many redirects.");
    const location = responseHeader(response, "location");
    if (!location) throw new Error("Pinned tool download redirected without a location.");
    let redirectLocation;
    try {
      redirectLocation = new URL(location, currentUrl).toString();
    } catch {
      throw new Error("Pinned tool download redirected without a valid location.");
    }
    currentUrl = pinnedToolRedirectUrl(currentUrl, redirectLocation);
    followedRedirect = true;
  }
  if (!response?.ok) throw new Error(`Pinned tool download failed with HTTP ${response?.status ?? "unknown"}.`);
  const body = await readBoundedResponseBody(response, deadline, controller, maximumBytes);
  if (sha256(body) !== descriptor.sha256) throw new Error("Pinned tool download digest does not match the committed manifest.");
  return body;
}

export async function writeVerifiedPayload(destination, payload) {
  const handle = await open(destination, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | (constants.O_NOFOLLOW ?? 0), 0o600);
  let completed = false;
  try {
    let offset = 0;
    while (offset < payload.length) {
      const { bytesWritten } = await handle.write(payload, offset, payload.length - offset, offset);
      if (bytesWritten <= 0) throw new Error("Pinned payload could not be written.");
      offset += bytesWritten;
    }
    await handle.sync();
    completed = true;
  } finally {
    await handle.close();
    if (!completed) await rm(destination, { force: true });
  }
}

export async function installPinnedTool(name, destination, { fetchImpl, commandRunner = execFileAsync, readTools = readPinnedTools } = {}) {
  const tools = await readTools();
  const descriptor = tools[name];
  if (!descriptor) throw new Error(`Unknown pinned tool: ${name}.`);
  const root = path.resolve(destination);
  if (!path.isAbsolute(root) || root === path.parse(root).root) throw new Error("Pinned tool destination must be a dedicated absolute directory.");
  const payload = await downloadPinnedTool(descriptor, fetchImpl);
  const staging = await mkdtemp(path.join(os.tmpdir(), `smart-portfolio-${name}-`));
  try {
    const payloadPath = path.join(staging, "download");
    await writeVerifiedPayload(payloadPath, payload);
    const installRoot = path.join(staging, "install");
    await mkdir(installRoot);
    if (descriptor.archive === "tar.gz") {
      await commandRunner("tar", ["-xzf", payloadPath, "-C", installRoot, "--no-same-owner", "--no-same-permissions"]);
    } else if (descriptor.archive === "zip") {
      await commandRunner("unzip", ["-q", payloadPath, "-d", installRoot]);
    } else {
      await rename(payloadPath, path.join(installRoot, descriptor.executable));
    }
    const executable = path.join(installRoot, descriptor.executable);
    const executableBytes = await readFile(executable).catch(() => null);
    if (!executableBytes?.length) throw new Error(`Pinned tool archive did not contain ${descriptor.executable}.`);
    await chmod(executable, 0o700);
    await mkdir(root, { recursive: true });
    const target = path.join(root, name);
    await rm(target, { force: true, recursive: true });
    await commandRunner("mv", [installRoot, target]);
    return path.join(target, descriptor.executable);
  } finally {
    await rm(staging, { force: true, recursive: true });
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const [name, destination] = process.argv.slice(2);
  if (!name || !destination || process.argv.length !== 4) {
    console.error("Usage: node scripts/security/installPinnedTool.mjs <tool> <absolute-destination>");
    process.exitCode = 1;
  } else {
    try {
      console.log(await installPinnedTool(name, destination));
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    }
  }
}
