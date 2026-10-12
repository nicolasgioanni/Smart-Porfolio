import { createHash } from "node:crypto";
import { execFile, spawn } from "node:child_process";
import { chmod, mkdir, mkdtemp, readFile, rename, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const execFileAsync = promisify(execFile);
const manifestPath = new URL("./pinnedTools.json", import.meta.url);
const payloadWriterPath = fileURLToPath(new URL("./writePinnedPayload.mjs", import.meta.url));
const digestPattern = /^[a-f0-9]{64}$/;

function validateTool(name, descriptor) {
  if (!/^[a-z0-9-]+$/.test(name) || !descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) {
    throw new Error("Pinned tool manifest is malformed.");
  }
  const expectedKeys = ["archive", "executable", "sha256", "url"];
  if (Object.keys(descriptor).sort().join(",") !== expectedKeys.join(",")) throw new Error(`Pinned tool ${name} has unsupported fields.`);
  const url = new URL(descriptor.url);
  if (url.protocol !== "https:" || !["github.com", "releases.hashicorp.com"].includes(url.hostname) || !url.pathname.startsWith("/") || url.search || url.hash) {
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

export async function downloadPinnedTool(descriptor, fetchImpl = globalThis.fetch) {
  if (typeof fetchImpl !== "function") throw new Error("Pinned tool installer requires fetch.");
  const response = await fetchImpl(descriptor.url, { redirect: "follow", signal: AbortSignal.timeout(30_000) });
  if (!response?.ok) throw new Error(`Pinned tool download failed with HTTP ${response?.status ?? "unknown"}.`);
  const finalUrl = new URL(response.url || descriptor.url);
  if (finalUrl.protocol !== "https:") throw new Error("Pinned tool download redirected outside HTTPS.");
  const body = Buffer.from(await response.arrayBuffer());
  if (body.length === 0 || body.length > 100 * 1024 * 1024) throw new Error("Pinned tool download has an invalid size.");
  if (sha256(body) !== descriptor.sha256) throw new Error("Pinned tool download digest does not match the committed manifest.");
  return body;
}

async function writeVerifiedPayload(destination, payload) {
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (error) => {
      if (settled) return;
      settled = true;
      if (error) reject(error);
      else resolve();
    };
    const writer = spawn(process.execPath, [payloadWriterPath, destination], {
      stdio: ["pipe", "ignore", "ignore"]
    });
    writer.once("error", () => finish(new Error("Pinned payload writer could not start.")));
    writer.stdin.once("error", () => finish(new Error("Pinned payload writer could not receive verified bytes.")));
    writer.once("close", (code) => finish(code === 0 ? undefined : new Error("Pinned payload writer rejected verified bytes.")));
    writer.stdin.end(payload);
  });
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
