#!/usr/bin/env node
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { lstatSync, readFileSync } from "node:fs";
import { isDeepStrictEqual } from "node:util";
import { readFile } from "node:fs/promises";
import process from "node:process";
import { fileURLToPath } from "node:url";
import { isAbsolute, resolve } from "node:path";

const CLOUDFLARE_PROVIDER = "registry.terraform.io/cloudflare/cloudflare";
const GITHUB_PROVIDER = "registry.terraform.io/integrations/github";
const ACCOUNT_ID = /^[a-f0-9]{32}$/;
const UNKNOWN_VALUE = Symbol("unknown Terraform plan value");
const SHA256 = /^[a-f0-9]{64}$/;

const stateSpecs = {
  "cloudflare-shared": {
    provider: CLOUDFLARE_PROVIDER,
    exact: {
      cloudflare_pages_project: 1,
      cloudflare_zone_setting: 4,
      cloudflare_turnstile_widget: 2,
      cloudflare_ruleset: 1,
    },
  },
  "cloudflare-preview": {
    provider: CLOUDFLARE_PROVIDER,
    exact: {
      cloudflare_d1_database: 1,
      cloudflare_zero_trust_access_application: 2,
      cloudflare_zero_trust_access_policy: 2,
    },
  },
  "cloudflare-production": {
    provider: CLOUDFLARE_PROVIDER,
    exact: { cloudflare_d1_database: 1 },
  },
  "cloudflare-audit": {
    provider: CLOUDFLARE_PROVIDER,
    exact: {
      cloudflare_queue: 2,
      cloudflare_r2_bucket: 2,
      cloudflare_r2_bucket_lock: 2,
      cloudflare_r2_bucket_lifecycle: 2,
      cloudflare_r2_managed_domain: 2,
      cloudflare_workers_script: 1,
      cloudflare_workers_script_subdomain: 1,
      cloudflare_queue_consumer: 1,
    },
  },
  "github-governance": {
    provider: GITHUB_PROVIDER,
    exact: { github_repository_ruleset: 1 },
  },
};

const securityPaths = {
  cloudflare_pages_project: ["account_id", "name", "production_branch", "deployment_configs.production.compatibility_date", "deployment_configs.production.fail_open", "deployment_configs.production.d1_databases.CONTACT_RATE_LIMIT_DB.id", "deployment_configs.preview.compatibility_date", "deployment_configs.preview.fail_open", "deployment_configs.preview.d1_databases.CONTACT_RATE_LIMIT_DB.id"],
  cloudflare_zone_setting: ["setting_id", "value", "zone_id"],
  cloudflare_turnstile_widget: ["account_id", "name", "domains", "mode", "clearance_level"],
  cloudflare_ruleset: ["kind", "phase", "zone_id", "rules.*.expression", "rules.*.action", "rules.*.enabled", "rules.*.action_parameters.response.status_code", "rules.*.action_parameters.response.content_type", "rules.*.action_parameters.response.content", "rules.*.ratelimit.characteristics", "rules.*.ratelimit.period", "rules.*.ratelimit.requests_per_period", "rules.*.ratelimit.mitigation_timeout"],
  cloudflare_d1_database: ["account_id", "name"],
  cloudflare_zero_trust_access_application: ["account_id", "zone_id", "name", "domain", "type", "allow_authenticate_via_warp", "auto_redirect_to_identity", "options_preflight_bypass", "policies.*.id", "policies.*.precedence"],
  cloudflare_zero_trust_access_policy: ["account_id", "name", "decision", "include", "exclude", "require"],
  cloudflare_queue: ["account_id", "queue_name", "settings.message_retention_period", "settings.delivery_delay"],
  cloudflare_r2_bucket: ["account_id", "name"],
  cloudflare_r2_bucket_lock: ["account_id", "bucket_name", "rules.*.id", "rules.*.enabled", "rules.*.prefix", "rules.*.condition.type", "rules.*.condition.max_age_seconds"],
  cloudflare_r2_bucket_lifecycle: ["account_id", "bucket_name", "rules.*.id", "rules.*.enabled", "rules.*.conditions.prefix", "rules.*.delete_objects_transition.condition.type", "rules.*.delete_objects_transition.condition.max_age"],
  cloudflare_r2_managed_domain: ["account_id", "bucket_name", "enabled"],
  cloudflare_workers_script: ["account_id", "script_name", "content_file", "content_sha256", "main_module", "compatibility_date", "bindings.*.name", "bindings.*.type", "bindings.*.bucket_name"],
  cloudflare_workers_script_subdomain: ["account_id", "script_name", "enabled", "previews_enabled"],
  cloudflare_queue_consumer: ["account_id", "type", "script_name", "dead_letter_queue", "settings.batch_size", "settings.max_wait_time_ms", "settings.max_retries"],
  github_repository_ruleset: ["repository", "name", "target", "enforcement", "bypass_actors", "conditions.*.ref_name.*.include", "conditions.*.ref_name.*.exclude", "rules.*.deletion", "rules.*.non_fast_forward"],
};

