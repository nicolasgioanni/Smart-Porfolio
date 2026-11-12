import { execFile } from "node:child_process";
import { createHash } from "node:crypto";
import { access, constants, lstat, readFile, realpath } from "node:fs/promises";
import path from "node:path";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { evaluatePlan } from "./check-plan.mjs";
import { inspectInfrastructureConfiguration } from "./validate-ownership.mjs";

const execFileAsync = promisify(execFile);
const rootDirectory = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const sha256Pattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;
const accountIdPattern = /^[a-f0-9]{32}$/;
const maxPrivateInputBytes = 25 * 1024 * 1024;
const maxExecutableBytes = 256 * 1024 * 1024;
const commandOptions = { timeout: 30_000, maxBuffer: 5 * 1024 * 1024 };

const stateSpecs = {
  "cloudflare-shared": {
    provider: "registry.terraform.io/cloudflare/cloudflare",
    resources: [
      "module.pages_environments.cloudflare_pages_project.this",
      "module.edge_controls.cloudflare_zone_setting.always_use_https",
      "module.edge_controls.cloudflare_zone_setting.minimum_tls",
      "module.edge_controls.cloudflare_zone_setting.tls_1_3",
      "module.edge_controls.cloudflare_zone_setting.strict_origin_tls",
      "module.edge_controls.cloudflare_turnstile_widget.production",
      "module.edge_controls.cloudflare_turnstile_widget.preview",
      "module.edge_controls.cloudflare_ruleset.contact_rate_limits"
    ]
  },
  "cloudflare-preview": {
    provider: "registry.terraform.io/cloudflare/cloudflare",
    resources: [
      "cloudflare_d1_database.contact_rate_limit",
      "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities",
      "module.preview_access.cloudflare_zero_trust_access_application.preview",
      "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth",
      "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth"
    ]
  },
  "cloudflare-production": {
    provider: "registry.terraform.io/cloudflare/cloudflare",
    resources: ["cloudflare_d1_database.contact_rate_limit"]
  },
  "cloudflare-audit": {
    provider: "registry.terraform.io/cloudflare/cloudflare",
    resources: [
      "cloudflare_queue.audit_events",
      "cloudflare_queue.audit_events_dlq",
      "cloudflare_r2_bucket.application_audit",
      "cloudflare_r2_bucket.release_control",
      "cloudflare_r2_bucket_lock.application_audit",
      "cloudflare_r2_bucket_lock.release_control",
      "cloudflare_r2_bucket_lifecycle.application_audit",
      "cloudflare_r2_bucket_lifecycle.release_control",
      "cloudflare_r2_managed_domain.application_audit",
      "cloudflare_r2_managed_domain.release_control",
      "cloudflare_workers_script.audit_collector",
      "cloudflare_workers_script_subdomain.audit_collector",
      "cloudflare_queue_consumer.audit_collector"
    ]
  },
  "github-governance": {
    provider: "registry.terraform.io/integrations/github",
    resources: ["github_repository_ruleset.permanent_branches"]
  }
};

const hash = (value) => createHash("sha256").update(value).digest("hex");

function hasUnknown(value) {
  if (value === true) return true;
  if (Array.isArray(value)) return value.some(hasUnknown);
  return Boolean(value) && typeof value === "object" && Object.values(value).some(hasUnknown);
}

async function hashFile(filePath) {
  return hash(await readFile(filePath));
}

function outside(root, candidate) {
  const relative = path.relative(root, candidate);
  return relative.startsWith(`..${path.sep}`) || relative === ".." || path.isAbsolute(relative);
}

function onlyKeys(value, keys, label, errors) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    errors.push(`${label} must be an object`);
    return false;
  }
  const actual = Object.keys(value).sort();
  const expected = [...keys].sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    errors.push(`${label} has unsupported or missing fields`);
    return false;
  }
  return true;
}

async function run(command, argumentsList, options = {}) {
  return execFileAsync(command, argumentsList, { ...commandOptions, ...options });
}

async function worktrees(projectRoot) {
  let stdout;
  try { ({ stdout } = await run("git", ["-C", projectRoot, "worktree", "list", "--porcelain"])); }
  catch { throw new Error("unable to inspect Git worktrees"); }
  return Promise.all(stdout.split(/\r?\n/)
    .filter((line) => line.startsWith("worktree "))
    .map((line) => realpath(line.slice("worktree ".length))));
}

