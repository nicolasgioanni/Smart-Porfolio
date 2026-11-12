import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { evaluatePlan, validatePlan } from "../check-plan.mjs";
import { allStatePlans, auditCollectorSeal, auditPlan, governancePlan, previewPlan, productionPlan, resource, resourceAt, sharedPlan } from "./plan-fixtures.mjs";

const opa = process.env.OPA_BIN;

if (!opa) throw new Error("OPA_BIN must point to the pinned OPA executable for infra plan-policy tests.");

const passes = (state, plan, collectorSeal = state === "cloudflare-audit" ? auditCollectorSeal() : undefined) => evaluatePlan({ state, plan, collectorSeal, opa });
const rejects = (state, plan, message) => assert.throws(() => passes(state, plan), new RegExp(message));
const mutate = (plan, address, callback) => callback(resourceAt(plan, address).values);

function mutatePlannedAndChangedValues(plan, address, callback) {
  callback(resourceAt(plan, address).values);
  callback(plan.resource_changes.find((change) => change.address === address).change.after);
}

function markAttachmentComputed(plan, policyAddress, applicationAddress, index) {
  mutatePlannedAndChangedValues(plan, policyAddress, (values) => { values.id = null; });
  mutatePlannedAndChangedValues(plan, applicationAddress, (values) => { values.policies[index].id = null; });
  plan.resource_changes.find((change) => change.address === policyAddress).change.after_unknown.id = true;
  plan.resource_changes.find((change) => change.address === applicationAddress).change.after_unknown.policies = Array.from(
    { length: resourceAt(plan, applicationAddress).values.policies.length },
    (_, attachmentIndex) => ({ id: attachmentIndex === index }),
  );
}

test("accepts complete provider-shaped plans for every state and reports evaluated controls", () => {
  for (const [state, plan] of Object.entries(allStatePlans())) {
    const report = passes(state, plan);
    assert.ok(report.checkedResources > 0);
    assert.ok(report.checkedControls.length > 0);
    assert.equal(new Set(report.checkedControls).size, report.checkedControls.length);
  }
});

