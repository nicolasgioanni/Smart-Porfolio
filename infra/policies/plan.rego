package smartportfolio.plan

import rego.v1

# The JavaScript runner first validates Terraform's plan structure, provider
# identity, change/value coherence, and unknown security values. This policy
# evaluates the concrete provider-visible posture values.
resources := [resource |
  walk(input.plan.planned_values.root_module, [path, resource])
  count(path) >= 2
  path[count(path) - 2] == "resources"
  is_object(resource)
  object.get(resource, "type", "") != ""
]

items(resource_type) := [resource |
  resource := resources[_]
  resource.type == resource_type
]

values(resource) := object.get(resource, "values", {})

value(resource, key, fallback) := object.get(values(resource), key, fallback)

nonempty_string(item) if {
  is_string(item)
  item != ""
}

custom_hostname(hostname) if {
  is_string(hostname)
  regex.match("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", hostname)
  not endswith(hostname, ".pages.dev")
}

uuid(value) if {
  is_string(value)
  regex.match("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", value)
}

empty_prefix(prefix) if { prefix == null }
empty_prefix(prefix) if { prefix == "" }

pinned_compatibility_date(date) if {
  is_string(date)
  regex.match("^[0-9]{4}-[0-9]{2}-[0-9]{2}$", date)
  time.parse_rfc3339_ns(sprintf("%sT00:00:00Z", [date]))
}

# Shared Pages and edge controls.
pages_project_ok if {
  pages := items("cloudflare_pages_project")
  count(pages) == 1
  page := pages[0]
  value(page, "production_branch", "") == "main"
  configs := value(page, "deployment_configs", {})
  production := object.get(configs, "production", {})
  preview := object.get(configs, "preview", {})
  production_date := object.get(production, "compatibility_date", "")
  preview_date := object.get(preview, "compatibility_date", "")
  pinned_compatibility_date(production_date)
  production_date == preview_date
  object.get(production, "fail_open", true) == false
  object.get(preview, "fail_open", true) == false
  production_d1 := object.get(object.get(object.get(production, "d1_databases", {}), "CONTACT_RATE_LIMIT_DB", {}), "id", "")
  preview_d1 := object.get(object.get(object.get(preview, "d1_databases", {}), "CONTACT_RATE_LIMIT_DB", {}), "id", "")
  uuid(production_d1)
  uuid(preview_d1)
  production_d1 != preview_d1
}

zone_tls_ok if {
  settings := {sprintf("%s=%v", [value(setting, "setting_id", ""), value(setting, "value", "")]) |
    setting := items("cloudflare_zone_setting")[_]
  }
  settings == {"always_use_https=on", "min_tls_version=1.2", "tls_1_3=on", "ssl=strict"}
}

turnstile_widget_ok(name, widgets) if {
  count(widgets) == 1
  widget := widgets[0]
  value(widget, "name", "") == name
  value(widget, "mode", "") == "managed"
  value(widget, "clearance_level", "") == "no_clearance"
  domains := value(widget, "domains", [])
  is_array(domains)
  count(domains) > 0
  count({domain | domain := domains[_]}) == count(domains)
  every domain in domains { custom_hostname(domain) }
}

turnstile_ok if {
  widgets := items("cloudflare_turnstile_widget")
  count(widgets) == 2
  production := [widget | widget := widgets[_]; value(widget, "name", "") == "smart-portfolio-production"]
  preview := [widget | widget := widgets[_]; value(widget, "name", "") == "smart-portfolio-preview"]
  turnstile_widget_ok("smart-portfolio-production", production)
  turnstile_widget_ok("smart-portfolio-preview", preview)
  production_domains := {domain | domain := value(production[0], "domains", [])[_]}
  preview_domains := {domain | domain := value(preview[0], "domains", [])[_]}
  count(production_domains & preview_domains) == 0
}

