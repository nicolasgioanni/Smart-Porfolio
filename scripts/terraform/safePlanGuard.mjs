import { createHash, randomUUID } from "node:crypto";
import { execFileSync, spawnSync } from "node:child_process";
import { chmod, open, readFile, readdir, realpath, rename, unlink } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { validateOwnershipConfiguration } from "./ownershipConfiguration.mjs";
import { validatePrivateRecordSchemas } from "./privateRecordSchemas.mjs";

const defaultProjectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const sha256Pattern = /^[a-f0-9]{64}$/;
const providerVersions = {
  "registry.terraform.io/cloudflare/cloudflare": "5.27.0",
  "registry.terraform.io/integrations/github": "6.13.0",
};
const rootDirectories = {
  shared: "infra/roots/shared",
  preview: "infra/roots/preview",
  production: "infra/roots/production",
  "github-governance": "infra/roots/github-governance",
};
const privateEvidenceSource = "operator-supplied policy input; authenticated provider APIs and state must be checked separately";

function digest(value) {
  return createHash("sha256").update(value).digest("hex");
}

async function digestFile(filePath) {
  return digest(await readFile(filePath));
}

function asObject(value, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return {};
  }
  return value;
}

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function hasOnlyKeys(value, keys, label, errors) {
  if (!isRecord(value)) return false;
  for (const key of Object.keys(value)) {
    if (!keys.includes(key)) errors.push(`${label} contains unsupported field ${key}`);
  }
  for (const key of keys) {
    if (!(key in value)) errors.push(`${label} is missing required field ${key}`);
  }
  return true;
}

function hasText(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function isUtcTimestamp(value) {
  return typeof value === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(value) && Number.isFinite(Date.parse(value));
}

function isTerraformLogVariable(name) {
  return name === "TF_LOG" || name.startsWith("TF_LOG_");
}

export function sanitizedTerraformEnvironment(environment) {
  const sanitized = { ...environment };
  for (const name of Object.keys(sanitized)) {
    if (isTerraformLogVariable(name)) delete sanitized[name];
  }
  return sanitized;
}

function collectUnknownPaths(value, currentPath = "after_unknown", paths = []) {
  if (value === true) paths.push(currentPath);
  if (!value || typeof value !== "object") return paths;
  for (const [key, child] of Object.entries(value)) {
    collectUnknownPaths(child, `${currentPath}.${key}`, paths);
  }
  return paths;
}

async function rootConfigurationDigest(rootDirectory) {
  const entries = await readdir(rootDirectory, { withFileTypes: true });
  const configFiles = entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".tf"))
    .map((entry) => entry.name)
    .sort();
  const contents = await Promise.all(
    configFiles.map(async (fileName) => `${fileName}\u0000${await readFile(path.join(rootDirectory, fileName), "utf8")}`),
  );
  return digest(contents.join("\u0000"));
}

function isWithin(parent, child) {
  const relative = path.relative(parent, child);
  return relative === "" || (!relative.startsWith(`..${path.sep}`) && relative !== ".." && !path.isAbsolute(relative));
}

function gitWorktreePaths(projectRoot) {
  const source = execFileSync("git", ["-C", projectRoot, "worktree", "list", "--porcelain"], { encoding: "utf8" });
  return source
    .split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => line.slice("worktree ".length));
}

async function resolvedWorktreePaths(projectRoot) {
  return Promise.all(gitWorktreePaths(projectRoot).map((worktree) => realpath(worktree)));
}

async function assertOutsideWorktrees(filePath, worktreePaths) {
  const lexicalPath = path.resolve(filePath);
  if (worktreePaths.some((worktree) => isWithin(worktree, lexicalPath))) {
    throw new Error("private Terraform review input or output must stay outside every Git worktree");
  }
  const resolvedPath = await realpath(filePath);
  if (worktreePaths.some((worktree) => isWithin(worktree, resolvedPath))) {
    throw new Error("private Terraform review input or output must stay outside every Git worktree");
  }
  return resolvedPath;
}

async function resolveExternalOutputPath(outputPath, worktreePaths) {
  const lexicalParent = path.resolve(path.dirname(outputPath));
  if (worktreePaths.some((worktree) => isWithin(worktree, lexicalParent))) {
    throw new Error("private Terraform review output must stay outside every Git worktree");
  }
  const parent = await realpath(path.dirname(outputPath));
  if (worktreePaths.some((worktree) => isWithin(worktree, parent))) {
    throw new Error("private Terraform review output must stay outside every Git worktree");
  }
  return path.join(parent, path.basename(outputPath));
}