async function privateInput(filePath, worktreePaths, label, errors, { executable = false, maxBytes = maxPrivateInputBytes } = {}) {
  if (!path.isAbsolute(filePath ?? "")) {
    errors.push(`${label} must be an absolute path outside every Git worktree`);
    return undefined;
  }
  let entry;
  try { entry = await lstat(filePath); }
  catch { errors.push(`${label} cannot be resolved`); return undefined; }
  if (entry.isSymbolicLink() || !entry.isFile() || entry.size > maxBytes) {
    errors.push(`${label} must be a bounded regular file`);
    return undefined;
  }
  if (executable) {
    try { await access(filePath, constants.X_OK); }
    catch { errors.push(`${label} must be executable`); return undefined; }
  }
  let resolved;
  try { resolved = await realpath(filePath); }
  catch { errors.push(`${label} cannot be resolved`); return undefined; }
  if (worktreePaths.some((worktree) => !outside(worktree, resolved))) {
    errors.push(`${label} must stay outside every Git worktree before inspection`);
    return undefined;
  }
  return resolved;
}

async function inspectedTerraform(terraformBinary, worktreePaths) {
  const errors = [];
  const binary = await privateInput(terraformBinary, worktreePaths, "Terraform binary", errors, { executable: true, maxBytes: maxExecutableBytes });
  if (!binary) throw new Error("Terraform binary must be an absolute executable outside every Git worktree");
  let stdout;
  try { ({ stdout } = await run(binary, ["version", "-json"])); }
  catch { throw new Error("Terraform version inspection failed"); }
  let version;
  try { version = JSON.parse(stdout).terraform_version; }
  catch { throw new Error("Terraform version inspection did not return JSON"); }
  if (version !== "1.16.5") throw new Error("Terraform binary must report version 1.16.5");
  return { binary, version, binarySha256: await hashFile(binary) };
}

async function configurationRecords(projectRoot, state) {
  try { return await inspectInfrastructureConfiguration(projectRoot, state); }
  catch { throw new Error("reviewed Terraform configuration closure is invalid"); }
}

function digestRecords(records, filter = () => true) {
  return hash(records.filter(filter).map((record) => `${record.relativePath}\0${record.content}`).join("\0"));
}

export async function configurationDigest(projectRoot, state) {
  return digestRecords(await configurationRecords(projectRoot, state));
}

export async function lockDigest(projectRoot, state) {
  return digestRecords(await configurationRecords(projectRoot, state), (record) => record.lock);
}

function governanceIsExact(values) {
  if (!values || typeof values !== "object" || Array.isArray(values)) return false;
  const allowedValues = new Set(["id", "node_id", "repository", "name", "target", "enforcement", "bypass_actors", "conditions", "rules"]);
  if (Object.keys(values).some((key) => !allowedValues.has(key))) return false;
  if (values.repository !== "Smart-Porfolio" || values.name !== "protect-permanent-branches" || values.target !== "branch" || values.enforcement !== "active") return false;
  if (!Array.isArray(values.bypass_actors) || values.bypass_actors.length !== 0) return false;
  if (!Array.isArray(values.conditions) || values.conditions.length !== 1) return false;
  const [condition] = values.conditions;
  if (!condition || typeof condition !== "object" || Array.isArray(condition) || Object.keys(condition).length !== 1 || !Array.isArray(condition.ref_name) || condition.ref_name.length !== 1) return false;
  const [refName] = condition.ref_name;
  if (!refName || typeof refName !== "object" || Array.isArray(refName) || Object.keys(refName).length !== 2 || JSON.stringify(refName.include) !== JSON.stringify(["refs/heads/main", "refs/heads/develop"]) || !Array.isArray(refName.exclude) || refName.exclude.length !== 0) return false;
  if (!Array.isArray(values.rules) || values.rules.length !== 1) return false;
  const [rule] = values.rules;
  return Boolean(rule) && typeof rule === "object" && !Array.isArray(rule) && Object.keys(rule).length === 2 && rule.deletion === true && rule.non_fast_forward === true;
}