test("rejects every Pages, TLS, Turnstile, and WAF security control mutation", () => {
  const cases = [
    ["main branch", "module.pages_environments.cloudflare_pages_project.this", (values) => { values.production_branch = "develop"; }, "main deployment"],
    ["compatibility date mismatch", "module.pages_environments.cloudflare_pages_project.this", (values) => { values.deployment_configs.preview.compatibility_date = "2026-08-28"; }, "compatibility date"],
    ["invalid compatibility date", "module.pages_environments.cloudflare_pages_project.this", (values) => { values.deployment_configs.production.compatibility_date = "latest"; values.deployment_configs.preview.compatibility_date = "latest"; }, "compatibility date"],
    ["production fail-open", "module.pages_environments.cloudflare_pages_project.this", (values) => { values.deployment_configs.production.fail_open = true; }, "fail-closed"],
    ["preview fail-open", "module.pages_environments.cloudflare_pages_project.this", (values) => { values.deployment_configs.preview.fail_open = true; }, "fail-closed"],
    ["shared D1", "module.pages_environments.cloudflare_pages_project.this", (values) => { values.deployment_configs.preview.d1_databases.CONTACT_RATE_LIMIT_DB.id = values.deployment_configs.production.d1_databases.CONTACT_RATE_LIMIT_DB.id; }, "distinct concrete D1"],
    ["HTTPS redirect", "module.edge_controls.cloudflare_zone_setting.always_use_https", (values) => { values.value = "off"; }, "HTTPS redirect"],
    ["TLS minimum", "module.edge_controls.cloudflare_zone_setting.minimum_tls", (values) => { values.value = "1.1"; }, "TLS 1.2"],
    ["TLS 1.3", "module.edge_controls.cloudflare_zone_setting.tls_1_3", (values) => { values.value = "off"; }, "TLS 1.3"],
    ["strict origin TLS", "module.edge_controls.cloudflare_zone_setting.strict_origin_tls", (values) => { values.value = "full"; }, "Full \\(strict\\)"],
    ["Turnstile mode", "module.edge_controls.cloudflare_turnstile_widget.production", (values) => { values.mode = "invisible"; }, "Turnstile"],
    ["Turnstile clearance", "module.edge_controls.cloudflare_turnstile_widget.preview", (values) => { values.clearance_level = "managed"; }, "no-clearance"],
    ["Turnstile wildcard", "module.edge_controls.cloudflare_turnstile_widget.preview", (values) => { values.domains = ["*.nicolasmgioanni.dev"]; }, "exact custom"],
    ["Turnstile overlap", "module.edge_controls.cloudflare_turnstile_widget.preview", (values) => { values.domains = ["nicolasmgioanni.dev"]; }, "disjoint"],
    ["missing www rate limit", "module.edge_controls.cloudflare_ruleset.contact_rate_limits", (values) => { values.rules[2].expression = values.rules[0].expression; }, "every approved Turnstile hostname"],
    ["rate limit path", "module.edge_controls.cloudflare_ruleset.contact_rate_limits", (values) => { values.rules[0].expression = values.rules[0].expression.replace("/api/contact", "/api/other"); }, "rate-limit"],
    ["rate limit method", "module.edge_controls.cloudflare_ruleset.contact_rate_limits", (values) => { values.rules[0].expression = values.rules[0].expression.replace("POST", "GET"); }, "rate-limit"],
    ["rate limit response", "module.edge_controls.cloudflare_ruleset.contact_rate_limits", (values) => { values.rules[0].action_parameters.response.status_code = 403; }, "JSON 429"],
    ["rate limit characteristics", "module.edge_controls.cloudflare_ruleset.contact_rate_limits", (values) => { values.rules[0].ratelimit.characteristics = ["ip.src"]; }, "rate-limit"],
    ["rate limit period", "module.edge_controls.cloudflare_ruleset.contact_rate_limits", (values) => { values.rules[0].ratelimit.period = 1; }, "rate-limit"],
    ["rate limit count", "module.edge_controls.cloudflare_ruleset.contact_rate_limits", (values) => { values.rules[0].ratelimit.requests_per_period = 6; }, "rate-limit"],
    ["rate limit mitigation", "module.edge_controls.cloudflare_ruleset.contact_rate_limits", (values) => { values.rules[0].ratelimit.mitigation_timeout = 1; }, "rate-limit"],
  ];
  for (const [, address, callback, error] of cases) {
    const plan = sharedPlan();
    mutate(plan, address, callback);
    rejects("cloudflare-shared", plan, error);
  }
});