export async function writePrivateTerraformOutput({ outputPath, contents, projectRoot = defaultProjectRoot }) {
  const worktreePaths = await resolvedWorktreePaths(projectRoot);
  const finalPath = await resolveExternalOutputPath(outputPath, worktreePaths);
  const temporaryPath = path.join(path.dirname(finalPath), `.${path.basename(finalPath)}.${randomUUID()}.tmp`);
  let handle;
  try {
    handle = await open(temporaryPath, "wx", 0o600);
    await handle.writeFile(contents, "utf8");
    await handle.chmod(0o600);
    await handle.close();
    handle = undefined;
    await rename(temporaryPath, finalPath);
    await chmod(finalPath, 0o600);
  } catch (error) {
    await handle?.close();
    await unlink(temporaryPath).catch(() => {});
    throw error;
  }
  return finalPath;
}

async function validateEnvironmentOverrides(environment, worktreePaths) {
  const errors = [];
  if (environment.TF_WORKSPACE) errors.push("TF_WORKSPACE must not select an alternate workspace");
  if (environment.TF_CLI_CONFIG_FILE) errors.push("TF_CLI_CONFIG_FILE must not select an alternate Terraform configuration");
  for (const name of Object.keys(environment)) {
    if (name === "TF_CLI_ARGS" || name.startsWith("TF_CLI_ARGS_")) {
      errors.push(`${name} must not override Terraform commands`);
    }
    if (isTerraformLogVariable(name)) {
      errors.push(`${name} must not enable Terraform trace output`);
    }
  }
  if (environment.TF_DATA_DIR) {
    try {
      await assertOutsideWorktrees(environment.TF_DATA_DIR, worktreePaths);
    } catch {
      errors.push("TF_DATA_DIR must resolve outside every Git worktree");
    }
  }
  return errors;
}

async function readTerraformIdentity(terraformBinary, worktreePaths, environment) {
  if (!path.isAbsolute(terraformBinary)) throw new Error("Terraform binary must be an absolute path");
  await assertOutsideWorktrees(terraformBinary, worktreePaths);
  const result = spawnSync(terraformBinary, ["version", "-json"], {
    encoding: "utf8",
    env: sanitizedTerraformEnvironment(environment),
    maxBuffer: 1024 * 1024,
    timeout: 10_000,
  });
  if (result.error || result.status !== 0) throw new Error("Terraform version inspection failed");
  let version;
  try {
    version = JSON.parse(result.stdout).terraform_version;
  } catch {
    throw new Error("Terraform version inspection did not return JSON");
  }
  if (version !== "1.16.5") throw new Error("Terraform binary must report version 1.16.5");
  return { version, binarySha256: await digestFile(terraformBinary) };
}

function readTerraformShow(terraformBinary, savedPlanPath, environment) {
  const result = spawnSync(terraformBinary, ["show", "-json", savedPlanPath], {
    encoding: "utf8",
    env: sanitizedTerraformEnvironment(environment),
    maxBuffer: 10 * 1024 * 1024,
    timeout: 20_000,
  });
  if (result.error || result.status !== 0 || result.signal) {
    throw new Error("Terraform show failed without returning review output");
  }
  try {
    JSON.parse(result.stdout);
  } catch {
    throw new Error("Terraform show did not emit valid JSON");
  }
  return result.stdout;
}

function addError(errors, condition, message) {
  if (!condition) errors.push(message);
}

