import { createHash } from "node:crypto";
import { constants, existsSync } from "node:fs";
import { copyFile, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import net from "node:net";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

export const setupStateRelativePath = path.join(".local", "setup-state.json");
export const generatedContentStateRelativePath = path.join(".local", "generated-content-state.json");
export const generatedContentRelativePath = path.join("src", "content", "generated", "portfolio.generated.json");
export const templateDirectoryRelativePath = path.join("src", "content", "templates");

const generatedContentSchemaVersion = 1;
const generatedContentToolchainPaths = [
  "package.json",
  "package-lock.json",
  path.join("scripts", "fetchPortfolioContent.ts")
];

export function findProjectRoot(startDirectory = process.cwd()) {
  let currentDirectory = path.resolve(startDirectory);

  while (true) {
    if (existsSync(path.join(currentDirectory, "package.json"))) {
      return currentDirectory;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      throw new Error("Could not locate project root. Run this command inside the project or a child directory.");
    }

    currentDirectory = parentDirectory;
  }
}

export async function readJsonFile(filePath, fallback = null) {
  if (!existsSync(filePath)) return fallback;
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function hashFile(filePath) {
  if (!existsSync(filePath)) return null;
  const content = await readFile(filePath);
  return createHash("sha256").update(content).digest("hex");
}

async function hashProjectPaths(projectRoot, relativePaths) {
  const entries = [];
  for (const relativePath of [...relativePaths].sort()) {
    entries.push([relativePath.replaceAll("\\", "/"), await hashFile(path.join(projectRoot, relativePath))]);
  }
  return createHash("sha256").update(JSON.stringify(entries), "utf8").digest("hex");
}

export async function getPackageHashes(projectRoot) {
  return {
    packageJsonHash: await hashFile(path.join(projectRoot, "package.json")),
    packageLockHash: await hashFile(path.join(projectRoot, "package-lock.json"))
  };
}

export function getSetupStatePath(projectRoot) {
  return path.join(projectRoot, setupStateRelativePath);
}

export async function readSetupState(projectRoot) {
  return readJsonFile(getSetupStatePath(projectRoot), null);
}

export async function writeSetupState(projectRoot, state) {
  const statePath = getSetupStatePath(projectRoot);
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(state, null, 2)}\n`, "utf8");
}

export function commandVersion(command, args = ["--version"]) {
  const result = spawnSync(command, args, { encoding: "utf8", shell: process.platform === "win32" });

  if (result.error || result.status !== 0) {
    return null;
  }

  return (result.stdout || result.stderr).trim();
}

export function ensureCommand(command, label = command) {
  const version = commandVersion(command);

  if (!version) {
    throw new Error(`${label} was not found. Install ${label} and try again.`);
  }

  return version;
}

export function getNodeMajorVersion(nodeVersion = process.versions.node) {
  const majorText = nodeVersion.replace(/^v/, "").split(".")[0];
  const majorVersion = Number(majorText);
  return Number.isFinite(majorVersion) ? majorVersion : 0;
}

export function hasDependencyInstall(projectRoot) {
  const nodeModulesPath = path.join(projectRoot, "node_modules");
  return existsSync(path.join(nodeModulesPath, ".package-lock.json")) &&
    existsSync(path.join(nodeModulesPath, "next", "package.json")) &&
    existsSync(path.join(nodeModulesPath, "next", "dist", "bin", "next"));
}

export async function createPackageState(projectRoot, nodeVersion = process.versions.node, npmVersion = commandVersion("npm") ?? "unknown") {
  const hashes = await getPackageHashes(projectRoot);
  return {
    ...hashes,
    nodeVersion,
    npmVersion,
    setupCompletedAt: new Date().toISOString()
  };
}

export async function isDependencyInstallCurrent(projectRoot, state = null) {
  if (!hasDependencyInstall(projectRoot)) return false;

  const currentState = state ?? (await readSetupState(projectRoot));
  if (!currentState) return false;

  const hashes = await getPackageHashes(projectRoot);
  return currentState.packageJsonHash === hashes.packageJsonHash &&
    currentState.packageLockHash === hashes.packageLockHash &&
    currentState.nodeVersion === process.versions.node &&
    currentState.npmVersion === (commandVersion("npm") ?? "unknown");
}

export async function getTemplateCsvFiles(projectRoot) {
  const templateDirectory = path.join(projectRoot, templateDirectoryRelativePath);
  if (!existsSync(templateDirectory)) return [];
  const entries = await readdir(templateDirectory, { withFileTypes: true });
  return entries.filter((entry) => entry.isFile() && entry.name.toLowerCase().endsWith(".csv")).map((entry) => path.join(templateDirectory, entry.name));
}

async function getFilesRecursively(directory, root = directory) {
  if (!existsSync(directory)) return [];
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await getFilesRecursively(entryPath, root));
    else if (entry.isFile() && !/\.(?:test|spec)\.[cm]?[jt]sx?$/.test(entry.name)) files.push(path.relative(root, entryPath));
  }
  return files;
}

async function getContentImplementationPaths(projectRoot) {
  const directories = [path.join("scripts", "lib"), path.join("src", "content"), path.join("src", "lib", "content"), path.join("src", "lib", "csv")];
  const nested = await Promise.all(directories.map(async (relativeDirectory) =>
    (await getFilesRecursively(path.join(projectRoot, relativeDirectory))).map((file) => path.join(relativeDirectory, file))
  ));
  return [...generatedContentToolchainPaths, ...nested.flat()];
}

async function getContentEnvironmentHash(projectRoot) {
  const environmentPath = path.join(projectRoot, ".env");
  const environmentText = existsSync(environmentPath) ? await readFile(environmentPath, "utf8") : "";
  const selected = environmentText.split(/\r?\n/).filter((line) => /^PORTFOLIO_(?:WORKBOOK_URL|REQUIRE_REMOTE_CONTENT)=/.test(line));
  const effective = [
    ...selected,
    `process:PORTFOLIO_WORKBOOK_URL=${process.env.PORTFOLIO_WORKBOOK_URL ?? ""}`,
    `process:PORTFOLIO_REQUIRE_REMOTE_CONTENT=${process.env.PORTFOLIO_REQUIRE_REMOTE_CONTENT ?? ""}`
  ];
  return createHash("sha256").update(effective.join("\n"), "utf8").digest("hex");
}

export function getGeneratedContentStatePath(projectRoot) {
  return path.join(projectRoot, generatedContentStateRelativePath);
}

export async function createGeneratedContentState(projectRoot, nodeVersion = process.versions.node) {
  const templateFiles = await getTemplateCsvFiles(projectRoot);
  const templatePaths = templateFiles.map((filePath) => path.relative(projectRoot, filePath));
  const implementationPaths = await getContentImplementationPaths(projectRoot);
  const npmVersion = commandVersion("npm") ?? "unknown";
  const [sourceHash, implementationHash, environmentHash, generatedContentHash] = await Promise.all([
    hashProjectPaths(projectRoot, templatePaths),
    hashProjectPaths(projectRoot, implementationPaths),
    getContentEnvironmentHash(projectRoot),
    hashFile(path.join(projectRoot, generatedContentRelativePath))
  ]);
  const inputFingerprint = createHash("sha256")
    .update(JSON.stringify({ generatedContentSchemaVersion, nodeVersion, npmVersion, sourceHash, implementationHash, environmentHash }), "utf8")
    .digest("hex");

  return {
    schemaVersion: generatedContentSchemaVersion,
    nodeVersion,
    npmVersion,
    sourceHash,
    implementationHash,
    environmentHash,
    generatedContentHash,
    inputFingerprint
  };
}

export async function writeGeneratedContentState(projectRoot, state) {
  const resolvedState = state ?? await createGeneratedContentState(projectRoot);
  const statePath = getGeneratedContentStatePath(projectRoot);
  await mkdir(path.dirname(statePath), { recursive: true });
  await writeFile(statePath, `${JSON.stringify(resolvedState, null, 2)}\n`, "utf8");
  return resolvedState;
}

async function hasValidGeneratedContent(projectRoot) {
  const generatedContentPath = path.join(projectRoot, generatedContentRelativePath);
  if (!existsSync(generatedContentPath)) return false;

  try {
    const content = JSON.parse(await readFile(generatedContentPath, "utf8"));
    return (
      typeof content?.metadata?.contentHash === "string" &&
      /^[a-f0-9]{64}$/.test(content.metadata.contentHash) &&
      typeof content.metadata.generatedAt === "string" &&
      !Number.isNaN(Date.parse(content.metadata.generatedAt))
    );
  } catch {
    return false;
  }
}

export async function isGeneratedContentStale(projectRoot) {
  if (!(await hasValidGeneratedContent(projectRoot))) return true;

  const recordedState = await readJsonFile(getGeneratedContentStatePath(projectRoot), null);
  if (!recordedState || recordedState.schemaVersion !== generatedContentSchemaVersion) return true;

  const currentState = await createGeneratedContentState(projectRoot);
  return recordedState.inputFingerprint !== currentState.inputFingerprint || recordedState.generatedContentHash !== currentState.generatedContentHash;
}

export async function runCommand(command, args, options = {}) {
  const cwd = options.cwd ?? process.cwd();
  const shell = options.shell ?? process.platform === "win32";

  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd,
      shell,
      stdio: "inherit",
      env: { ...process.env, ...options.env }
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code}`));
    });
  });
}

