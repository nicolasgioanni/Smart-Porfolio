import assert from "node:assert/strict";
import { lstat, readFile, readdir, realpath } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { readRegularFile } from "../scripts/lib/readRegularFile.mjs";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const states = ["cloudflare-shared", "cloudflare-preview", "cloudflare-production", "cloudflare-audit", "github-governance"];
const maximumConfigurationFileBytes = 1024 * 1024;
const operationalFiles = [
  /^backend\.hcl$/i,
  /\.backend\.hcl$/i,
  /^terraform\.tfvars(?:\.json)?$/i,
  /^.+\.auto\.tfvars(?:\.json)?$/i,
  /^\.terraformrc$/i,
  /^terraform\.rc$/i,
  /^credentials\.tfrc\.json$/i,
  /^override\.tf(?:\.json)?$/i,
  /^.+_override\.tf(?:\.json)?$/i,
];

function outside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative);
}

function isOperationalFile(name) {
  return operationalFiles.some((pattern) => pattern.test(name));
}

async function regularFile(filePath, label) {
  try {
    return (await readRegularFile(filePath, { maximumBytes: maximumConfigurationFileBytes })).toString("utf8");
  } catch {
    throw new Error(`${label} must be a bounded regular file`);
  }
}

async function regularDirectory(directory, label) {
  let entry;
  try { entry = await lstat(directory); }
  catch { throw new Error(`${label} is missing`); }
  if (entry.isSymbolicLink() || !entry.isDirectory()) throw new Error(`${label} must be a directory, not a symbolic link`);
  return realpath(directory);
}

function localModuleSources(source, filePath) {
  const values = [];
  const providerSources = new Set(["cloudflare/cloudflare", "integrations/github"]);
  const matcher = /\bsource\s*=\s*"([^"]+)"/g;
  for (const match of source.matchAll(matcher)) {
    if (match[1].startsWith(".")) values.push({ value: match[1], filePath });
    else if (!providerSources.has(match[1])) throw new Error("Terraform configuration declares an unreviewed nonlocal module source");
  }
  return values;
}

/**
 * Returns the complete reviewed Terraform configuration closure for one state.
 * Only declared local modules inside infra/modules may participate. Operational
 * override files and symbolic links are rejected instead of silently omitted.
 */
export async function inspectInfrastructureConfiguration(root, state) {
  if (!states.includes(state)) throw new Error("unknown infrastructure state");
  const infrastructureRoot = path.join(root, "infra");
  const modulesRoot = await regularDirectory(path.join(infrastructureRoot, "modules"), "infra modules directory");
  const stateDirectory = await regularDirectory(path.join(infrastructureRoot, "states", state), `${state} state directory`);
  const visited = new Set();
  const records = [];

  async function inspectDirectory(directory, label) {
    const resolved = await regularDirectory(directory, label);
    if (visited.has(resolved)) return;
    visited.add(resolved);
    const entries = await readdir(resolved, { withFileTypes: true });
    const configurationFiles = [];
    for (const entry of entries) {
      const entryPath = path.join(resolved, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`${label} contains an unreviewed symbolic link`);
      if (entry.isFile() && isOperationalFile(entry.name)) throw new Error(`${label} contains an unreviewed operational override`);
      if (entry.isFile() && entry.name.endsWith(".tf.json")) throw new Error(`${label} contains unsupported JSON Terraform configuration`);
      if (entry.isFile() && (entry.name.endsWith(".tf") || entry.name === ".terraform.lock.hcl")) {
        configurationFiles.push(entryPath);
      }
    }
    if (!configurationFiles.some((filePath) => path.basename(filePath) === ".terraform.lock.hcl")) {
      throw new Error(`${label} is missing its reviewed dependency lock`);
    }
    for (const filePath of configurationFiles.sort((left, right) => left.localeCompare(right))) {
      const content = await regularFile(filePath, "Terraform configuration file");
      records.push({
        relativePath: path.relative(root, filePath).split(path.sep).join("/"),
        content,
        lock: path.basename(filePath) === ".terraform.lock.hcl",
      });
      if (!filePath.endsWith(".tf")) continue;
      const backendBlocks = [...content.matchAll(/\bbackend\s+"([^"]+)"\s*\{([\s\S]*?)\}/g)];
      if (backendBlocks.length) {
        const emptyRemoteBackend = resolved === stateDirectory && path.basename(filePath) === "main.tf" && backendBlocks.length === 1 && backendBlocks[0][1] === "remote" && backendBlocks[0][2].replace(/#.*$/gm, "").trim() === "";
        if (!emptyRemoteBackend) throw new Error("Terraform configuration contains unreviewed backend operational settings");
      }
      if (/\bcloud\s*\{/.test(content)) throw new Error("Terraform configuration contains unreviewed cloud operational settings");
      for (const moduleSource of localModuleSources(content, filePath)) {
        const candidate = path.resolve(path.dirname(filePath), moduleSource.value);
        if (outside(modulesRoot, candidate)) throw new Error("Terraform configuration references a local module outside infra/modules");
        const moduleDirectory = await regularDirectory(candidate, "declared local Terraform module");
        if (outside(modulesRoot, moduleDirectory)) throw new Error("Terraform configuration resolves a local module outside infra/modules");
        await inspectDirectory(moduleDirectory, "declared local Terraform module");
      }
    }
  }

  await inspectDirectory(stateDirectory, `${state} state directory`);
  return records.sort((left, right) => left.relativePath.localeCompare(right.relativePath));
}

async function source(state, name) {
  return readFile(path.join(projectRoot, "infra", "states", state, name), "utf8");
}

export async function validateInfrastructureOwnership() {
  for (const state of states) {
    await inspectInfrastructureConfiguration(projectRoot, state);
    const [main, lock] = await Promise.all([source(state, "main.tf"), source(state, ".terraform.lock.hcl")]);
    assert.match(main, /backend "remote" \{\}/, `${state} must require an explicitly configured remote backend for an authorized adoption`);
    assert.doesNotMatch(main, /terraform_remote_state|provider\s+"[^"\n]+"\s*\{[^}]*alias/s, `${state} must not couple to another state or provider alias`);
    assert.match(lock, /version\s+=\s+"(?:5\.27\.0|6\.13\.0)"/, `${state} must retain a reviewed provider version`);
  }
  const governance = await source("github-governance", "main.tf");
  assert.match(governance, /resource "github_repository_ruleset" "permanent_branches"/);
  assert.match(governance, /include = \["refs\/heads\/main", "refs\/heads\/develop"\]/);
  assert.match(governance, /deletion\s+=\s+true/);
  assert.match(governance, /non_fast_forward\s+=\s+true/);
  assert.match(governance, /prevent_destroy\s+=\s+true/);
  assert.doesNotMatch(governance, /github_repository_environment|pull_request|required_status_checks/);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  validateInfrastructureOwnership().then(() => {
    process.stdout.write("Infrastructure ownership source validation passed.\n");
  }).catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