function validateInventory({ inventory, manifest, errors }) {
  const inventoryObject = asObject(inventory, "private runtime inventory", errors);
  hasOnlyKeys(inventoryObject, ["schemaVersion", "collectedAt", "evidence", "roots"], "private runtime inventory", errors);
  addError(errors, inventoryObject.schemaVersion === 1, "private runtime inventory schemaVersion must be 1");
  addError(errors, isUtcTimestamp(inventoryObject.collectedAt), "private runtime inventory collectedAt must be a UTC date-time");
  const evidence = asObject(inventoryObject.evidence, "private runtime inventory evidence", errors);
  hasOnlyKeys(evidence, ["source", "refreshedAt"], "private runtime inventory evidence", errors);
  addError(errors, evidence.source === privateEvidenceSource, "private runtime inventory must retain its policy-input evidence source");
  addError(errors, isUtcTimestamp(evidence.refreshedAt), "private runtime inventory evidence refreshedAt must be a UTC date-time");
  addError(errors, Array.isArray(inventoryObject.roots), "private runtime inventory roots must be an array");
  if (!Array.isArray(inventoryObject.roots)) return new Map();

  const rootEntries = new Map();
  const resourceOwners = new Map();
  const resourceIds = new Map();
  const manifestByRoot = new Map(manifest.roots.map((entry) => [entry.name, entry]));
  const logicalResources = new Map(manifest.resources.map((entry) => [`${entry.root}:${entry.address}`, entry]));

  for (const root of inventoryObject.roots) {
    if (!isRecord(root) || !hasText(root.name)) {
      errors.push("private runtime inventory root must have a name");
      continue;
    }
    hasOnlyKeys(root, ["name", "workspace", "state", "providers", "resources"], `private runtime inventory root ${root.name}`, errors);
    if (rootEntries.has(root.name)) {
      errors.push(`private runtime inventory duplicates root ${root.name}`);
      continue;
    }
    rootEntries.set(root.name, root);
    const logicalRoot = manifestByRoot.get(root.name);
    if (!logicalRoot) {
      errors.push(`private runtime inventory has unknown root ${root.name}`);
      continue;
    }
    const workspace = asObject(root.workspace, `workspace for ${root.name}`, errors);
    hasOnlyKeys(workspace, ["id", "name", "organization", "project", "executionMode"], `workspace for ${root.name}`, errors);
    for (const field of ["id", "name", "organization", "project", "executionMode"]) {
      addError(errors, hasText(workspace[field]), `workspace for ${root.name} must include ${field}`);
    }
    addError(errors, workspace.executionMode === "local", `workspace for ${root.name} must use separately verified local execution`);
    const state = asObject(root.state, `state for ${root.name}`, errors);
    hasOnlyKeys(state, ["versionId", "lineage", "serial", "sha256"], `state for ${root.name}`, errors);
    for (const field of ["versionId", "lineage", "sha256"]) {
      addError(errors, hasText(state[field]), `state for ${root.name} must include ${field}`);
    }
    addError(errors, Number.isInteger(state.serial) && state.serial >= 0, `state for ${root.name} must include a non-negative serial`);
    addError(errors, sha256Pattern.test(state.sha256 ?? ""), `state for ${root.name} must include a SHA-256 digest`);

    const providers = asObject(root.providers, `providers for ${root.name}`, errors);
    if (logicalRoot.providers.includes("registry.terraform.io/cloudflare/cloudflare")) {
      hasOnlyKeys(providers, ["cloudflare"], `providers for ${root.name}`, errors);
      hasOnlyKeys(providers.cloudflare, ["accountId"], `Cloudflare provider for ${root.name}`, errors);
      addError(errors, hasText(providers.cloudflare?.accountId), `Cloudflare account identity is required for ${root.name}`);
    }
    if (logicalRoot.providers.includes("registry.terraform.io/integrations/github")) {
      hasOnlyKeys(providers, ["github"], `providers for ${root.name}`, errors);
      hasOnlyKeys(providers.github, ["ownerId", "ownerLogin", "repositoryId", "repository"], "GitHub provider for github-governance", errors);
      addError(errors, hasText(providers.github?.ownerId), "GitHub owner identity is required for github-governance");
      addError(errors, hasText(providers.github?.repositoryId), "GitHub repository identity is required for github-governance");
      addError(errors, hasText(providers.github?.ownerLogin), "GitHub owner login is required for github-governance");
      addError(errors, hasText(providers.github?.repository), "GitHub repository name is required for github-governance");
    }

    if (!Array.isArray(root.resources)) {
      errors.push(`resources for ${root.name} must be an array`);
      continue;
    }
    const expectedAddresses = new Set(logicalRoot.resourceAddresses);
    for (const resource of root.resources) {
      const key = `${root.name}:${resource?.address ?? ""}`;
      const logicalResource = logicalResources.get(key);
      if (!logicalResource) {
        errors.push(`private runtime inventory has unknown resource ${key}`);
        continue;
      }
      const resourceKeys = logicalResource.provider === "registry.terraform.io/cloudflare/cloudflare"
        ? ["address", "resourceId", "accountId", "environment"]
        : ["address", "resourceId", "rulesetId", "ownerId", "repositoryId", "repository", "environment"];
      hasOnlyKeys(resource, resourceKeys, `private runtime inventory resource ${key}`, errors);
      if (!hasText(resource.resourceId)) {
        errors.push(`private runtime inventory resource ${key} is missing its exact resource ID`);
      } else if (resourceIds.has(resource.resourceId)) {
        errors.push(`private runtime inventory reuses resource ID for ${key} and ${resourceIds.get(resource.resourceId)}`);
      } else {
        resourceIds.set(resource.resourceId, key);
      }
      if (resourceOwners.has(key)) errors.push(`private runtime inventory duplicates resource ${key}`);
      resourceOwners.set(key, resource);
      if (resource.environment !== logicalResource.environment) {
        errors.push(`private runtime inventory uses the wrong environment for ${key}`);
      }
      if (logicalResource.provider === "registry.terraform.io/cloudflare/cloudflare") {
        if (resource.accountId !== providers.cloudflare?.accountId) {
          errors.push(`private runtime inventory has the wrong Cloudflare account for ${key}`);
        }
      }
      if (logicalResource.provider === "registry.terraform.io/integrations/github") {
        if (resource.ownerId !== providers.github?.ownerId || resource.repositoryId !== providers.github?.repositoryId) {
          errors.push(`private runtime inventory has the wrong GitHub owner or repository identity for ${key}`);
        }
        if (resource.repository !== providers.github?.repository) {
          errors.push(`private runtime inventory has the wrong GitHub repository name for ${key}`);
        }
        if (!(typeof resource.rulesetId === "string" && /^\d+$/.test(resource.rulesetId)) && !(Number.isInteger(resource.rulesetId) && resource.rulesetId >= 0)) {
          errors.push(`private runtime inventory has an invalid GitHub ruleset ID for ${key}`);
        }
      }
      expectedAddresses.delete(resource.address);
    }
    for (const address of expectedAddresses) {
      errors.push(`private runtime inventory is missing ${root.name}:${address}`);
    }
  }

  for (const logicalRoot of manifest.roots) {
    if (!rootEntries.has(logicalRoot.name)) {
      errors.push(`private runtime inventory is missing root ${logicalRoot.name}`);
    }
  }
  return rootEntries;
}