export async function isPortAvailable(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(false));
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen(port, "127.0.0.1");
  });
}

export async function findAvailablePort(startPort = 3000, endPort = 3010) {
  for (let port = startPort; port <= endPort; port += 1) {
    if (await isPortAvailable(port)) return port;
  }

  throw new Error(`No available port found from ${startPort} to ${endPort}.`);
}

export async function copyEnvExampleIfMissing(projectRoot) {
  const envLocalPath = path.join(projectRoot, ".env");
  const envExamplePath = path.join(projectRoot, ".env.example");

  try {
    await copyFile(envExamplePath, envLocalPath, constants.COPYFILE_EXCL);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && (error.code === "EEXIST" || error.code === "ENOENT")) return false;
    throw error;
  }
}

export async function removePathIfPresent(targetPath) {
  if (!existsSync(targetPath)) return false;
  await rm(targetPath, { recursive: true, force: true });
  return true;
}

export async function confirmAction(message) {
  const reader = readline.createInterface({ input, output });
  try {
    const answer = await reader.question(`${message} Type yes to continue: `);
    return answer.trim().toLowerCase() === "yes";
  } finally {
    reader.close();
  }
}

export function parseBooleanFlag(args, flagName) {
  return args.includes(flagName);
}

export function parseNumberOption(args, optionName, fallback) {
  const index = args.indexOf(optionName);
  if (index === -1 || index === args.length - 1) return fallback;
  const value = Number(args[index + 1]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

export function logSection(message) {
  console.log(`\n${message}`);
}