function planErrors(state, plan, errors) {
  const spec = stateSpecs[state];
  if (!spec) { errors.push("unknown infrastructure state"); return; }
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) { errors.push("Terraform show JSON must be an object"); return; }
  if (!/^1\./.test(plan.format_version ?? "") || plan.terraform_version !== "1.16.5") errors.push("plan must use Terraform JSON format 1.x from Terraform 1.16.5");
  if (plan.complete !== true || plan.errored === true || plan.applyable !== false) errors.push("saved plan must be complete, non-errored, and a no-op");
  if (Array.isArray(plan.deferred_changes) && plan.deferred_changes.length) errors.push("saved plan contains deferred changes");
  if (Array.isArray(plan.resource_drift) && plan.resource_drift.length) errors.push("saved plan reports resource drift");
  if (Object.values(plan.output_changes ?? {}).some((output) => hasUnknown(output?.after_unknown))) errors.push("saved plan contains unknown output values");
  if (Array.isArray(plan.checks) && plan.checks.some((check) => check?.status !== "pass" || (Array.isArray(check.instances) && check.instances.some((instance) => instance?.status !== "pass")))) errors.push("saved plan contains failing or unknown checks");
  if (!Array.isArray(plan.resource_changes)) { errors.push("saved plan lacks resource changes"); return; }
  const expected = new Set(spec.resources);
  const seen = new Set();
  for (const change of plan.resource_changes) {
    if (!change || typeof change !== "object" || !expected.has(change.address)) {
      errors.push("saved plan contains an unowned or cross-state resource");
      continue;
    }
    if (seen.has(change.address)) errors.push("saved plan repeats a protected resource");
    seen.add(change.address);
    if (change.provider_name !== spec.provider) errors.push("saved plan uses an unexpected provider");
    const detail = change.change;
    if (!detail || !Array.isArray(detail.actions) || detail.actions.length !== 1 || detail.actions[0] !== "no-op") errors.push("saved plan changes a protected resource");
    if (detail?.importing) errors.push("saved plan contains an import");
    if (Array.isArray(detail?.replace_paths) && detail.replace_paths.length) errors.push("saved plan replaces a protected resource");
    if (hasUnknown(detail?.after_unknown)) errors.push("saved plan contains unknown values");
  }
  for (const address of expected) if (!seen.has(address)) errors.push("saved plan is missing a protected resource");
  if (state === "github-governance" && !governanceIsExact(plan.resource_changes.find((change) => change.address === "github_repository_ruleset.permanent_branches")?.change?.after)) {
    errors.push("saved plan changes the exact single permanent-branch ruleset");
  }
}

function physicalId(value) {
  return (typeof value === "string" || Number.isSafeInteger(value)) && String(value).length > 0 && String(value).length <= 512 && !/[\0\r\n]/.test(String(value));
}

function inventoryErrors(state, inventory, plan, errors) {
  const spec = stateSpecs[state];
  if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
    errors.push("private resource inventory requires a Terraform show JSON object");
    return;
  }
  if (!onlyKeys(inventory, state.startsWith("cloudflare-") ? ["accountId", "resources", "schemaVersion", "state"] : ["repository", "repositoryId", "resources", "schemaVersion", "state"], "private resource inventory", errors)) return;
  if (inventory.schemaVersion !== 1 || inventory.state !== state) {
    errors.push("private resource inventory does not bind the reviewed state");
    return;
  }
  if (state.startsWith("cloudflare-")) {
    if (typeof inventory.accountId !== "string" || !accountIdPattern.test(inventory.accountId) || plan.variables?.cloudflare_account_id?.value !== inventory.accountId) errors.push("private resource inventory does not bind the Cloudflare account");
  } else if (inventory.repository !== "nicolasgioanni/Smart-Porfolio" || !physicalId(inventory.repositoryId)) {
    errors.push("private resource inventory does not bind the GitHub repository");
  }
  if (!onlyKeys(inventory.resources, spec.resources, "private resource inventory IDs", errors) || !Object.values(inventory.resources).every(physicalId)) {
    errors.push("private resource inventory IDs are invalid");
    return;
  }
  for (const address of spec.resources) {
    const actual = plan.resource_changes?.find((change) => change?.address === address)?.change?.after?.id;
    if (!physicalId(actual) || String(actual) !== String(inventory.resources[address])) {
      errors.push("saved plan resource IDs do not match the private inventory");
      return;
    }
  }
}