test("rejects every preview Access and D1 control mutation", () => {
  const cases = [
    ["D1 name", "cloudflare_d1_database.contact_rate_limit", (values) => { values.name = "smart-portfolio-contact-rate-limit-production"; }, "preview D1"],
    ["human self-hosted type", "module.preview_access.cloudflare_zero_trust_access_application.preview", (values) => { values.type = "ssh"; }, "human custom-host"],
    ["human pages.dev hostname", "module.preview_access.cloudflare_zero_trust_access_application.preview", (values) => { values.domain = "preview.smart-portfolio.pages.dev"; }, "human custom-host"],
    ["human WARP", "module.preview_access.cloudflare_zero_trust_access_application.preview", (values) => { values.allow_authenticate_via_warp = true; }, "human custom-host"],
    ["human preflight bypass", "module.preview_access.cloudflare_zero_trust_access_application.preview", (values) => { values.options_preflight_bypass = true; }, "human custom-host"],
    ["bypass decision", "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities", (values) => { values.decision = "bypass"; }, "allow only"],
    ["everyone identity", "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities", (values) => { values.include = [{ email: null, group: null, everyone: {} }]; }, "email or group"],
    ["missing IdP", "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities", (values) => { values.require = []; }, "identity provider"],
    ["invalid IdP", "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities", (values) => { values.require[0].login_method.id = "not-a-uuid"; }, "identity provider"],
    ["exclude identity", "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities", (values) => { values.exclude = [{ email: { email: "owner@example.com" } }]; }, "email or group"],
    ["machine application hostname", "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth", (values) => { values.domain = "*.other.pages.dev"; }, "Pages wildcard service application"],
    ["machine application zone", "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth", (values) => { values.zone_id = "ffffffffffffffffffffffffffffffff"; }, "Pages wildcard service application"],
    ["machine application redirect", "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth", (values) => { values.auto_redirect_to_identity = true; }, "Pages wildcard service application"],
    ["machine policy decision", "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth", (values) => { values.decision = "allow"; }, "service-token"],
    ["machine policy broad identity", "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth", (values) => { values.include = [{ everyone: {} }]; }, "service-token"],
    ["machine policy missing token identifier", "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth", (values) => { values.include[0].service_token.token_id = ""; }, "service-token"],
    ["machine policy requirement", "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth", (values) => { values.require = [{ login_method: { id: "44444444-4444-4444-4444-444444444444" } }]; }, "service-token"],
  ];
  for (const [, address, callback, error] of cases) {
    const plan = previewPlan();
    mutate(plan, address, callback);
    rejects("cloudflare-preview", plan, error);
  }
  const production = productionPlan();
  mutate(production, "cloudflare_d1_database.contact_rate_limit", (values) => { values.name = "smart-portfolio-contact-rate-limit-preview"; });
  rejects("cloudflare-production", production, "production D1");
});

test("binds preview applications to their exact concrete human and ordered ServiceAuth policy resources", () => {
  const humanPolicy = "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities";
  const servicePolicy = "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth";
  const humanApplication = "module.preview_access.cloudflare_zero_trust_access_application.preview";
  const pagesApplication = "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth";

  const external = previewPlan();
  mutatePlannedAndChangedValues(external, humanPolicy, (values) => { values.id = "human-policy-id"; });
  mutatePlannedAndChangedValues(external, humanApplication, (values) => { values.policies[0].id = "external-policy-id"; });
  rejects("cloudflare-preview", external, "human custom-host application");

  const swapped = previewPlan();
  mutatePlannedAndChangedValues(swapped, humanPolicy, (values) => { values.id = "human-policy-id"; });
  mutatePlannedAndChangedValues(swapped, servicePolicy, (values) => { values.id = "service-policy-id"; });
  mutatePlannedAndChangedValues(swapped, humanApplication, (values) => { values.policies[0].id = "service-policy-id"; });
  mutatePlannedAndChangedValues(swapped, pagesApplication, (values) => {
    values.policies[0].id = "human-policy-id";
    values.policies[1].id = "service-policy-id";
  });
  rejects("cloudflare-preview", swapped, "human custom-host application");

  const duplicate = previewPlan();
  mutatePlannedAndChangedValues(duplicate, humanPolicy, (values) => { values.id = "human-policy-id"; });
  mutatePlannedAndChangedValues(duplicate, servicePolicy, (values) => { values.id = "service-policy-id"; });
  mutatePlannedAndChangedValues(duplicate, humanApplication, (values) => { values.policies[0].id = "human-policy-id"; });
  mutatePlannedAndChangedValues(duplicate, pagesApplication, (values) => {
    values.policies[0].id = "service-policy-id";
    values.policies[1].id = "service-policy-id";
  });
  rejects("cloudflare-preview", duplicate, "Pages wildcard service application");

  const computed = previewPlan();
  markAttachmentComputed(computed, humanPolicy, humanApplication, 0);
  markAttachmentComputed(computed, servicePolicy, pagesApplication, 0);
  markAttachmentComputed(computed, humanPolicy, pagesApplication, 1);
  rejects("cloudflare-preview", computed, "human custom-host application");
});