function validateApproval({ approval, rootName, sourceCommit, configSha256, lockSha256, inventorySha256, savedPlanSha256, planJsonSha256, terraformIdentity, rootEntry, rootInventory, errors }) {
  const approvalObject = asObject(approval, "private plan approval", errors);
  hasOnlyKeys(approvalObject, ["schemaVersion", "root", "sourceCommit", "configSha256", "lockSha256", "inventorySha256", "savedPlanSha256", "planJsonSha256", "terraform", "providers", "workspace"], "private plan approval", errors);
  addError(errors, approvalObject.schemaVersion === 1, "private plan approval schemaVersion must be 1");
  const expected = {
    root: rootName,
    sourceCommit,
    configSha256,
    lockSha256,
    inventorySha256,
    savedPlanSha256,
    planJsonSha256,
  };
  for (const [field, value] of Object.entries(expected)) {
    addError(errors, approvalObject[field] === value, `private plan approval ${field} does not match the current reviewed input`);
  }
  const terraform = asObject(approvalObject.terraform, "private plan approval Terraform identity", errors);
  hasOnlyKeys(terraform, ["version", "binarySha256"], "private plan approval Terraform identity", errors);
  addError(errors, terraform.version === terraformIdentity.version, "private plan approval Terraform version does not match the inspected binary");
  addError(errors, terraform.binarySha256 === terraformIdentity.binarySha256, "private plan approval Terraform binary digest does not match the inspected binary");
  const expectedProviders = Object.fromEntries(rootEntry.providers.map((provider) => [provider, providerVersions[provider]]));
  hasOnlyKeys(approvalObject.providers, Object.keys(expectedProviders), "private plan approval providers", errors);
  addError(errors, JSON.stringify(approvalObject.providers) === JSON.stringify(expectedProviders), "private plan approval provider versions do not match the ownership root");
  const workspace = asObject(approvalObject.workspace, "private plan approval workspace", errors);
  hasOnlyKeys(workspace, ["id", "name", "stateVersionId", "lineage", "serial"], "private plan approval workspace", errors);
  const expectedWorkspace = {
    id: rootInventory?.workspace?.id,
    name: rootInventory?.workspace?.name,
    stateVersionId: rootInventory?.state?.versionId,
    lineage: rootInventory?.state?.lineage,
    serial: rootInventory?.state?.serial,
  };
  for (const [field, value] of Object.entries(expectedWorkspace)) {
    addError(errors, workspace[field] === value, `private plan approval workspace ${field} does not match private runtime inventory`);
  }
  return approvalObject;
}

function isExactStringList(value, expected) {
  return Array.isArray(value) && value.length === expected.length && value.every((item, index) => item === expected[index]);
}

function collectNonPassingChecks(value, paths = [], currentPath = "checks") {
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectNonPassingChecks(item, paths, `${currentPath}[${index}]`));
    return paths;
  }
  if (!isRecord(value)) return paths;
  if (typeof value.status === "string" && value.status !== "pass") {
    paths.push(`${currentPath}:${value.status}`);
  }
  for (const [key, child] of Object.entries(value)) {
    if (key !== "status") collectNonPassingChecks(child, paths, `${currentPath}.${key}`);
  }
  return paths;
}