function approvalErrors(approval, expected, errors) {
  if (!onlyKeys(approval, ["configurationDigest", "inventoryDigest", "lockDigest", "planDigest", "savedPlanDigest", "schemaVersion", "sourceCommit", "state", "terraform", "workspace"], "private saved-plan approval", errors)) return;
  if (approval.schemaVersion !== 2 || approval.state !== expected.state || approval.sourceCommit !== expected.sourceCommit || approval.configurationDigest !== expected.configurationDigest || approval.lockDigest !== expected.lockDigest || approval.inventoryDigest !== expected.inventoryDigest || approval.planDigest !== expected.planDigest || approval.savedPlanDigest !== expected.savedPlanDigest) errors.push("private saved-plan approval does not bind the current state, source, configuration, locks, inventory, and saved plan");
  if (!onlyKeys(approval.terraform, ["binarySha256", "version"], "private saved-plan approval Terraform identity", errors) || approval.terraform.version !== expected.terraform.version || approval.terraform.binarySha256 !== expected.terraform.binarySha256) errors.push("private saved-plan approval does not bind the inspected Terraform binary");
  if (!onlyKeys(approval.workspace, ["id", "lineage", "serial", "stateVersionId"], "private saved-plan approval workspace", errors) || !Object.values(approval.workspace).every((value) => typeof value === "string" ? value.length > 0 : Number.isSafeInteger(value) && value >= 0)) errors.push("private saved-plan approval workspace identity is invalid");
}

export async function inspectCleanSource(projectRoot) {
  let status;
  let sourceCommit;
  try {
    ({ stdout: status } = await run("git", ["-C", projectRoot, "status", "--porcelain=v1", "--untracked-files=all"]));
    ({ stdout: sourceCommit } = await run("git", ["-C", projectRoot, "rev-parse", "HEAD"]));
  } catch { throw new Error("unable to inspect the source checkout"); }
  if (status !== "") throw new Error("saved-plan verification requires a clean source checkout");
  const commit = sourceCommit.trim();
  if (!commitPattern.test(commit)) throw new Error("source checkout does not resolve to a full commit SHA");
  return { sourceCommit: commit };
}

async function canonicalPlanEvaluation({ state, plan, collectorSeal, opa }) {
  return evaluatePlan({ state, plan, collectorSeal, opa });
}

export async function verifySavedPlan({ projectRoot = rootDirectory, state, sourceCommit, savedPlanPath, planJsonPath, approvalPath, inventoryPath, collectorSealPath, opa, terraformIdentity, terraformShowJson, planEvaluator = canonicalPlanEvaluation, sourceInspector = inspectCleanSource, environment = process.env }) {
  const errors = [];
  if (!stateSpecs[state]) errors.push("unknown infrastructure state");
  if (!commitPattern.test(sourceCommit ?? "")) errors.push("source commit must be a full lowercase SHA");
  if (!terraformIdentity || terraformIdentity.version !== "1.16.5" || !sha256Pattern.test(terraformIdentity.binarySha256 ?? "")) errors.push("saved-plan verification requires the inspected Terraform 1.16.5 binary identity");
  if (typeof terraformShowJson !== "function") errors.push("saved-plan verification requires a read-only Terraform show callback");
  if (typeof planEvaluator !== "function" || typeof sourceInspector !== "function") errors.push("saved-plan verification requires canonical source and policy evaluators");
  for (const key of Object.keys(environment)) if (key === "TF_WORKSPACE" || key === "TF_CLI_CONFIG_FILE" || key === "TF_CLI_ARGS" || key.startsWith("TF_CLI_ARGS_") || key === "TF_LOG" || key.startsWith("TF_LOG_")) errors.push(`${key} must not override saved-plan verification`);
  let inspectedSource;
  try { inspectedSource = await sourceInspector(projectRoot); }
  catch { errors.push("saved-plan verification requires a clean source checkout"); }
  if (inspectedSource?.sourceCommit !== sourceCommit) errors.push("saved-plan approval source commit does not match the clean checkout");
  let paths;
  try { paths = await worktrees(projectRoot); }
  catch { errors.push("unable to inspect Git worktrees"); }
  if (!paths) return { ok: false, errors };
  const [saved, shown, approval, inventory, sealedCollector] = await Promise.all([
    privateInput(savedPlanPath, paths, "saved plan", errors),
    privateInput(planJsonPath, paths, "plan JSON", errors),
    privateInput(approvalPath, paths, "approval record", errors),
    privateInput(inventoryPath, paths, "private resource inventory", errors),
    collectorSealPath ? privateInput(collectorSealPath, paths, "collector seal", errors) : Promise.resolve(undefined)
  ]);
  if (state === "cloudflare-audit" && !sealedCollector) errors.push("cloudflare-audit requires a private collector seal");
  if (state !== "cloudflare-audit" && collectorSealPath) errors.push("collector seal is only valid for cloudflare-audit");
  if (errors.length || !saved || !shown || !approval || !inventory) return { ok: false, errors };
  let plan;
  let record;
  let privateInventory;
  let collectorSeal;
  let regenerated;
  try { plan = JSON.parse(await readFile(shown, "utf8")); } catch { errors.push("Terraform show JSON is malformed"); }
  try { record = JSON.parse(await readFile(approval, "utf8")); } catch { errors.push("private saved-plan approval is malformed"); }
  try { privateInventory = JSON.parse(await readFile(inventory, "utf8")); } catch { errors.push("private resource inventory is malformed"); }
  if (sealedCollector) {
    try { collectorSeal = JSON.parse(await readFile(sealedCollector, "utf8")); } catch { errors.push("private collector seal is malformed"); }
  }
  try { regenerated = await terraformShowJson(saved); } catch { errors.push("Terraform show failed for the saved plan"); }
  if (typeof regenerated !== "string") errors.push("Terraform show did not return rendered JSON text");
  else if (hash(regenerated) !== await hashFile(shown)) errors.push("regenerated Terraform show output does not exactly match the reviewed plan JSON");
  planErrors(state, plan, errors);
  inventoryErrors(state, privateInventory, plan, errors);
  let configuration;
  let locks;
  try {
    [configuration, locks] = await Promise.all([configurationDigest(projectRoot, state), lockDigest(projectRoot, state)]);
  } catch { errors.push("reviewed Terraform configuration closure is invalid"); }
  approvalErrors(record, {
    state,
    sourceCommit,
    configurationDigest: configuration,
    lockDigest: locks,
    inventoryDigest: await hashFile(inventory),
    planDigest: await hashFile(shown),
    savedPlanDigest: await hashFile(saved),
    terraform: terraformIdentity
  }, errors);
  if (!errors.length) {
    try { await planEvaluator({ state, plan, collectorSeal, opa }); }
    catch { errors.push("canonical Terraform plan policy evaluation failed"); }
  }
  if (!errors.length) return { ok: true, errors: [], reviewBinding: { state, sourceCommit, savedPlanDigest: await hashFile(saved), planDigest: await hashFile(shown), inventoryDigest: await hashFile(inventory) } };
  return { ok: false, errors };
}