const computedSecurityLeaves = {
  cloudflare_zero_trust_access_application: ["policies.*.id"],
};

function argument(name) {
  const index = process.argv.indexOf(name);
  return index === -1 ? undefined : process.argv[index + 1];
}

function fail(message) {
  throw new Error(`Plan gate: ${message}`);
}

function collectResources(module, resources = []) {
  if (!module || typeof module !== "object" || Array.isArray(module)) fail("planned_values.root_module must be an object");
  if (module.resources !== undefined) {
    if (!Array.isArray(module.resources)) fail("module resources must be an array");
    for (const resource of module.resources) {
      if (!resource || typeof resource !== "object" || Array.isArray(resource)) fail("planned resource must be an object");
      if (resource.mode !== "managed") fail(`planned ${resource.address ?? resource.type ?? "resource"} must be managed`);
      if (typeof resource.address !== "string" || !resource.address) fail("planned resource has no address");
      if (typeof resource.type !== "string" || !resource.type) fail(`planned ${resource.address} has no type`);
      if (typeof resource.name !== "string" || !resource.name) fail(`planned ${resource.address} has no name`);
      if (!resource.values || typeof resource.values !== "object" || Array.isArray(resource.values)) fail(`planned ${resource.address} has no values object`);
      resources.push(resource);
    }
  }
  if (module.child_modules !== undefined && !Array.isArray(module.child_modules)) fail("child_modules must be an array");
  for (const child of module.child_modules ?? []) collectResources(child, resources);
  return resources;
}

function countByType(resources, type) {
  return resources.filter((resource) => resource.type === type).length;
}

function isAllowedResource(spec, resource) {
  return Object.hasOwn(spec.exact, resource.type)
    || Object.hasOwn(spec.optional ?? {}, resource.type);
}

function assertResourceInventory(state, resources) {
  const spec = stateSpecs[state];
  const addresses = new Set();
  for (const resource of resources) {
    if (addresses.has(resource.address)) fail(`planned_values repeats resource address ${resource.address}`);
    addresses.add(resource.address);
    if (!isAllowedResource(spec, resource)) fail(`${state} plan declares unsupported resource ${resource.address} (${resource.type})`);
    if (resource.provider_name !== spec.provider) {
      fail(`${resource.address} uses an unexpected provider ${resource.provider_name ?? "(none)"}`);
    }
  }
  for (const [type, expected] of Object.entries(spec.exact)) {
    const actual = countByType(resources, type);
    if (actual !== expected) fail(`${state} requires exactly ${expected} ${type} resource${expected === 1 ? "" : "s"}; found ${actual}`);
  }
  for (const [type, maximum] of Object.entries(spec.optional ?? {})) {
    const actual = countByType(resources, type);
    if (actual > maximum) fail(`${state} permits at most ${maximum} ${type} resources; found ${actual}`);
  }
}