function validateGitHubRuleset({ after, logicalResource, inventoryResource, errors, address }) {
  if (after.repository !== inventoryResource.repository) {
    errors.push(`Terraform plan has the wrong GitHub repository for ${address}`);
  }
  if (String(after.ruleset_id) !== String(inventoryResource.rulesetId)) {
    errors.push(`Terraform plan has the wrong GitHub ruleset ID for ${address}`);
  }
  if (after.target !== "branch" || after.enforcement !== "active") {
    errors.push(`Terraform plan must keep the active branch target for ${address}`);
  }
  const refName = after.conditions?.[0]?.ref_name?.[0];
  if (!Array.isArray(after.conditions) || after.conditions.length !== 1 || !isExactStringList(refName?.include, logicalResource.targetRefs) || !isExactStringList(refName?.exclude, [])) {
    errors.push(`Terraform plan has the wrong permanent-branch scope for ${address}`);
  }
  if (!Array.isArray(after.rules) || after.rules.length !== 1) {
    errors.push(`Terraform plan must contain one permanent-branch rules block for ${address}`);
    return;
  }
  const rules = after.rules[0];
  if (rules.deletion !== true || rules.non_fast_forward !== true) {
    errors.push(`Terraform plan weakens deletion or non-fast-forward protection for ${address}`);
  }
  const inactiveBooleans = new Set(["creation", "required_linear_history", "required_signatures", "update", "update_allows_fetch_and_merge"]);
  const inactiveLists = new Set([
    "branch_name_pattern",
    "commit_author_email_pattern",
    "commit_message_pattern",
    "committer_email_pattern",
    "copilot_code_review",
    "file_extension_restriction",
    "file_path_restriction",
    "max_file_path_length",
    "max_file_size",
    "merge_queue",
    "pull_request",
    "required_code_scanning",
    "required_deployments",
    "required_status_checks",
    "tag_name_pattern",
  ]);
  for (const [name, value] of Object.entries(rules)) {
    const isInactiveBoolean = inactiveBooleans.has(name) && (value === false || value === null || value === undefined);
    const isInactiveList = inactiveLists.has(name) && Array.isArray(value) && value.length === 0;
    if (!["deletion", "non_fast_forward"].includes(name) && !isInactiveBoolean && !isInactiveList) {
      errors.push(`Terraform plan adds an unreviewed GitHub rule ${name} for ${address}`);
    }
  }
  if (!Array.isArray(after.bypass_actors) || after.bypass_actors.length !== 0) {
    errors.push(`Terraform plan must keep bypass actors empty for ${address}`);
  }
}

function validatePlanProviderConfiguration({ plan, rootName, rootInventory, errors }) {
  const providerConfigs = plan.configuration?.provider_config;
  if (providerConfigs && typeof providerConfigs === "object") {
    for (const provider of Object.values(providerConfigs)) {
      if (provider?.alias) errors.push("Terraform plan declares a provider alias");
    }
  }
  if (plan.configuration?.root_module?.module_calls) {
    errors.push("Terraform plan declares a module dependency");
  }
  const variables = plan.variables ?? {};
  if (rootName === "github-governance") {
    if (variables.github_owner?.value !== rootInventory.providers?.github?.ownerLogin) {
      errors.push("Terraform plan has the wrong GitHub owner input");
    }
    if (variables.github_repository?.value !== rootInventory.providers?.github?.repository) {
      errors.push("Terraform plan has the wrong GitHub repository input");
    }
  }
  if (["preview", "production"].includes(rootName) && variables.cloudflare_account_id?.value !== undefined && variables.cloudflare_account_id.value !== rootInventory.providers?.cloudflare?.accountId) {
    errors.push("Terraform plan has the wrong Cloudflare account input");
  }
}