rate_limit_rule_ok(rule, hostname, path) if {
  object.get(rule, "expression", "") == sprintf("http.host eq \"%s\" and http.request.method eq \"POST\" and http.request.uri.path eq \"%s\"", [hostname, path])
  object.get(rule, "action", "") == "block"
  response := object.get(object.get(rule, "action_parameters", {}), "response", {})
  object.get(response, "status_code", 0) == 429
  object.get(response, "content_type", "") == "application/json"
  object.get(response, "content", "") == "{\"error\":\"rate_limited\"}"
  object.get(rule, "enabled", false) == true
  limit := object.get(rule, "ratelimit", {})
  {characteristic | characteristic := object.get(limit, "characteristics", [])[_]} == {"cf.colo.id", "ip.src"}
  count(object.get(limit, "characteristics", [])) == 2
  object.get(limit, "period", 0) == 60
  object.get(limit, "requests_per_period", 0) == 5
  object.get(limit, "mitigation_timeout", 0) == 600
}

rate_limit_rule_for(rules, hostname, path) if {
  rule := rules[_]
  rate_limit_rule_ok(rule, hostname, path)
}

rate_limits_ok if {
  sets := items("cloudflare_ruleset")
  count(sets) == 1
  ruleset := sets[0]
  value(ruleset, "kind", "") == "zone"
  value(ruleset, "phase", "") == "http_ratelimit"
  rules := value(ruleset, "rules", [])
  is_array(rules)
  widgets := items("cloudflare_turnstile_widget")
  production := [widget | widget := widgets[_]; value(widget, "name", "") == "smart-portfolio-production"]
  preview := [widget | widget := widgets[_]; value(widget, "name", "") == "smart-portfolio-preview"]
  production_domains := {domain | domain := value(production[0], "domains", [])[_]}
  preview_domains := {domain | domain := value(preview[0], "domains", [])[_]}
  count(rules) == 2 * (count(production_domains) + count(preview_domains))
  every hostname in production_domains {
    rate_limit_rule_for(rules, hostname, "/api/contact")
    rate_limit_rule_for(rules, hostname, "/api/contact/verify")
  }
  every hostname in preview_domains {
    rate_limit_rule_for(rules, hostname, "/api/contact")
    rate_limit_rule_for(rules, hostname, "/api/contact/verify")
  }
}

# Preview Access and isolated D1 databases.
d1_ok(expected_name) if {
  databases := items("cloudflare_d1_database")
  count(databases) == 1
  database := databases[0]
  value(database, "name", "") == expected_name
}

human_policy_address := "module.preview_access.cloudflare_zero_trust_access_policy.preview_identities"
service_policy_address := "module.preview_access.cloudflare_zero_trust_access_policy.preview_service_auth"
human_application_address := "module.preview_access.cloudflare_zero_trust_access_application.preview"
pages_application_address := "module.preview_access.cloudflare_zero_trust_access_application.preview_service_auth"

resource_at(address) := resource if {
  resource := resources[_]
  resource.address == address
}

# Terraform's configuration JSON flattens policy references across a list, so
# it cannot bind a computed ID to a particular precedence slot. Do not infer
# that ordering from an unordered source graph: saved-plan admission requires
# the concrete provider IDs in the reviewed no-op plan.
policy_attachment_matches(application_address, policy_address, index, precedence) if {
  application := resource_at(application_address)
  attachments := value(application, "policies", [])
  attachment := attachments[index]
  object.get(attachment, "precedence", 0) == precedence
  policy := resource_at(policy_address)
  policy_id := value(policy, "id", null)
  nonempty_string(policy_id)
  object.get(attachment, "id", null) == policy_id
}

human_access_application_ok if {
  apps := items("cloudflare_zero_trust_access_application")
  count(apps) == 2
  app := resource_at(human_application_address)
  value(app, "name", "") == "smart-portfolio-preview"
  value(app, "type", "") == "self_hosted"
  domain := value(app, "domain", "")
  custom_hostname(domain)
  value(app, "allow_authenticate_via_warp", true) == false
  value(app, "options_preflight_bypass", true) == false
  policies := value(app, "policies", [])
  count(policies) == 1
  policy_attachment_matches(human_application_address, human_policy_address, 0, 1)
}

