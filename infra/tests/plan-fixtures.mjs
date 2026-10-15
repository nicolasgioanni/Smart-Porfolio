import { fileURLToPath } from "node:url";

const cloudflareProvider = "registry.terraform.io/cloudflare/cloudflare";
const githubProvider = "registry.terraform.io/integrations/github";

const accountId = "0123456789abcdef0123456789abcdef";
const zoneId = "fedcba9876543210fedcba9876543210";
export const auditCollectorBundlePath = fileURLToPath(new URL("../states/cloudflare-audit/tests/fixtures/release/collector/index.js", import.meta.url));
export const auditCollectorBundleSha256 = "8dbdc285844e1ec2f00739c326c5da496e56f9cb4d0b1bbd5aa980c42ee3ee04";

export function auditCollectorSeal() {
  return {
    version: 1,
    sourceCommit: "a".repeat(40),
    contentHash: "b".repeat(64),
    target: "preview",
    sourceMode: "remote",
    collectorBundlePath: auditCollectorBundlePath,
    collectorBundleSha256: auditCollectorBundleSha256,
    collectorConfigSha256: "c".repeat(64),
    toolchainWrangler: "4.148.0"
  };
}

export const resource = (type, name, values, options = {}) => ({
  address: options.address ?? type + "." + name,
  mode: "managed",
  type,
  name,
  provider_name: options.provider_name ?? (type.startsWith("github_") ? githubProvider : cloudflareProvider),
  values,
});

const change = (item, afterUnknown = {}, actions = ["create"]) => ({
  address: item.address,
  mode: item.mode,
  type: item.type,
  name: item.name,
  provider_name: item.provider_name,
  change: { actions, before: null, after: item.values, after_unknown: afterUnknown },
});

const terraformPlan = (resources, { child = false, cloudflare = false, unknownByAddress = {} } = {}) => ({
  format_version: "1.2",
  terraform_version: "1.16.5",
  ...(cloudflare ? { variables: { cloudflare_account_id: { value: accountId } } } : {}),
  planned_values: {
    root_module: child
      ? { resources: [], child_modules: [{ address: "module.security", resources }] }
      : { resources },
  },
  resource_changes: resources.map((item) => change(item, unknownByAddress[item.address])),
});

const rateRule = (ref, hostname, path) => ({
  ref,
  action: "block",
  enabled: true,
  expression: "http.host eq \"" + hostname + "\" and http.request.method eq \"POST\" and http.request.uri.path eq \"" + path + "\"",
  action_parameters: { response: { status_code: 429, content_type: "application/json", content: "{\"error\":\"rate_limited\"}" } },
  ratelimit: { characteristics: ["cf.colo.id", "ip.src"], period: 60, requests_per_period: 5, mitigation_timeout: 600 },
});

