import { spawn } from "node:child_process";
import { constants, createWriteStream } from "node:fs";
import { access, chmod, mkdir, mkdtemp, open, readFile, readdir, realpath, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { finished } from "node:stream/promises";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const policyPath = path.join(projectRoot, "scripts", "security", "scanner-suppressions.json");
const scannerTools = new Set(["gitleaks", "zizmor"]);
const findingExitCodes = new Set([11, 12, 13, 14]);
const maxReportBytes = 10 * 1024 * 1024;

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function requireExactKeys(value, keys, message) {
  if (!isObject(value) || Object.keys(value).sort().join(",") !== [...keys].sort().join(",")) throw new Error(message);
}

function parseExpiry(value, now) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error("Scanner suppression expiry is invalid.");
  const [year, month, day] = value.split("-").map(Number);
  const start = Date.UTC(year, month - 1, day);
  if (new Date(start).getUTCFullYear() !== year || new Date(start).getUTCMonth() !== month - 1 || new Date(start).getUTCDate() !== day) {
    throw new Error("Scanner suppression expiry is invalid.");
  }
  if (now.getTime() >= start + 24 * 60 * 60 * 1000) throw new Error("Scanner suppression has expired.");
}

function validateReason(value) {
  if (typeof value !== "string" || value.trim().length < 12 || value.length > 500) throw new Error("Scanner suppression reason is invalid.");
}

export function validateScannerSuppressions(policy, { now = new Date() } = {}) {
  requireExactKeys(policy, ["schemaVersion", "suppressions"], "Scanner suppression policy is malformed.");
  if (policy.schemaVersion !== 1 || !Array.isArray(policy.suppressions)) throw new Error("Scanner suppression policy is malformed.");
  const seen = new Set();
  const suppressions = policy.suppressions.map((entry) => {
    if (!isObject(entry) || !scannerTools.has(entry.tool)) throw new Error("Scanner suppression is malformed.");
    validateReason(entry.reason);
    parseExpiry(entry.expiresOn, now);
    if (entry.tool === "gitleaks") {
      requireExactKeys(entry, ["expiresOn", "fingerprint", "reason", "tool"], "Gitleaks suppression is malformed.");
      if (typeof entry.fingerprint !== "string" || !/^[A-Za-z0-9][A-Za-z0-9_.:/@-]{8,512}$/.test(entry.fingerprint)) throw new Error("Gitleaks suppression fingerprint is invalid.");
      const key = `gitleaks:${entry.fingerprint}`;
      if (seen.has(key)) throw new Error("Scanner suppression is duplicated.");
      seen.add(key);
      return { ...entry };
    }
    requireExactKeys(entry, ["expiresOn", "reason", "rule", "selector", "tool"], "zizmor suppression is malformed.");
    if (typeof entry.rule !== "string" || !/^[a-z][a-z0-9-]{1,100}$/.test(entry.rule)) throw new Error("zizmor suppression rule is invalid.");
    if (typeof entry.selector !== "string" || !/^[A-Za-z0-9_.-]+\.ya?ml(?::[1-9]\d*(?::[1-9]\d*)?)?$/.test(entry.selector)) throw new Error("zizmor suppression selector is invalid.");
    const key = `zizmor:${entry.rule}:${entry.selector}`;
    if (seen.has(key)) throw new Error("Scanner suppression is duplicated.");
    seen.add(key);
    return { ...entry };
  });
  return suppressions;
}

export async function readScannerSuppressions(pathname = policyPath, options) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(pathname, "utf8"));
  } catch {
    throw new Error("Scanner suppression policy is unavailable or malformed.");
  }
  return validateScannerSuppressions(parsed, options);
}

async function pathExists(pathname) {
  try {
    await access(pathname);
    return true;
  } catch {
    return false;
  }
}

async function workflowFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true }).catch(() => []);
  const files = [];
  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await workflowFiles(entryPath));
    else if (entry.isFile() && /\.ya?ml$/i.test(entry.name)) files.push(entryPath);
  }
  return files;
}