pages_service_access_application_ok if {
  apps := items("cloudflare_zero_trust_access_application")
  count(apps) == 2
  app := resource_at(pages_application_address)
  value(app, "name", "") == "smart-portfolio-preview-service-auth"
  value(app, "type", "") == "self_hosted"
  value(app, "domain", "") == "*.smart-portfolio-bds.pages.dev"
  value(app, "zone_id", null) == null
  value(app, "allow_authenticate_via_warp", true) == false
  value(app, "options_preflight_bypass", true) == false
  value(app, "auto_redirect_to_identity", true) == false
  policies := value(app, "policies", [])
  count(policies) == 2
  policy_attachment_matches(pages_application_address, service_policy_address, 0, 1)
  policy_attachment_matches(pages_application_address, human_policy_address, 1, 2)
}

allowed_identity_field(identity, key) if { key == "email" }
allowed_identity_field(identity, key) if { key == "group" }
allowed_identity_field(identity, key) if { object.get(identity, key, null) == null }

email_or_group(identity) if {
  email := object.get(identity, "email", null)
  group := object.get(identity, "group", null)
  is_object(email)
  nonempty_string(object.get(email, "email", ""))
  group == null
  every key in object.keys(identity) { allowed_identity_field(identity, key) }
}

email_or_group(identity) if {
  email := object.get(identity, "email", null)
  group := object.get(identity, "group", null)
  email == null
  is_object(group)
  uuid(object.get(group, "id", ""))
  every key in object.keys(identity) { allowed_identity_field(identity, key) }
}

allowed_idp_field(requirement, key) if { key == "login_method" }
allowed_idp_field(requirement, key) if { object.get(requirement, key, null) == null }

idp_requirement(requirement) if {
  login_method := object.get(requirement, "login_method", null)
  is_object(login_method)
  uuid(object.get(login_method, "id", ""))
  every key in object.keys(requirement) { allowed_idp_field(requirement, key) }
}

human_access_policy_ok if {
  policies := items("cloudflare_zero_trust_access_policy")
  count(policies) == 2
  matched := [policy | policy := policies[_]; value(policy, "name", "") == "smart-portfolio-preview-allowed-identities"]
  count(matched) == 1
  policy := matched[0]
  value(policy, "name", "") == "smart-portfolio-preview-allowed-identities"
  value(policy, "decision", "") == "allow"
  value(policy, "exclude", []) == []
  include := value(policy, "include", [])
  count(include) > 0
  every identity in include { email_or_group(identity) }
  require := value(policy, "require", [])
  count(require) == 1
  idp_requirement(require[0])
}

allowed_service_token_field(condition, key) if { key == "service_token" }
allowed_service_token_field(condition, key) if { object.get(condition, key, null) == null }

service_token_selector(condition) if {
  is_object(condition)
  token := object.get(condition, "service_token", null)
  is_object(token)
  count(object.keys(token)) == 1
  nonempty_string(object.get(token, "token_id", ""))
  every key in object.keys(condition) { allowed_service_token_field(condition, key) }
}

pages_service_access_policy_ok if {
  policies := items("cloudflare_zero_trust_access_policy")
  count(policies) == 2
  matched := [policy | policy := policies[_]; value(policy, "name", "") == "smart-portfolio-preview-service-auth"]
  count(matched) == 1
  policy := matched[0]
  value(policy, "decision", "") == "non_identity"
  value(policy, "exclude", []) == []
  value(policy, "require", []) == []
  include := value(policy, "include", [])
  count(include) == 1
  service_token_selector(include[0])
}