export function sharedPlan() {
  const productionDomains = ["nicolasmgioanni.dev", "www.nicolasmgioanni.dev"];
  const previewDomains = ["preview.nicolasmgioanni.dev"];
  return terraformPlan([
    resource("cloudflare_pages_project", "this", {
      account_id: accountId,
      name: "smart-portfolio",
      production_branch: "main",
      deployment_configs: {
        production: { compatibility_date: "2026-08-27", fail_open: false, d1_databases: { CONTACT_RATE_LIMIT_DB: { id: "11111111-1111-1111-1111-111111111111" } } },
        preview: { compatibility_date: "2026-08-27", fail_open: false, d1_databases: { CONTACT_RATE_LIMIT_DB: { id: "22222222-2222-2222-2222-222222222222" } } },
      },
    }, { address: "module.pages_environments.cloudflare_pages_project.this" }),
    resource("cloudflare_zone_setting", "always_use_https", { zone_id: zoneId, setting_id: "always_use_https", value: "on" }, { address: "module.edge_controls.cloudflare_zone_setting.always_use_https" }),
    resource("cloudflare_zone_setting", "minimum_tls", { zone_id: zoneId, setting_id: "min_tls_version", value: "1.2" }, { address: "module.edge_controls.cloudflare_zone_setting.minimum_tls" }),
    resource("cloudflare_zone_setting", "tls_1_3", { zone_id: zoneId, setting_id: "tls_1_3", value: "on" }, { address: "module.edge_controls.cloudflare_zone_setting.tls_1_3" }),
    resource("cloudflare_zone_setting", "strict_origin_tls", { zone_id: zoneId, setting_id: "ssl", value: "strict" }, { address: "module.edge_controls.cloudflare_zone_setting.strict_origin_tls" }),
    resource("cloudflare_turnstile_widget", "production", { account_id: accountId, name: "smart-portfolio-production", domains: productionDomains, mode: "managed", clearance_level: "no_clearance" }, { address: "module.edge_controls.cloudflare_turnstile_widget.production" }),
    resource("cloudflare_turnstile_widget", "preview", { account_id: accountId, name: "smart-portfolio-preview", domains: previewDomains, mode: "managed", clearance_level: "no_clearance" }, { address: "module.edge_controls.cloudflare_turnstile_widget.preview" }),
    resource("cloudflare_ruleset", "contact_rate_limits", {
      zone_id: zoneId,
      name: "smart-portfolio-contact-rate-limits",
      kind: "zone",
      phase: "http_ratelimit",
      rules: [
        rateRule("production_contact", productionDomains[0], "/api/contact"),
        rateRule("production_verify", productionDomains[0], "/api/contact/verify"),
        rateRule("production_www_contact", productionDomains[1], "/api/contact"),
        rateRule("production_www_verify", productionDomains[1], "/api/contact/verify"),
        rateRule("preview_contact", previewDomains[0], "/api/contact"),
        rateRule("preview_verify", previewDomains[0], "/api/contact/verify"),
      ],
    }, { address: "module.edge_controls.cloudflare_ruleset.contact_rate_limits" }),
  ], { child: true, cloudflare: true });
}

export function previewPlan() {
  const plan = terraformPlan([
    resource("cloudflare_d1_database", "contact_rate_limit", { account_id: accountId, name: "smart-portfolio-contact-rate-limit-preview" }),
    resource("cloudflare_zero_trust_access_policy", "preview_identities", {
      account_id: accountId,
      id: "human-policy-id",
      name: "smart-portfolio-preview-allowed-identities",
      decision: "allow",
      include: [{ email: { email: "owner@example.com" }, group: null }, { email: null, group: { id: "33333333-3333-3333-3333-333333333333" } }],
      exclude: [],
      require: [{ login_method: { id: "44444444-4444-4444-4444-444444444444" } }],
    }, { address: "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities" }),
    resource("cloudflare_zero_trust_access_application", "preview", {
      account_id: accountId,
      zone_id: zoneId,
      name: "smart-portfolio-preview",
      domain: "preview.nicolasmgioanni.dev",
      type: "self_hosted",
      allow_authenticate_via_warp: false,
      auto_redirect_to_identity: true,
      options_preflight_bypass: false,
      policies: [{ id: "human-policy-id", precedence: 1 }],
    }, { address: "module.preview_access.cloudflare_zero_trust_access_application.preview" }),
    resource("cloudflare_zero_trust_access_policy", "preview_service_auth", {
      account_id: accountId,
      id: "service-policy-id",
      name: "smart-portfolio-preview-service-auth",
      decision: "non_identity",
      include: [{ service_token: { token_id: "preview-service-token-id" } }],
      exclude: [],
      require: [],
    }, { address: "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth" }),
    resource("cloudflare_zero_trust_access_application", "preview_service_auth", {
      account_id: accountId,
      zone_id: null,
      name: "smart-portfolio-preview-service-auth",
      domain: "*.smart-portfolio-bds.pages.dev",
      type: "self_hosted",
      allow_authenticate_via_warp: false,
      auto_redirect_to_identity: false,
      options_preflight_bypass: false,
      policies: [{ id: "service-policy-id", precedence: 1 }, { id: "human-policy-id", precedence: 2 }],
    }, { address: "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth" }),
  ], { cloudflare: true });
  return plan;
}

export function productionPlan() {
  return terraformPlan([
    resource("cloudflare_d1_database", "contact_rate_limit", { account_id: accountId, name: "smart-portfolio-contact-rate-limit-production" }),
  ], { cloudflare: true });
}