function validateUnknownTree(node, path = []) {
  if (typeof node === "boolean") return;
  if (Array.isArray(node)) {
    node.forEach((entry, index) => validateUnknownTree(entry, [...path, String(index)]));
    return;
  }
  if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) validateUnknownTree(value, [...path, key]);
    return;
  }
  fail(`after_unknown contains a malformed scalar at ${path.join(".") || "root"}`);
}

function knownValues(value, unknown) {
  if (unknown === true) return UNKNOWN_VALUE;
  if (unknown === false || unknown === undefined) return value;
  if (Array.isArray(unknown)) {
    if (!Array.isArray(value)) return value;
    return Array.from({ length: Math.max(value.length, unknown.length) }, (_, index) => knownValues(value[index], unknown[index]));
  }
  if (!unknown || typeof unknown !== "object") return value;
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const normalized = {};
  for (const key of new Set([...Object.keys(value), ...Object.keys(unknown)])) {
    normalized[key] = knownValues(value[key], unknown[key]);
  }
  return normalized;
}

function validateChanges(resources, changes) {
  if (!Array.isArray(changes) || changes.length === 0) fail("requires a non-empty resource_changes array that covers every planned resource");
  const plannedByAddress = new Map(resources.map((resource) => [resource.address, resource]));
  const seen = new Set();
  for (const change of changes) {
    if (!change || typeof change !== "object" || Array.isArray(change)) fail("resource_changes contains a malformed entry");
    if (typeof change.address !== "string" || !change.address) fail("resource change has no address");
    if (seen.has(change.address)) fail(`resource_changes repeats ${change.address}`);
    seen.add(change.address);
    const planned = plannedByAddress.get(change.address);
    if (!planned) fail(`resource_changes includes ${change.address}, which is absent from planned_values`);
    for (const property of ["mode", "type", "name", "provider_name"]) {
      if (change[property] !== planned[property]) fail(`resource_changes ${change.address} does not match planned_values.${property}`);
    }
    if (!change.change || typeof change.change !== "object" || Array.isArray(change.change)) fail(`resource_changes ${change.address} has no change object`);
    if (!Array.isArray(change.change.actions) || change.change.actions.length === 0 || !change.change.actions.every((action) => typeof action === "string")) {
      fail(`resource_changes ${change.address} has invalid actions`);
    }
    if (change.change.actions.includes("delete")) fail("plan includes deletion or replacement; security state changes require a separately reviewed migration");
    if (change.change.actions.length !== 1 || !["create", "update", "no-op"].includes(change.change.actions[0])) fail(`resource_changes ${change.address} has an unsupported action vector`);
    if (!Object.hasOwn(change.change, "after")) fail(`resource_changes ${change.address} has no after values`);
    if (!change.change.after_unknown || typeof change.change.after_unknown !== "object" || Array.isArray(change.change.after_unknown)) {
      fail(`resource_changes ${change.address} has no after_unknown object`);
    }
    validateUnknownTree(change.change.after_unknown);
    if (!isDeepStrictEqual(knownValues(change.change.after, change.change.after_unknown), knownValues(planned.values, change.change.after_unknown))) {
      fail(`resource_changes ${change.address}.change.after does not match known planned_values`);
    }
  }
  for (const resource of resources) {
    if (!seen.has(resource.address)) fail(`planned_values resource ${resource.address} is missing from resource_changes`);
  }
}

function unknownLeaves(node, prefix = [], leaves = []) {
  if (node === true) {
    leaves.push(prefix);
  } else if (Array.isArray(node)) {
    node.forEach((entry, index) => unknownLeaves(entry, [...prefix, String(index)], leaves));
  } else if (node && typeof node === "object") {
    for (const [key, value] of Object.entries(node)) unknownLeaves(value, [...prefix, key], leaves);
  }
  return leaves;
}

function pathMatches(pattern, path) {
  const segments = pattern.split(".");
  return segments.length === path.length && segments.every((segment, index) => segment === "*" || segment === path[index]);
}