# Audit transport and retention controls.
audit_queues_ok if {
  queues := items("cloudflare_queue")
  count(queues) == 2
  {value(queue, "queue_name", "") | queue := queues[_]} == {"smart-portfolio-audit-events", "smart-portfolio-audit-events-dlq"}
  every queue in queues {
    settings := value(queue, "settings", {})
    object.get(settings, "message_retention_period", 0) == 1209600
    object.get(settings, "delivery_delay", -1) == 0
  }
}

audit_buckets_ok if {
  buckets := items("cloudflare_r2_bucket")
  count(buckets) == 2
  {value(bucket, "name", "") | bucket := buckets[_]} == {"smart-portfolio-application-audit", "smart-portfolio-release-control"}
}

retention_lock_ok(bucket_name, rule_id, seconds) if {
  locks := [lock | lock := items("cloudflare_r2_bucket_lock")[_]; value(lock, "bucket_name", "") == bucket_name]
  count(locks) == 1
  rules := value(locks[0], "rules", [])
  count(rules) == 1
  rule := rules[0]
  object.get(rule, "id", "") == rule_id
  object.get(rule, "enabled", false) == true
  empty_prefix(object.get(rule, "prefix", null))
  condition := object.get(rule, "condition", {})
  object.get(condition, "type", "") == "Age"
  object.get(condition, "max_age_seconds", 0) == seconds
}

audit_locks_ok if {
  locks := items("cloudflare_r2_bucket_lock")
  count(locks) == 2
  retention_lock_ok("smart-portfolio-application-audit", "retain-application-audit-90-days", 7776000)
  retention_lock_ok("smart-portfolio-release-control", "retain-release-control-365-days", 31536000)
}

retention_lifecycle_ok(bucket_name, rule_id, seconds) if {
  lifecycles := [lifecycle | lifecycle := items("cloudflare_r2_bucket_lifecycle")[_]; value(lifecycle, "bucket_name", "") == bucket_name]
  count(lifecycles) == 1
  rules := value(lifecycles[0], "rules", [])
  count(rules) == 1
  rule := rules[0]
  object.get(rule, "id", "") == rule_id
  object.get(rule, "enabled", false) == true
  conditions := object.get(rule, "conditions", {})
  object.get(conditions, "prefix", "unexpected") == ""
  transition := object.get(rule, "delete_objects_transition", {})
  condition := object.get(transition, "condition", {})
  object.get(condition, "type", "") == "Age"
  object.get(condition, "max_age", 0) == seconds
}

audit_lifecycles_ok if {
  lifecycles := items("cloudflare_r2_bucket_lifecycle")
  count(lifecycles) == 2
  retention_lifecycle_ok("smart-portfolio-application-audit", "delete-application-audit-after-90-days", 7776000)
  retention_lifecycle_ok("smart-portfolio-release-control", "delete-release-control-after-365-days", 31536000)
}

r2_public_access_disabled if {
  domains := items("cloudflare_r2_managed_domain")
  count(domains) == 2
  {value(domain, "bucket_name", "") | domain := domains[_]} == {"smart-portfolio-application-audit", "smart-portfolio-release-control"}
  every domain in domains {
    value(domain, "enabled", true) == false
  }
}

audit_collector_script_ok if {
  scripts := items("cloudflare_workers_script")
  count(scripts) == 1
  script := scripts[0]
  value(script, "script_name", "") == "smart-portfolio-audit-collector"
  value(script, "content_file", "") == object.get(input.collectorSeal, "collectorBundlePath", "")
  value(script, "content_sha256", "") == object.get(input.collectorSeal, "collectorBundleSha256", "")
  value(script, "main_module", "") == "index.js"
  value(script, "compatibility_date", "") == "2026-08-27"
  bindings := value(script, "bindings", [])
  count(bindings) == 1
  binding := bindings[0]
  object.get(binding, "name", "") == "APP_AUDIT_BUCKET"
  object.get(binding, "type", "") == "r2_bucket"
  object.get(binding, "bucket_name", "") == "smart-portfolio-application-audit"
}