function validatePlan({ plan, rootName, manifest, rootInventory, errors }) {
  const planObject = asObject(plan, "Terraform show JSON", errors);
  addError(errors, planObject.format_version === "1.2", "Terraform show JSON must use format version 1.2");
  addError(errors, planObject.terraform_version === "1.16.5", "Terraform show JSON must bind Terraform 1.16.5");
  addError(errors, planObject.applyable === false, "Terraform no-op plan must not be applyable");
  addError(errors, planObject.complete === true, "Terraform plan must be complete");
  addError(errors, planObject.errored === false, "Terraform plan must not be errored");
  if (Array.isArray(planObject.deferred_changes) ? planObject.deferred_changes.length > 0 : planObject.deferred_changes !== undefined) {
    errors.push("Terraform plan must not contain deferred changes");
  }
  if (Array.isArray(planObject.resource_drift) ? planObject.resource_drift.length > 0 : planObject.resource_drift !== undefined) {
    errors.push("Terraform plan must not contain resource drift");
  }
  if (planObject.output_changes && typeof planObject.output_changes === "object") {
    for (const [name, change] of Object.entries(planObject.output_changes)) {
      if (collectUnknownPaths(change?.after_unknown, `output_changes.${name}.after_unknown`).length > 0) {
        errors.push(`Terraform plan has an unknown output ${name}`);
      }
    }
  }
  if (planObject.checks !== undefined && !Array.isArray(planObject.checks)) {
    errors.push("Terraform plan checks must be an array when present");
  }
  const nonPassingChecks = collectNonPassingChecks(planObject.checks);
  if (nonPassingChecks.length > 0) {
    errors.push(`Terraform plan has failing, errored, or unknown checks: ${nonPassingChecks.join(", ")}`);
  }

  const allowedResources = new Map(
    manifest.resources
      .filter((resource) => resource.root === rootName)
      .map((resource) => [resource.address, resource]),
  );
  if (allowedResources.size === 0) {
    if (planObject.resource_changes !== undefined && (!Array.isArray(planObject.resource_changes) || planObject.resource_changes.length > 0)) {
      errors.push("Terraform empty root must not contain resource changes");
    }
    validatePlanProviderConfiguration({ plan: planObject, rootName, rootInventory, errors });
    return;
  }
  if (!Array.isArray(planObject.resource_changes)) {
    errors.push("Terraform show JSON resource_changes must be an array for an adopted root");
    return;
  }

  validatePlanProviderConfiguration({ plan: planObject, rootName, rootInventory, errors });
  const seen = new Set();
  for (const change of planObject.resource_changes) {
    const address = change?.address;
    const logicalResource = allowedResources.get(address);
    if (!logicalResource) {
      errors.push(`Terraform plan has an unowned or cross-root resource ${address ?? "missing"}`);
      continue;
    }
    if (seen.has(address)) {
      errors.push(`Terraform plan repeats resource ${address}`);
      continue;
    }
    seen.add(address);
    if (change.provider_name !== logicalResource.provider) {
      errors.push(`Terraform plan uses the wrong provider for ${address}`);
    }
    const actions = change.change?.actions;
    if (!Array.isArray(actions) || actions.length !== 1 || actions[0] !== "no-op") {
      errors.push(`Terraform plan must be a no-op for ${address}`);
    }
    if (change.change?.importing || change.importing) {
      errors.push(`Terraform plan contains an import for ${address}; imports need separate authorization`);
    }
    if (Array.isArray(change.change?.replace_paths) && change.change.replace_paths.length > 0) {
      errors.push(`Terraform plan replaces ${address}`);
    }
    const unknownPaths = collectUnknownPaths(change.change?.after_unknown);
    if (unknownPaths.length > 0) {
      errors.push(`Terraform plan has unknown values for ${address}: ${unknownPaths.join(", ")}`);
    }
    if (logicalResource.expectedName && change.change?.after?.name !== logicalResource.expectedName) {
      errors.push(`Terraform plan has the wrong named resource for ${address}`);
    }
    const inventoryResource = rootInventory.resources?.find((resource) => resource.address === address);
    if (!inventoryResource) {
      errors.push(`private runtime inventory is missing exact identity for ${address}`);
      continue;
    }
    const after = asObject(change.change?.after, `Terraform after state for ${address}`, errors);
    if (after.id !== inventoryResource.resourceId) {
      errors.push(`Terraform plan has the wrong physical resource ID for ${address}`);
    }
    if (logicalResource.provider === "registry.terraform.io/cloudflare/cloudflare") {
      if (after.account_id !== inventoryResource.accountId || after.account_id !== rootInventory.providers?.cloudflare?.accountId) {
        errors.push(`Terraform plan has the wrong Cloudflare account for ${address}`);
      }
    }
    if (logicalResource.provider === "registry.terraform.io/integrations/github") {
      validateGitHubRuleset({ after, logicalResource, inventoryResource, errors, address });
    }
  }
  for (const address of allowedResources.keys()) {
    if (!seen.has(address)) errors.push(`Terraform plan is missing owned resource ${address}`);
  }
}