test("rejects every audit queue, private-bucket, collector, retention-lock, and lifecycle control mutation", () => {
  const cases = [
    ["queue name", "cloudflare_queue.audit_events_dlq", (values) => { values.queue_name = "other"; }, "events queue and DLQ"],
    ["queue retention", "cloudflare_queue.audit_events", (values) => { values.settings.message_retention_period = 1; }, "fourteen-day"],
    ["queue delay", "cloudflare_queue.audit_events", (values) => { values.settings.delivery_delay = 1; }, "fourteen-day"],
    ["bucket name", "cloudflare_r2_bucket.application_audit", (values) => { values.name = "other"; }, "private application"],
    ["lock enabled", "cloudflare_r2_bucket_lock.application_audit", (values) => { values.rules[0].enabled = false; }, "Age retention"],
    ["lock type", "cloudflare_r2_bucket_lock.application_audit", (values) => { values.rules[0].condition.type = "age"; }, "Age retention"],
    ["lock retention", "cloudflare_r2_bucket_lock.release_control", (values) => { values.rules[0].condition.max_age_seconds = 1; }, "Age retention"],
    ["lock prefix", "cloudflare_r2_bucket_lock.release_control", (values) => { values.rules[0].prefix = "only/"; }, "full-bucket"],
    ["lifecycle retention", "cloudflare_r2_bucket_lifecycle.application_audit", (values) => { values.rules[0].delete_objects_transition.condition.max_age = 1; }, "lifecycle deletion"],
    ["lifecycle prefix", "cloudflare_r2_bucket_lifecycle.release_control", (values) => { values.rules[0].conditions.prefix = "only/"; }, "lifecycle deletion"],
    ["collector binding", "cloudflare_workers_script.audit_collector", (values) => { values.bindings[0].bucket_name = "other"; }, "sealed collector bundle"],
    ["collector public Worker", "cloudflare_workers_script_subdomain.audit_collector", (values) => { values.enabled = true; }, "disable Workers.dev"],
    ["collector preview", "cloudflare_workers_script_subdomain.audit_collector", (values) => { values.previews_enabled = true; }, "disable Workers.dev"],
    ["collector retries", "cloudflare_queue_consumer.audit_collector", (values) => { values.settings.max_retries = 4; }, "reviewed DLQ"],
  ];
  for (const [, address, callback, error] of cases) {
    const plan = auditPlan();
    mutate(plan, address, callback);
    rejects("cloudflare-audit", plan, error);
  }
  const publicDomain = auditPlan();
  mutate(publicDomain, "cloudflare_r2_managed_domain.application_audit", (values) => { values.enabled = true; });
  rejects("cloudflare-audit", publicDomain, "must not expose");
});