audit_collector_private_ok if {
  subdomains := items("cloudflare_workers_script_subdomain")
  count(subdomains) == 1
  subdomain := subdomains[0]
  value(subdomain, "script_name", "") == "smart-portfolio-audit-collector"
  value(subdomain, "enabled", true) == false
  value(subdomain, "previews_enabled", true) == false
}

audit_collector_consumer_ok if {
  consumers := items("cloudflare_queue_consumer")
  count(consumers) == 1
  consumer := consumers[0]
  value(consumer, "type", "") == "worker"
  value(consumer, "script_name", "") == "smart-portfolio-audit-collector"
  value(consumer, "dead_letter_queue", "") == "smart-portfolio-audit-events-dlq"
  settings := value(consumer, "settings", {})
  object.get(settings, "batch_size", 0) == 10
  object.get(settings, "max_wait_time_ms", 0) == 5000
  object.get(settings, "max_retries", 0) == 5
}

# GitHub governance. Classic main pull-request protection is deliberately
# outside this state; this existing ruleset has integrity controls only.
github_permanent_ruleset_ok if {
  rulesets := items("github_repository_ruleset")
  count(rulesets) == 1
  ruleset := rulesets[0]
  value(ruleset, "name", "") == "protect-permanent-branches"
  value(ruleset, "target", "") == "branch"
  value(ruleset, "enforcement", "") == "active"
  value(ruleset, "bypass_actors", ["unexpected"]) == []
  conditions := value(ruleset, "conditions", [])
  count(conditions) == 1
  refs := object.get(conditions[0], "ref_name", [])
  count(refs) == 1
  object.get(refs[0], "include", []) == ["refs/heads/main", "refs/heads/develop"]
  object.get(refs[0], "exclude", []) == []
  rules := value(ruleset, "rules", [])
  count(rules) == 1
  rule := rules[0]
  object.get(rule, "deletion", false) == true
  object.get(rule, "non_fast_forward", false) == true
}

deny contains "shared Pages project must have one main deployment, a concrete identical compatibility date, fail-closed production and preview configurations, and distinct concrete D1 IDs" if {
  input.state == "cloudflare-shared"
  not pages_project_ok
}

deny contains "shared state must set HTTPS redirect, TLS 1.2 minimum, TLS 1.3, and Full (strict) origin TLS" if {
  input.state == "cloudflare-shared"
  not zone_tls_ok
}

deny contains "shared state must use disjoint managed no-clearance Turnstile widgets on exact custom hostnames" if {
  input.state == "cloudflare-shared"
  not turnstile_ok
}

deny contains "shared state must rate-limit both POST contact paths for every approved Turnstile hostname with the reviewed Cloudflare conditions and JSON 429 response" if {
  input.state == "cloudflare-shared"
  not rate_limits_ok
}

deny contains "preview D1 must use the adopted preview database name" if {
  input.state == "cloudflare-preview"
  not d1_ok("smart-portfolio-contact-rate-limit-preview")
}

deny contains "preview Access must retain one exact self-hosted human custom-host application with its exact human-policy attachment, WARP and preflight bypass disabled" if {
  input.state == "cloudflare-preview"
  not human_access_application_ok
}

deny contains "preview Access must retain a separate Pages wildcard service application with ordered ServiceAuth then human-policy attachments, no zone, WARP, preflight bypass, or identity redirect" if {
  input.state == "cloudflare-preview"
  not pages_service_access_application_ok
}

deny contains "preview human Access policy must allow only explicit email or group identities and require one explicit identity provider" if {
  input.state == "cloudflare-preview"
  not human_access_policy_ok
}

deny contains "preview Pages Access policy must be a narrow non-identity service-token policy without exclusions or requirements" if {
  input.state == "cloudflare-preview"
  not pages_service_access_policy_ok
}

deny contains "production D1 must use the adopted production database name" if {
  input.state == "cloudflare-production"
  not d1_ok("smart-portfolio-contact-rate-limit-production")
}