export async function verifySavedPlan({
  projectRoot = defaultProjectRoot,
  rootName,
  planJsonPath,
  savedPlanPath,
  inventoryPath,
  approvalPath,
  sourceCommit,
  environment = process.env,
  terraformBinary,
  terraformIdentity,
  terraformShowJson,
}) {
  const errors = [];
  let worktreePaths = [];
  try {
    worktreePaths = await resolvedWorktreePaths(projectRoot);
  } catch {
    errors.push("Terraform review could not resolve Git worktree boundaries");
  }
  const environmentErrors = await validateEnvironmentOverrides(environment, worktreePaths);
  errors.push(...environmentErrors);
  if (!/^[a-f0-9]{40}$/.test(sourceCommit ?? "")) {
    errors.push("Terraform review must bind a full source commit SHA");
  }
  let inspectedTerraformIdentity = terraformIdentity;
  try {
    if (terraformBinary && environmentErrors.length === 0) {
      inspectedTerraformIdentity = await readTerraformIdentity(terraformBinary, worktreePaths, environment);
    }
  } catch {
    errors.push("Terraform review could not verify the pinned Terraform binary outside Git worktrees");
  }
  if (!inspectedTerraformIdentity || inspectedTerraformIdentity.version !== "1.16.5" || !sha256Pattern.test(inspectedTerraformIdentity.binarySha256 ?? "")) {
    errors.push("Terraform review requires an inspected Terraform 1.16.5 binary identity");
  }
  if (!terraformBinary && !terraformShowJson) {
    errors.push("Terraform review requires regenerated saved-plan JSON from the inspected binary");
  }

  let privateInputsReadable = true;
  try {
    await Promise.all([
      assertOutsideWorktrees(planJsonPath, worktreePaths),
      assertOutsideWorktrees(savedPlanPath, worktreePaths),
      assertOutsideWorktrees(inventoryPath, worktreePaths),
      assertOutsideWorktrees(approvalPath, worktreePaths),
    ]);
  } catch {
    privateInputsReadable = false;
    errors.push("private Terraform review inputs must exist outside every Git worktree before inspection");
  }
  const configuration = await validateOwnershipConfiguration({ root: projectRoot });
  errors.push(...configuration.errors);
  const manifest = configuration.manifest;
  const rootEntry = manifest.roots.find((entry) => entry.name === rootName);
  if (!rootEntry) errors.push(`unknown Terraform ownership root ${rootName}`);

  let planSource;
  let inventorySource;
  let approvalSource;
  let savedPlanSha256;
  let inventorySha256;
  let planJsonSha256;
  if (privateInputsReadable) {
    try {
      [planSource, inventorySource, approvalSource, savedPlanSha256, inventorySha256, planJsonSha256] = await Promise.all([
        readFile(planJsonPath, "utf8"),
        readFile(inventoryPath, "utf8"),
        readFile(approvalPath, "utf8"),
        digestFile(savedPlanPath),
        digestFile(inventoryPath),
        digestFile(planJsonPath),
      ]);
    } catch {
      errors.push("private Terraform review inputs could not be read");
    }
  }
  let plan;
  let inventory;
  let approval;
  if (planSource !== undefined) {
    try {
      plan = JSON.parse(planSource);
    } catch {
      errors.push("Terraform show JSON is malformed");
    }
    try {
      inventory = JSON.parse(inventorySource);
    } catch {
      errors.push("private runtime inventory is malformed");
    }
    try {
      approval = JSON.parse(approvalSource);
    } catch {
      errors.push("private plan approval is malformed");
    }
  }

  if (planSource !== undefined && privateInputsReadable && environmentErrors.length === 0 && (terraformBinary || terraformShowJson)) {
    try {
      const emittedPlanJson = terraformShowJson
        ? await terraformShowJson({ savedPlanPath, environment })
        : readTerraformShow(terraformBinary, savedPlanPath, environment);
      if (typeof emittedPlanJson !== "string" || digest(emittedPlanJson) !== planJsonSha256) {
        errors.push("Terraform show output does not exactly match the reviewed saved-plan JSON");
      }
    } catch {
      errors.push("Terraform show could not reproduce the reviewed saved-plan JSON");
    }
  }

  const validPlan = isRecord(plan);
  const validInventory = isRecord(inventory);
  const validApproval = isRecord(approval);
  if (planSource !== undefined && !validPlan) errors.push("Terraform show JSON must be a non-array object");
  if (inventorySource !== undefined && !validInventory) errors.push("private runtime inventory must be a non-array object");
  if (approvalSource !== undefined && !validApproval) errors.push("private plan approval must be a non-array object");
  if (inventory !== undefined && approval !== undefined) {
    try {
      errors.push(...await validatePrivateRecordSchemas({ projectRoot, inventory, approval }));
    } catch {
      errors.push("private Terraform review schemas could not validate the operator records");
    }
  }

  let rootDirectory;
  try {
    const resolvedProjectRoot = await realpath(projectRoot);
    rootDirectory = rootEntry && rootEntry.directory === rootDirectories[rootName]
      ? path.join(resolvedProjectRoot, rootDirectories[rootName])
      : undefined;
  } catch {
    errors.push("Terraform review could not resolve its checked-out source root");
  }
  let configSha256;
  let lockSha256;
  try {
    if (!rootDirectory) throw new Error("untrusted root directory");
    configSha256 = await rootConfigurationDigest(rootDirectory);
    lockSha256 = await digestFile(path.join(rootDirectory, ".terraform.lock.hcl"));
  } catch {
    errors.push("Terraform root configuration or lock file could not be read");
  }
  const rootsByName = validInventory ? validateInventory({ inventory, manifest, errors }) : new Map();
  const rootInventory = rootsByName.get(rootName);
  if (!rootInventory && rootEntry) errors.push(`private runtime inventory must provide the selected root ${rootName}`);
  if (validApproval && rootInventory && rootEntry && inspectedTerraformIdentity) {
    validateApproval({
      approval,
      rootName,
      sourceCommit,
      configSha256,
      lockSha256,
      inventorySha256,
      savedPlanSha256,
      planJsonSha256,
      terraformIdentity: inspectedTerraformIdentity,
      rootEntry,
      rootInventory,
      errors,
    });
  }
  if (validPlan && rootEntry && rootInventory) validatePlan({ plan, rootName, manifest, rootInventory, errors });

  return {
    ok: errors.length === 0,
    errors,
    reviewBinding: {
      root: rootName,
      sourceCommit,
      configSha256,
      lockSha256,
      inventorySha256,
      savedPlanSha256,
      planJsonSha256,
      terraformBinarySha256: inspectedTerraformIdentity?.binarySha256,
    },
    limitations: [
      "This offline guard treats supplied inventory and approval JSON as policy input, not as proof of live provider, HCP Terraform workspace, or state identity.",
      "It cannot authorize import or apply. A future authorized activation must independently derive authenticated provider API and Terraform state evidence, refresh it immediately before action, and verify the saved plan again.",
      "HCP Terraform workspace execution and state-protection posture remain activation blockers until independently verified.",
    ],
  };
}

