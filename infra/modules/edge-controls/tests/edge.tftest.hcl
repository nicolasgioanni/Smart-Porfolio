mock_provider "cloudflare" {}

variables {
  account_id                   = "0123456789abcdef0123456789abcdef"
  zone_id                      = "fedcba9876543210fedcba9876543210"
  production_widget_domains    = ["nicolasmgioanni.dev", "www.nicolasmgioanni.dev"]
  preview_widget_domains       = ["preview.nicolasmgioanni.dev"]
  production_allowed_hostnames = ["nicolasmgioanni.dev", "www.nicolasmgioanni.dev"]
  preview_allowed_hostnames    = ["preview.nicolasmgioanni.dev"]
  production_api_hostname      = "nicolasmgioanni.dev"
  preview_api_hostname         = "preview.nicolasmgioanni.dev"
}

run "edge_controls_are_fail_closed" {
  command = plan
  assert {
    condition     = cloudflare_zone_setting.always_use_https.value == "on" && cloudflare_zone_setting.minimum_tls.value == "1.2" && cloudflare_zone_setting.strict_origin_tls.value == "strict"
    error_message = "Zone HTTPS, TLS minimum, and strict origin TLS must be enabled."
  }
  assert {
    condition     = cloudflare_turnstile_widget.production.mode == "managed" && cloudflare_turnstile_widget.production.clearance_level == "no_clearance" && cloudflare_turnstile_widget.preview.mode == "managed" && cloudflare_turnstile_widget.preview.clearance_level == "no_clearance"
    error_message = "Turnstile widgets must use managed mode with no clearance issuance."
  }
  assert {
    condition     = cloudflare_ruleset.contact_rate_limits.phase == "http_ratelimit" && cloudflare_ruleset.contact_rate_limits.rules[0].ratelimit.requests_per_period == 5 && cloudflare_ruleset.contact_rate_limits.rules[0].ratelimit.period == 60
    error_message = "Contact endpoints require the zone rate-limit entry point."
  }

  assert {
    condition = length(cloudflare_ruleset.contact_rate_limits.rules) == 2 * length(concat(tolist(var.production_allowed_hostnames), tolist(var.preview_allowed_hostnames))) && toset([
      for rule in cloudflare_ruleset.contact_rate_limits.rules : rule.expression
      ]) == toset(flatten([
        for hostname in concat(tolist(var.production_allowed_hostnames), tolist(var.preview_allowed_hostnames)) : [
          "http.host eq \"${hostname}\" and http.request.method eq \"POST\" and http.request.uri.path eq \"/api/contact\"",
          "http.host eq \"${hostname}\" and http.request.method eq \"POST\" and http.request.uri.path eq \"/api/contact/verify\"",
        ]
      ])) && alltrue([
      for rule in cloudflare_ruleset.contact_rate_limits.rules : rule.action == "block" && rule.enabled && toset(rule.ratelimit.characteristics) == toset(["cf.colo.id", "ip.src"]) && rule.ratelimit.mitigation_timeout == 600 && rule.action_parameters.response.status_code == 429 && rule.action_parameters.response.content_type == "application/json" && rule.action_parameters.response.content == jsonencode({ error = "rate_limited" })
    ])
    error_message = "Every approved hostname and contact path must block by colo and source IP for ten minutes with the JSON 429 response."
  }
}

run "rejects_overlapping_widget_domains" {
  command = plan
  variables { preview_widget_domains = ["nicolasmgioanni.dev"] }
  expect_failures = [cloudflare_turnstile_widget.preview]
}

run "rejects_unapproved_widget_hostname" {
  command = plan
  variables { production_widget_domains = ["nicolasmgioanni.dev"] }
  expect_failures = [cloudflare_turnstile_widget.production]
}

run "rejects_pages_dev_widget_domain" {
  command = plan
  variables { preview_widget_domains = ["preview.smart-portfolio.pages.dev"] }
  expect_failures = [cloudflare_turnstile_widget.preview]
}