deny contains "audit state must declare the exact fourteen-day events queue and DLQ" if {
  input.state == "cloudflare-audit"
  not audit_queues_ok
}

deny contains "audit state must declare the exact private application and release-control buckets" if {
  input.state == "cloudflare-audit"
  not audit_buckets_ok
}

deny contains "audit state must enable full-bucket Age retention locks for 90 days and 365 days" if {
  input.state == "cloudflare-audit"
  not audit_locks_ok
}

deny contains "audit state must schedule full-bucket Age lifecycle deletion after 90 days and 365 days" if {
  input.state == "cloudflare-audit"
  not audit_lifecycles_ok
}

deny contains "audit state must not expose an R2 managed domain; custom R2 domains are not allowed" if {
  input.state == "cloudflare-audit"
  not r2_public_access_disabled
}

deny contains "audit state must use the sealed collector bundle with only APP_AUDIT_BUCKET" if {
  input.state == "cloudflare-audit"
  not audit_collector_script_ok
}

deny contains "audit collector must disable Workers.dev and preview URLs" if {
  input.state == "cloudflare-audit"
  not audit_collector_private_ok
}

deny contains "audit collector must consume the primary audit queue with the reviewed DLQ and retry limits" if {
  input.state == "cloudflare-audit"
  not audit_collector_consumer_ok
}

deny contains "GitHub must retain one active unbypassable permanent-branch ruleset for exactly main and develop with deletion and non-fast-forward protection" if {
  input.state == "github-governance"
  not github_permanent_ruleset_ok
}

coverage contains "pages-main-pinned-compatibility-fail-closed-distinct-d1" if { input.state == "cloudflare-shared"; pages_project_ok }
coverage contains "zone-https-tls-strict" if { input.state == "cloudflare-shared"; zone_tls_ok }
coverage contains "turnstile-custom-managed-no-clearance" if { input.state == "cloudflare-shared"; turnstile_ok }
coverage contains "waf-contact-rate-limits" if { input.state == "cloudflare-shared"; rate_limits_ok }
coverage contains "preview-adopted-d1-name" if { input.state == "cloudflare-preview"; d1_ok("smart-portfolio-contact-rate-limit-preview") }
coverage contains "preview-access-human-custom-host-application" if { input.state == "cloudflare-preview"; human_access_application_ok }
coverage contains "preview-access-pages-service-application" if { input.state == "cloudflare-preview"; pages_service_access_application_ok }
coverage contains "preview-access-human-identities-and-idp" if { input.state == "cloudflare-preview"; human_access_policy_ok }
coverage contains "preview-access-pages-narrow-service-token" if { input.state == "cloudflare-preview"; pages_service_access_policy_ok }
coverage contains "production-adopted-d1-name" if { input.state == "cloudflare-production"; d1_ok("smart-portfolio-contact-rate-limit-production") }
coverage contains "audit-queue-and-dlq-retention" if { input.state == "cloudflare-audit"; audit_queues_ok }
coverage contains "audit-private-buckets" if { input.state == "cloudflare-audit"; audit_buckets_ok }
coverage contains "audit-r2-age-locks" if { input.state == "cloudflare-audit"; audit_locks_ok }
coverage contains "audit-r2-lifecycle-deletion" if { input.state == "cloudflare-audit"; audit_lifecycles_ok }
coverage contains "audit-r2-public-access-disabled" if { input.state == "cloudflare-audit"; r2_public_access_disabled }
coverage contains "audit-collector-sealed-private-r2-binding" if { input.state == "cloudflare-audit"; audit_collector_script_ok }
coverage contains "audit-collector-no-workers-dev-or-preview" if { input.state == "cloudflare-audit"; audit_collector_private_ok }
coverage contains "audit-collector-queue-consumer" if { input.state == "cloudflare-audit"; audit_collector_consumer_ok }
coverage contains "github-single-permanent-branch-integrity-ruleset" if { input.state == "github-governance"; github_permanent_ruleset_ok }