export async function writeTerraformShowJson({ terraformBinary, savedPlanPath, outputPath, projectRoot = defaultProjectRoot, environment = process.env }) {
  const worktreePaths = await resolvedWorktreePaths(projectRoot);
  const errors = await validateEnvironmentOverrides(environment, worktreePaths);
  if (errors.length > 0) throw new Error(errors.join("\n"));
  await assertOutsideWorktrees(savedPlanPath, worktreePaths);
  await resolveExternalOutputPath(outputPath, worktreePaths);
  const terraformIdentity = await readTerraformIdentity(terraformBinary, worktreePaths, environment);
  const result = readTerraformShow(terraformBinary, savedPlanPath, environment);
  await writePrivateTerraformOutput({ outputPath, contents: result, projectRoot });
  return {
    savedPlanSha256: await digestFile(savedPlanPath),
    planJsonSha256: digest(result),
    terraform: terraformIdentity,
  };
}

function currentCleanSource(projectRoot) {
  const commit = execFileSync("git", ["-C", projectRoot, "rev-parse", "HEAD"], { encoding: "utf8" }).trim();
  const status = execFileSync("git", ["-C", projectRoot, "status", "--porcelain"], { encoding: "utf8" });
  if (status.trim()) throw new Error("Terraform review requires a clean exact Git source commit");
  return commit;
}

function parseArguments(argumentsList) {
  const [command, ...items] = argumentsList;
  const values = {};
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    if (!item.startsWith("--") || !items[index + 1]) throw new Error(`invalid argument ${item}`);
    values[item.slice(2)] = items[index + 1];
    index += 1;
  }
  return { command, values };
}

async function runCli() {
  const { command, values } = parseArguments(process.argv.slice(2));
  const projectRoot = values["project-root"] ? path.resolve(values["project-root"]) : defaultProjectRoot;
  if (command === "show") {
    for (const name of ["terraform", "saved-plan", "plan-json"]) {
      if (!values[name]) throw new Error(`show requires --${name}`);
    }
    const result = await writeTerraformShowJson({
      terraformBinary: values.terraform,
      savedPlanPath: values["saved-plan"],
      outputPath: values["plan-json"],
      projectRoot,
    });
    console.log(JSON.stringify(result));
    return;
  }
  if (command !== "verify") throw new Error("use either show or verify; this guard never imports or applies");
  for (const name of ["root", "saved-plan", "plan-json", "inventory", "approval", "terraform"]) {
    if (!values[name]) throw new Error(`verify requires --${name}`);
  }
  const result = await verifySavedPlan({
    projectRoot,
    rootName: values.root,
    savedPlanPath: values["saved-plan"],
    planJsonPath: values["plan-json"],
    inventoryPath: values.inventory,
    approvalPath: values.approval,
    terraformBinary: values.terraform,
    sourceCommit: currentCleanSource(projectRoot),
  });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