function pathOverlaps(pattern, path) {
  const segments = pattern.split(".");
  const length = Math.min(segments.length, path.length);
  return Array.from({ length }, (_, index) => segments[index] === "*" || segments[index] === path[index]).every(Boolean);
}

function validateKnownSecurityValues(resources, changes) {
  const changesByAddress = new Map(changes.map((change) => [change.address, change]));
  for (const resource of resources) {
    const paths = securityPaths[resource.type] ?? [];
    const allowed = computedSecurityLeaves[resource.type] ?? [];
    const leaves = unknownLeaves(changesByAddress.get(resource.address).change.after_unknown);
    for (const path of leaves) {
      if (!paths.some((pattern) => pathOverlaps(pattern, path))) continue;
      if (allowed.some((pattern) => pathMatches(pattern, path))) continue;
      fail(`${resource.address} leaves required security value ${path.join(".")} unknown`);
    }
  }
}

function validateCloudflareAccount(state, plan, resources) {
  if (!state.startsWith("cloudflare-")) return;
  const account = plan.variables?.cloudflare_account_id?.value;
  if (typeof account !== "string" || !ACCOUNT_ID.test(account)) {
    fail("requires the saved plan to include a concrete cloudflare_account_id variable value");
  }
  for (const resource of resources) {
    if (!resource.type.startsWith("cloudflare_")) continue;
    if (typeof resource.values.account_id === "string" && resource.values.account_id !== account) {
      fail(`${resource.address} account_id does not match plan.variables.cloudflare_account_id`);
    }
  }
}

function parseCollectorSeal(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) fail("cloudflare-audit requires a verified collector seal");
  const keys = Object.keys(value).sort();
  const expected = ["collectorBundlePath", "collectorBundleSha256", "collectorConfigSha256", "contentHash", "sourceCommit", "sourceMode", "target", "toolchainWrangler", "version"];
  if (keys.length !== expected.length || keys.some((key, index) => key !== expected[index])) fail("collector seal has unsupported fields");
  if (value.version !== 1 || typeof value.collectorBundlePath !== "string" || !isAbsolute(value.collectorBundlePath) || !SHA256.test(value.collectorBundleSha256) || !SHA256.test(value.collectorConfigSha256) || !SHA256.test(value.contentHash) || !/^[a-f0-9]{40}$/.test(value.sourceCommit) || value.sourceMode !== "remote" || !["preview", "production"].includes(value.target) || !/^\d+\.\d+\.\d+$/.test(value.toolchainWrangler)) {
    fail("collector seal is malformed or nondeployable");
  }
  return value;
}

function validateCollectorPlanBinding(state, resources, collectorSeal) {
  if (state !== "cloudflare-audit") return undefined;
  const seal = parseCollectorSeal(collectorSeal);
  const scripts = resources.filter((resource) => resource.type === "cloudflare_workers_script");
  if (scripts.length !== 1) fail("cloudflare-audit plan must contain exactly one collector Worker script");
  const values = scripts[0].values;
  const plannedPath = values.content_file;
  if (typeof plannedPath !== "string" || resolve(plannedPath) !== resolve(seal.collectorBundlePath)) {
    fail("collector Worker content_file does not match the verified sealed collector path");
  }
  if (values.content_sha256 !== seal.collectorBundleSha256) {
    fail("collector Worker content_sha256 does not match the verified sealed collector digest");
  }
  let entry;
  try { entry = lstatSync(seal.collectorBundlePath); } catch { fail("verified sealed collector bundle is unavailable"); }
  if (!entry.isFile() || entry.isSymbolicLink()) fail("verified sealed collector bundle is not a regular file");
  const actualDigest = createHash("sha256").update(readFileSync(seal.collectorBundlePath)).digest("hex");
  if (actualDigest !== seal.collectorBundleSha256) fail("verified sealed collector bundle bytes no longer match its digest");
  return seal;
}