async function readBoundedRegularFile(pathname, maximumBytes) {
  let handle;
  try {
    handle = await open(pathname, constants.O_RDONLY | (constants.O_NOFOLLOW ?? 0));
    const metadata = await handle.stat();
    if (!metadata.isFile() || metadata.size > maximumBytes) throw new Error("invalid");
    const chunks = [];
    const buffer = Buffer.allocUnsafe(64 * 1024);
    let bytesReadTotal = 0;
    for (;;) {
      const { bytesRead } = await handle.read(buffer, 0, Math.min(buffer.length, maximumBytes + 1 - bytesReadTotal), bytesReadTotal);
      if (bytesRead === 0) break;
      bytesReadTotal += bytesRead;
      if (bytesReadTotal > maximumBytes) throw new Error("invalid");
      chunks.push(Buffer.from(buffer.subarray(0, bytesRead)));
    }
    return Buffer.concat(chunks);
  } finally {
    await handle?.close().catch(() => {});
  }
}

export async function assertNoUnmanagedSuppressions(root = projectRoot) {
  for (const pathname of [
    path.join(root, ".gitleaksignore"),
    path.join(root, ".gitleaks.toml"),
    path.join(root, "zizmor.yml"),
    path.join(root, "zizmor.yaml"),
    path.join(root, ".github", "zizmor.yml"),
    path.join(root, ".github", "zizmor.yaml"),
  ]) {
    if (await pathExists(pathname)) throw new Error("Repository contains an unmanaged scanner suppression source.");
  }
  for (const pathname of await workflowFiles(path.join(root, ".github"))) {
    let source;
    try {
      source = new TextDecoder("utf-8", { fatal: true }).decode(await readBoundedRegularFile(pathname, 1024 * 1024));
    } catch {
      throw new Error("Workflow scanner input is invalid.");
    }
    if (/gitleaks\s*:\s*allow|zizmor\s*:\s*ignore\s*\[/i.test(source)) {
      throw new Error("Repository contains an unmanaged inline scanner suppression.");
    }
  }
}

async function writePrivate(pathname, value) {
  await writeFile(pathname, value, { encoding: "utf8", mode: 0o600, flag: "wx" });
}

async function writeSuppressionInputs(directory, suppressions) {
  const gitleaksIgnore = path.join(directory, ".gitleaksignore");
  const gitleaksConfig = path.join(directory, "gitleaks.toml");
  const zizmorConfig = path.join(directory, "zizmor.yml");
  const gitleaks = suppressions.filter((entry) => entry.tool === "gitleaks");
  const zizmor = suppressions.filter((entry) => entry.tool === "zizmor");
  await writePrivate(gitleaksIgnore, `${gitleaks.map((entry) => entry.fingerprint).join("\n")}${gitleaks.length ? "\n" : ""}`);
  await writePrivate(gitleaksConfig, "title = \"Smart Portfolio generated scan policy\"\n[extend]\nuseDefault = true\n");
  if (zizmor.length) {
    const rules = new Map();
    for (const entry of zizmor) rules.set(entry.rule, [...(rules.get(entry.rule) ?? []), entry.selector]);
    const yaml = ["rules:"];
    for (const [rule, selectors] of [...rules.entries()].sort(([left], [right]) => left.localeCompare(right))) {
      yaml.push(`  ${rule}:`, "    ignore:", ...selectors.sort().map((selector) => `      - ${JSON.stringify(selector)}`));
    }
    await writePrivate(zizmorConfig, `${yaml.join("\n")}\n`);
  }
  return { gitleaksConfig, gitleaksIgnore, zizmorConfig, zizmorSuppressions: zizmor, hasZizmorSuppressions: zizmor.length > 0 };
}

export async function capturePrivateOutput(command, args, { cwd, stdoutPath, stderrPath }) {
  const stdout = createWriteStream(stdoutPath, { flags: "wx", mode: 0o600 });
  const stderr = createWriteStream(stderrPath, { flags: "wx", mode: 0o600 });
  const result = await new Promise((resolve) => {
    let settled = false;
    let child;
    const finish = (value) => {
      if (settled) return;
      settled = true;
      resolve(value);
    };
    const streamFailure = () => {
      try { child?.kill(); } catch { /* child startup already failed */ }
      stdout.destroy();
      stderr.destroy();
      finish({ started: false, exitCode: null });
    };
    stdout.once("error", streamFailure);
    stderr.once("error", streamFailure);
    try {
      child = spawn(command, args, { cwd, stdio: ["ignore", "pipe", "pipe"] });
    } catch {
      stdout.end();
      stderr.end();
      finish({ started: false, exitCode: null });
      return;
    }
    child.stdout.pipe(stdout);
    child.stderr.pipe(stderr);
    child.once("error", () => {
      stdout.end();
      stderr.end();
      finish({ started: false, exitCode: null });
    });
    child.once("close", (exitCode) => finish({ started: true, exitCode }));
  });
  const streams = await Promise.allSettled([finished(stdout), finished(stderr)]);
  return streams.every((stream) => stream.status === "fulfilled") ? result : { started: false, exitCode: null };
}

async function readReport(pathname) {
  try {
    const report = JSON.parse((await readBoundedRegularFile(pathname, maxReportBytes)).toString("utf8"));
    if (!Array.isArray(report) || report.some((entry) => !isObject(entry))) throw new Error("invalid");
    return report;
  } catch {
    return null;
  }
}

export function assessGitleaks({ started, exitCode, report }) {
  if (!started || !Array.isArray(report)) return { tool: "gitleaks", status: "error", findings: 0 };
  if (exitCode === 0 && report.length === 0) return { tool: "gitleaks", status: "clean", findings: 0 };
  if (exitCode === 1 && report.length > 0) return { tool: "gitleaks", status: "findings", findings: report.length };
  return { tool: "gitleaks", status: "error", findings: 0 };
}

function selectorMatchesFinding(selector, finding) {
  if (!isObject(finding) || typeof finding.ident !== "string" || !Array.isArray(finding.locations)) return false;
  const [filename, line, column] = selector.split(":");
  return finding.locations.some((location) => {
    const pathname = location?.symbolic?.key?.Local?.verbatim_path;
    const point = location?.concrete?.location?.start_point;
    if (typeof pathname !== "string" || path.basename(pathname) !== filename) return false;
    if (line === undefined) return true;
    if (!Number.isInteger(point?.row) || point.row + 1 !== Number(line)) return false;
    return column === undefined || (Number.isInteger(point?.column) && point.column + 1 === Number(column));
  });
}

export function assessZizmor({ started, exitCode, report, suppressions = [] }) {
  if (!started || !Array.isArray(report)) return { tool: "zizmor", status: "error", findings: 0 };
  const active = [];
  for (const finding of report) {
    if (!isObject(finding) || typeof finding.ignored !== "boolean") return { tool: "zizmor", status: "error", findings: 0 };
    if (!finding.ignored) {
      active.push(finding);
      continue;
    }
    const allowed = suppressions.some((entry) => entry.tool === "zizmor" && entry.rule === finding.ident && selectorMatchesFinding(entry.selector, finding));
    if (!allowed) return { tool: "zizmor", status: "error", findings: 0 };
  }
  if (exitCode === 0 && active.length === 0) return { tool: "zizmor", status: "clean", findings: 0 };
  if (findingExitCodes.has(exitCode) && active.length > 0) return { tool: "zizmor", status: "findings", findings: active.length };
  return { tool: "zizmor", status: "error", findings: 0 };
}

async function scanGitleaks({ binary, mode, target, tempDir, inputs, root }) {
  const reportPath = path.join(tempDir, "gitleaks-report.json");
  const process = await capturePrivateOutput(binary, [
    mode,
    "--redact",
    "--verbose",
    "--no-banner",
    "--no-color",
    "--log-level", "error",
    "--config", inputs.gitleaksConfig,
    "--gitleaks-ignore-path", inputs.gitleaksIgnore,
    "--ignore-gitleaks-allow",
    "--report-format", "json",
    "--report-path", reportPath,
    target,
  ], {
    cwd: root,
    stdoutPath: path.join(tempDir, "gitleaks.stdout"),
    stderrPath: path.join(tempDir, "gitleaks.stderr"),
  });
  return assessGitleaks({ ...process, report: await readReport(reportPath) });
}

async function scanZizmor({ binary, tempDir, inputs, root }) {
  const reportPath = path.join(tempDir, "zizmor-report.json");
  const args = ["--offline", "--no-progress", "--strict-collection", "--format", "json"];
  if (inputs.hasZizmorSuppressions) args.push("--config", inputs.zizmorConfig);
  else args.push("--no-config", "--no-ignores");
  args.push(".github/workflows");
  const process = await capturePrivateOutput(binary, args, {
    cwd: root,
    stdoutPath: reportPath,
    stderrPath: path.join(tempDir, "zizmor.stderr"),
  });
  return assessZizmor({ ...process, report: await readReport(reportPath), suppressions: inputs.zizmorSuppressions });
}

export async function runSecurityScans({ gitleaks, gitleaksMode, target, zizmor, tempRoot, root = projectRoot, scannerPolicyPath = policyPath }) {
  const suppressions = await readScannerSuppressions(scannerPolicyPath);
  await assertNoUnmanagedSuppressions(root);
  if (!path.isAbsolute(tempRoot) || path.resolve(tempRoot) === path.parse(path.resolve(tempRoot)).root) throw new Error("Security scan temporary directory is invalid.");
  await mkdir(tempRoot, { recursive: true, mode: 0o700 });
  const tempDir = await mkdtemp(path.join(tempRoot, "smart-portfolio-security-scans-"));
  await chmod(tempDir, 0o700);
  try {
    const inputs = await writeSuppressionInputs(tempDir, suppressions);
    const scans = [scanGitleaks({ binary: gitleaks, mode: gitleaksMode, target, tempDir, inputs, root })];
    if (zizmor) scans.push(scanZizmor({ binary: zizmor, tempDir, inputs, root }));
    return await Promise.all(scans);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

export function parseSecurityScansCli(argv, env = process.env) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || values.has(key)) throw new Error("Security scan arguments are invalid.");
    values.set(key, value);
  }
  const allowed = new Set(["--gitleaks", "--gitleaks-mode", "--target", "--temp-root", "--zizmor"]);
  if ([...values.keys()].some((key) => !allowed.has(key)) || !values.has("--gitleaks") || !values.has("--gitleaks-mode") || !values.has("--target")) {
    throw new Error("Security scan arguments are invalid.");
  }
  const gitleaksMode = values.get("--gitleaks-mode");
  const target = values.get("--target");
  if (!new Set(["git", "dir"]).has(gitleaksMode) || !/^(?:\.|[A-Za-z0-9][A-Za-z0-9_./-]*)$/.test(target) || target.includes("..")) {
    throw new Error("Security scan arguments are invalid.");
  }
  const tempRoot = values.get("--temp-root") ?? env.RUNNER_TEMP;
  if (typeof tempRoot !== "string" || !tempRoot) throw new Error("Security scan temporary directory is unavailable.");
  return {
    gitleaks: values.get("--gitleaks"),
    gitleaksMode,
    target,
    ...(values.has("--zizmor") ? { zizmor: values.get("--zizmor") } : {}),
    tempRoot,
  };
}

function printSummary(result) {
  const status = result.status === "clean" ? "clean" : result.status === "findings" ? "rejected" : "error";
  console.log(`${result.tool}: ${status}; findings=${result.findings}`);
}

async function main() {
  try {
    const results = await runSecurityScans(parseSecurityScansCli(process.argv.slice(2)));
    results.forEach(printSummary);
    if (results.some((result) => result.status !== "clean")) throw new Error("Security scanner gate rejected one or more scans.");
  } catch {
    console.error("Security scanner gate failed without publishing scanner details.");
    process.exitCode = 1;
  }
}

async function invokedAsCli() {
  if (!process.argv[1]) return false;
  try {
    const [entrypoint, modulePath] = await Promise.all([realpath(process.argv[1]), realpath(fileURLToPath(import.meta.url))]);
    return entrypoint === modulePath;
  } catch {
    return false;
  }
}

if (await invokedAsCli()) void main();