export function auditPlan() {
  return terraformPlan([
    resource("cloudflare_queue", "audit_events", { account_id: accountId, queue_name: "smart-portfolio-audit-events", settings: { message_retention_period: 1209600, delivery_delay: 0 } }),
    resource("cloudflare_queue", "audit_events_dlq", { account_id: accountId, queue_name: "smart-portfolio-audit-events-dlq", settings: { message_retention_period: 1209600, delivery_delay: 0 } }),
    resource("cloudflare_r2_bucket", "application_audit", { account_id: accountId, name: "smart-portfolio-application-audit" }),
    resource("cloudflare_r2_bucket", "release_control", { account_id: accountId, name: "smart-portfolio-release-control" }),
    resource("cloudflare_r2_bucket_lock", "application_audit", { account_id: accountId, bucket_name: "smart-portfolio-application-audit", rules: [{ id: "retain-application-audit-90-days", enabled: true, prefix: null, condition: { type: "Age", max_age_seconds: 7776000 } }] }),
    resource("cloudflare_r2_bucket_lock", "release_control", { account_id: accountId, bucket_name: "smart-portfolio-release-control", rules: [{ id: "retain-release-control-365-days", enabled: true, prefix: null, condition: { type: "Age", max_age_seconds: 31536000 } }] }),
    resource("cloudflare_r2_bucket_lifecycle", "application_audit", { account_id: accountId, bucket_name: "smart-portfolio-application-audit", rules: [{ id: "delete-application-audit-after-90-days", enabled: true, conditions: { prefix: "" }, delete_objects_transition: { condition: { type: "Age", max_age: 7776000 } } }] }),
    resource("cloudflare_r2_bucket_lifecycle", "release_control", { account_id: accountId, bucket_name: "smart-portfolio-release-control", rules: [{ id: "delete-release-control-after-365-days", enabled: true, conditions: { prefix: "" }, delete_objects_transition: { condition: { type: "Age", max_age: 31536000 } } }] }),
    resource("cloudflare_r2_managed_domain", "application_audit", { account_id: accountId, bucket_name: "smart-portfolio-application-audit", enabled: false }),
    resource("cloudflare_r2_managed_domain", "release_control", { account_id: accountId, bucket_name: "smart-portfolio-release-control", enabled: false }),
    resource("cloudflare_workers_script", "audit_collector", { account_id: accountId, script_name: "smart-portfolio-audit-collector", content_file: auditCollectorBundlePath, content_sha256: auditCollectorBundleSha256, main_module: "index.js", compatibility_date: "2026-08-27", bindings: [{ name: "APP_AUDIT_BUCKET", type: "r2_bucket", bucket_name: "smart-portfolio-application-audit" }] }),
    resource("cloudflare_workers_script_subdomain", "audit_collector", { account_id: accountId, script_name: "smart-portfolio-audit-collector", enabled: false, previews_enabled: false }),
    resource("cloudflare_queue_consumer", "audit_collector", { account_id: accountId, queue_id: "audit-events-queue-id", type: "worker", script_name: "smart-portfolio-audit-collector", dead_letter_queue: "smart-portfolio-audit-events-dlq", settings: { batch_size: 10, max_wait_time_ms: 5000, max_retries: 5 } }),
  ], { cloudflare: true });
}

const permanentRuleset = () => ({
  repository: "Smart-Porfolio",
  name: "protect-permanent-branches",
  target: "branch",
  enforcement: "active",
  bypass_actors: [],
  conditions: [{ ref_name: [{ include: ["refs/heads/main", "refs/heads/develop"], exclude: [] }] }],
  rules: [{
    deletion: true,
    non_fast_forward: true,
  }],
});

export function governancePlan() {
  return terraformPlan([
    resource("github_repository_ruleset", "permanent_branches", permanentRuleset()),
  ]);
}

export const allStatePlans = () => ({
  "cloudflare-shared": sharedPlan(),
  "cloudflare-preview": previewPlan(),
  "cloudflare-production": productionPlan(),
  "cloudflare-audit": auditPlan(),
  "github-governance": governancePlan(),
});

export function resourceAt(plan, address) {
  const visit = (module) => {
    for (const item of module.resources ?? []) if (item.address === address) return item;
    for (const child of module.child_modules ?? []) {
      const found = visit(child);
      if (found) return found;
    }
    return undefined;
  };
  return visit(plan.planned_values.root_module);
}