export function validatePlan(state, plan) {
  if (!stateSpecs[state]) fail(`unknown or missing --state (${state ?? "none"})`);
  if (!plan || typeof plan !== "object" || Array.isArray(plan) || !/^1\./.test(plan.format_version ?? "")) fail("requires a Terraform JSON plan with format_version 1.x");
  if (plan.complete === false) fail("rejects an incomplete Terraform plan");
  if (plan.errored === true) fail("rejects an errored Terraform plan");
  if (Object.hasOwn(plan, "deferred_changes")) fail("rejects a Terraform plan with deferred_changes");
  if (typeof plan.terraform_version !== "string" || !plan.terraform_version) fail("requires terraform_version");
  if (!plan.planned_values || typeof plan.planned_values !== "object" || Array.isArray(plan.planned_values)) fail("requires planned_values");
  const resources = collectResources(plan.planned_values.root_module);
  if (resources.length === 0) fail("contains zero planned resources");
  assertResourceInventory(state, resources);
  validateChanges(resources, plan.resource_changes);
  validateKnownSecurityValues(resources, plan.resource_changes);
  validateCloudflareAccount(state, plan, resources);
  return { resources, types: new Set(resources.map((resource) => resource.type)) };
}

function opaEvaluation(opa, query, input) {
  let raw;
  try {
    raw = execFileSync(opa, ["eval", "--format=json", "--data", fileURLToPath(new URL("./policies/plan.rego", import.meta.url)), "--stdin-input", query], {
      input: JSON.stringify(input), encoding: "utf8", maxBuffer: 5 * 1024 * 1024,
    });
  } catch (error) {
    fail(`OPA evaluation failed: ${error.stderr || error.message}`);
  }
  try {
    return JSON.parse(raw).result?.[0]?.expressions?.[0]?.value;
  } catch {
    fail("OPA returned malformed JSON");
  }
}

export function evaluatePlan({ state, plan, collectorSeal, opa = process.env.OPA_BIN ?? "opa" }) {
  const { resources, types } = validatePlan(state, plan);
  const verifiedCollectorSeal = validateCollectorPlanBinding(state, resources, collectorSeal);
  const input = { state, plan, collectorSeal: verifiedCollectorSeal ?? null };
  const denied = opaEvaluation(opa, "data.smartportfolio.plan.deny", input);
  if (!Array.isArray(denied)) fail("OPA did not return a deny array");
  if (denied.length) fail(denied.join("; "));
  const covered = opaEvaluation(opa, "data.smartportfolio.plan.coverage", input);
  if (!Array.isArray(covered) || covered.some((control) => typeof control !== "string")) fail("OPA did not return a coverage array");
  if (covered.length === 0) fail("OPA returned no evaluated security controls");
  return {
    state,
    checkedResources: resources.length,
    checkedControls: [...new Set(covered)].sort(),
    resourceTypes: [...types].sort(),
  };
}

async function main() {
  const state = argument("--state");
  const planPath = argument("--plan");
  const opa = argument("--opa");
  const collectorSealPath = argument("--collector-seal");
  if (!planPath) fail("requires --plan <terraform-plan.json>");
  let plan;
  try { plan = JSON.parse(await readFile(planPath, "utf8")); } catch { fail("plan file is missing or malformed JSON"); }
  let collectorSeal;
  if (state === "cloudflare-audit") {
    if (!collectorSealPath) fail("cloudflare-audit requires --collector-seal <verified-collector-seal.json>");
    try { collectorSeal = JSON.parse(await readFile(collectorSealPath, "utf8")); } catch { fail("collector seal file is missing or malformed JSON"); }
  } else if (collectorSealPath) {
    fail("--collector-seal is only valid for cloudflare-audit");
  }
  process.stdout.write(`${JSON.stringify(evaluatePlan({ state, plan, collectorSeal, opa }), null, 2)}\n`);
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => { process.stderr.write(`${error.message}\n`); process.exitCode = 1; });
}