test("binds the saved collector plan to the verified sealed bundle path, digest, and current bytes", () => {
  const plan = auditPlan();
  assert.throws(() => evaluatePlan({ state: "cloudflare-audit", plan, opa }), /requires a verified collector seal/);

  const wrongDigest = auditCollectorSeal();
  wrongDigest.collectorBundleSha256 = "d".repeat(64);
  assert.throws(() => evaluatePlan({ state: "cloudflare-audit", plan, collectorSeal: wrongDigest, opa }), /content_sha256 does not match/);

  const wrongPath = auditCollectorSeal();
  wrongPath.collectorBundlePath = join(tmpdir(), "not-the-sealed-collector.js");
  assert.throws(() => evaluatePlan({ state: "cloudflare-audit", plan, collectorSeal: wrongPath, opa }), /content_file does not match/);

  const directory = mkdtempSync(join(tmpdir(), "smart-portfolio-collector-plan-"));
  try {
    const bundle = join(directory, "index.js");
    writeFileSync(bundle, "tampered collector bytes\n");
    const tampered = auditCollectorSeal();
    tampered.collectorBundlePath = bundle;
    const script = resourceAt(plan, "cloudflare_workers_script.audit_collector").values;
    script.content_file = bundle;
    assert.throws(() => evaluatePlan({ state: "cloudflare-audit", plan, collectorSeal: tampered, opa }), /bundle bytes no longer match/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("rejects every permanent-branch ruleset control mutation", () => {
  const cases = [
    ["scope", "github_repository_ruleset.permanent_branches", (values) => { values.conditions[0].ref_name[0].include = ["refs/heads/main"]; }, "exactly main and develop"],
    ["name", "github_repository_ruleset.permanent_branches", (values) => { values.name = "replacement-ruleset"; }, "one active"],
    ["enforcement", "github_repository_ruleset.permanent_branches", (values) => { values.enforcement = "evaluate"; }, "one active"],
    ["ruleset bypass", "github_repository_ruleset.permanent_branches", (values) => { values.bypass_actors = [{ actor_id: 1 }]; }, "unbypassable"],
    ["deletion", "github_repository_ruleset.permanent_branches", (values) => { values.rules[0].deletion = false; }, "deletion"],
    ["force push", "github_repository_ruleset.permanent_branches", (values) => { values.rules[0].non_fast_forward = false; }, "non-fast-forward"],
  ];
  for (const [, address, callback, error] of cases) {
    const plan = governancePlan();
    mutate(plan, address, callback);
    rejects("github-governance", plan, error);
  }
});

test("rejects malformed, partial, destructive, mismatched, unsupported, and unknown security plans", () => {
  assert.throws(() => validatePlan(undefined, {}), /unknown or missing/);
  assert.throws(() => validatePlan("cloudflare-audit", { format_version: "1.2", terraform_version: "1.16.5", planned_values: { root_module: { resources: [] } }, resource_changes: [] }), /zero planned resources/);

  const missing = auditPlan();
  missing.planned_values.root_module.resources = missing.planned_values.root_module.resources.filter((item) => item.address !== "cloudflare_r2_bucket_lock.release_control");
  missing.resource_changes = missing.resource_changes.filter((item) => item.address !== "cloudflare_r2_bucket_lock.release_control");
  rejects("cloudflare-audit", missing, /exactly 2 cloudflare_r2_bucket_lock/);

  const destructive = previewPlan();
  destructive.resource_changes[0].change.actions = ["delete", "create"];
  rejects("cloudflare-preview", destructive, "deletion or replacement");

  const mismatched = productionPlan();
  mismatched.resource_changes[0].change.after = { ...mismatched.resource_changes[0].change.after, name: "changed-without-planned-values" };
  rejects("cloudflare-production", mismatched, "does not match known");

  const partial = governancePlan();
  partial.resource_changes.pop();
  rejects("github-governance", partial, "covers every planned resource");

  const unexpected = auditPlan();
  const extra = resource("cloudflare_workers_kv_namespace", "unreviewed", { account_id: "0123456789abcdef0123456789abcdef", title: "unreviewed" });
  unexpected.planned_values.root_module.resources.push(extra);
  unexpected.resource_changes.push({
    address: extra.address, mode: extra.mode, type: extra.type, name: extra.name, provider_name: extra.provider_name,
    change: { actions: ["create"], before: null, after: extra.values, after_unknown: {} },
  });
  rejects("cloudflare-audit", unexpected, "unsupported resource");

  const unknownWhole = sharedPlan();
  const pageChange = unknownWhole.resource_changes.find((item) => item.address === "module.pages_environments.cloudflare_pages_project.this");
  pageChange.change.after_unknown = { deployment_configs: true };
  rejects("cloudflare-shared", unknownWhole, "security value deployment_configs unknown");

  const unknownNested = governancePlan();
  const rulesetChange = unknownNested.resource_changes.find((item) => item.address === "github_repository_ruleset.permanent_branches");
  rulesetChange.change.after_unknown = { rules: [{ non_fast_forward: true }] };
  rejects("github-governance", unknownNested, "security value rules.0.non_fast_forward unknown");

  const wrongAccount = previewPlan();
  mutate(wrongAccount, "cloudflare_d1_database.contact_rate_limit", (values) => { values.account_id = "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"; });
  rejects("cloudflare-preview", wrongAccount, "does not match plan.variables");
  const providerless = productionPlan();
  const extraProviderless = resource("terraform_data", "unreviewed", { input: { state: "cloudflare-production" } }, {
    provider_name: "terraform.io/builtin/terraform",
  });
  providerless.planned_values.root_module.resources.push(extraProviderless);
  providerless.resource_changes.push({
    address: extraProviderless.address, mode: extraProviderless.mode, type: extraProviderless.type, name: extraProviderless.name, provider_name: extraProviderless.provider_name,
    change: { actions: ["create"], before: null, after: extraProviderless.values, after_unknown: {} },
  });
  rejects("cloudflare-production", providerless, "unsupported resource");

  const incomplete = productionPlan();
  incomplete.complete = false;
  rejects("cloudflare-production", incomplete, "incomplete");

  const errored = productionPlan();
  errored.errored = true;
  rejects("cloudflare-production", errored, "errored");

  const deferred = productionPlan();
  deferred.deferred_changes = [];
  rejects("cloudflare-production", deferred, "deferred_changes");

  const unsupportedAction = productionPlan();
  unsupportedAction.resource_changes[0].change.actions = ["read"];
  rejects("cloudflare-production", unsupportedAction, "unsupported action vector");

  const multiAction = productionPlan();
  multiAction.resource_changes[0].change.actions = ["create", "update"];
  rejects("cloudflare-production", multiAction, "unsupported action vector");

  const malformedUnknown = productionPlan();
  malformedUnknown.resource_changes[0].change.after_unknown = { name: "unknown" };
  rejects("cloudflare-production", malformedUnknown, "malformed scalar");

  const computedUnknown = productionPlan();
  computedUnknown.resource_changes[0].change.after = { ...computedUnknown.resource_changes[0].change.after, id: null };
  computedUnknown.resource_changes[0].change.after_unknown = { id: true };
  assert.ok(passes("cloudflare-production", computedUnknown).checkedResources > 0);
});

test("the relative-path CLI evaluates a saved plan and fails closed for malformed JSON", () => {
  const directory = mkdtempSync(join(tmpdir(), "smart-portfolio-plan-gate-"));
  const validPlan = join(directory, "valid.json");
  const malformedPlan = join(directory, "malformed.json");
  try {
    writeFileSync(validPlan, JSON.stringify(productionPlan()));
    writeFileSync(malformedPlan, "{");
    const output = execFileSync(process.execPath, ["infra/check-plan.mjs", "--state", "cloudflare-production", "--plan", validPlan], {
      cwd: process.cwd(),
      env: { ...process.env, OPA_BIN: opa },
      encoding: "utf8",
    });
    const report = JSON.parse(output);
    assert.deepEqual(report.checkedControls, ["production-adopted-d1-name"]);
    const malformed = spawnSync(process.execPath, ["infra/check-plan.mjs", "--state", "cloudflare-production", "--plan", malformedPlan], {
      cwd: process.cwd(),
      env: { ...process.env, OPA_BIN: opa },
      encoding: "utf8",
    });
    assert.notEqual(malformed.status, 0);
    assert.match(malformed.stderr, /plan file is missing or malformed JSON/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("the audit CLI requires an explicit verified collector seal", () => {
  const directory = mkdtempSync(join(tmpdir(), "smart-portfolio-audit-plan-gate-"));
  const planPath = join(directory, "audit-plan.json");
  const sealPath = join(directory, "collector-seal.json");
  try {
    writeFileSync(planPath, JSON.stringify(auditPlan()));
    writeFileSync(sealPath, JSON.stringify(auditCollectorSeal()));
    const output = execFileSync(process.execPath, ["infra/check-plan.mjs", "--state", "cloudflare-audit", "--plan", planPath, "--collector-seal", sealPath], {
      cwd: process.cwd(), env: { ...process.env, OPA_BIN: opa }, encoding: "utf8"
    });
    assert.ok(JSON.parse(output).checkedControls.includes("audit-collector-sealed-private-r2-binding"));
    const missing = spawnSync(process.execPath, ["infra/check-plan.mjs", "--state", "cloudflare-audit", "--plan", planPath], {
      cwd: process.cwd(), env: { ...process.env, OPA_BIN: opa }, encoding: "utf8"
    });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /requires --collector-seal/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