function parseArguments(values) {
  const allowed = new Set(["--state", "--terraform", "--saved-plan", "--plan-json", "--approval", "--inventory", "--opa", "--collector-seal"]);
  if (values.length % 2 || values.some((value, index) => index % 2 === 0 && !allowed.has(value))) throw new Error("invalid saved-plan arguments");
  const options = Object.fromEntries(values.reduce((pairs, value, index) => index % 2 === 0 ? [...pairs, [value, values[index + 1]]] : pairs, []));
  if (Object.keys(options).length !== values.length / 2 || ["--state", "--terraform", "--saved-plan", "--plan-json", "--approval", "--inventory", "--opa"].some((key) => !options[key])) throw new Error("Usage: saved-plan.mjs --state <state> --terraform <absolute binary> --saved-plan <absolute path> --plan-json <absolute path> --approval <absolute path> --inventory <absolute path> --opa <absolute binary> [--collector-seal <absolute path>]");
  return options;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const paths = await worktrees(rootDirectory);
  const identity = await inspectedTerraform(options["--terraform"], paths);
  const opaErrors = [];
  const opa = await privateInput(options["--opa"], paths, "OPA binary", opaErrors, { executable: true, maxBytes: maxExecutableBytes });
  if (!opa) throw new Error("OPA binary must be an absolute executable outside every Git worktree");
  const source = await inspectCleanSource(rootDirectory);
  const result = await verifySavedPlan({
    state: options["--state"], sourceCommit: source.sourceCommit, savedPlanPath: options["--saved-plan"], planJsonPath: options["--plan-json"], approvalPath: options["--approval"], inventoryPath: options["--inventory"], collectorSealPath: options["--collector-seal"], opa, terraformIdentity: identity,
    terraformShowJson: async (savedPlan) => (await run(identity.binary, ["show", "-json", savedPlan], { maxBuffer: maxPrivateInputBytes })).stdout
  });
  if (!result.ok) throw new Error(result.errors.join("; "));
  process.stdout.write(`${JSON.stringify(result.reviewBinding, null, 2)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
