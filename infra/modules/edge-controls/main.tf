terraform {
  required_providers {
    cloudflare = { source = "cloudflare/cloudflare", version = "5.27.0" }
  }
}

variable "account_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.account_id))
    error_message = "Cloudflare account ID must be a 32-character lowercase hexadecimal ID."
  }
}
variable "zone_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.zone_id))
    error_message = "Cloudflare zone ID must be a 32-character lowercase hexadecimal ID."
  }
}
variable "production_widget_domains" { type = set(string) }
variable "preview_widget_domains" { type = set(string) }
variable "production_allowed_hostnames" { type = set(string) }
variable "preview_allowed_hostnames" { type = set(string) }
variable "production_api_hostname" { type = string }
variable "preview_api_hostname" { type = string }

locals {
  all_widget_domains = setunion(var.production_widget_domains, var.preview_widget_domains)
  hostname_pattern   = "^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$"
}

resource "cloudflare_zone_setting" "always_use_https" {
  zone_id    = var.zone_id
  setting_id = "always_use_https"
  value      = "on"
}

resource "cloudflare_zone_setting" "minimum_tls" {
  zone_id    = var.zone_id
  setting_id = "min_tls_version"
  value      = "1.2"
}
resource "cloudflare_zone_setting" "tls_1_3" {
  zone_id    = var.zone_id
  setting_id = "tls_1_3"
  value      = "on"
}

resource "cloudflare_zone_setting" "strict_origin_tls" {
  zone_id    = var.zone_id
  setting_id = "ssl"
  value      = "strict"
}

resource "cloudflare_turnstile_widget" "production" {
  account_id      = var.account_id
  name            = "smart-portfolio-production"
  domains         = sort(tolist(var.production_widget_domains))
  mode            = "managed"
  clearance_level = "no_clearance"
  lifecycle {
    precondition {
      condition     = length(var.production_widget_domains) > 0 && alltrue([for hostname in var.production_widget_domains : can(regex(local.hostname_pattern, hostname)) && !strcontains(hostname, "*") && !endswith(hostname, ".pages.dev")])
      error_message = "Production Turnstile domains must be exact custom hostnames."
    }
    precondition {
      condition     = contains(var.production_widget_domains, var.production_api_hostname)
      error_message = "Production API hostname must be registered on the production Turnstile widget."
    }
    precondition {
      condition     = var.production_widget_domains == var.production_allowed_hostnames
      error_message = "Production Turnstile and approved contact hostnames must match exactly."
    }
  }
}

resource "cloudflare_turnstile_widget" "preview" {
  account_id      = var.account_id
  name            = "smart-portfolio-preview"
  domains         = sort(tolist(var.preview_widget_domains))
  mode            = "managed"
  clearance_level = "no_clearance"
  lifecycle {
    precondition {
      condition     = length(var.preview_widget_domains) > 0 && alltrue([for hostname in var.preview_widget_domains : can(regex(local.hostname_pattern, hostname)) && !strcontains(hostname, "*") && !endswith(hostname, ".pages.dev")])
      error_message = "Preview Turnstile domains must be exact custom hostnames."
    }
    precondition {
      condition     = length(setintersection(var.production_widget_domains, var.preview_widget_domains)) == 0
      error_message = "Production and preview Turnstile domains must be disjoint."
    }
    precondition {
      condition     = contains(var.preview_widget_domains, var.preview_api_hostname)
      error_message = "Preview API hostname must be registered on the preview Turnstile widget."
    }
    precondition {
      condition     = var.preview_widget_domains == var.preview_allowed_hostnames
      error_message = "Preview Turnstile and approved contact hostnames must match exactly."
    }
  }
}

# Zone rate limiting is a WAF Rulesets entry point. Do not add a second
# http_ratelimit ruleset outside this module for the same zone.
resource "cloudflare_ruleset" "contact_rate_limits" {
  zone_id     = var.zone_id
  name        = "smart-portfolio-contact-rate-limits"
  description = "Fail-closed abuse limits for the production and preview contact endpoints."
  kind        = "zone"
  phase       = "http_ratelimit"
  rules = [
    for endpoint in flatten([
      for host in concat(
        [for hostname in sort(tolist(var.production_widget_domains)) : { prefix = "production", hostname = hostname }],
        [for hostname in sort(tolist(var.preview_widget_domains)) : { prefix = "preview", hostname = hostname }],
        ) : [
        { ref = "${host.prefix}_${replace(host.hostname, ".", "_")}_contact", hostname = host.hostname, path = "/api/contact" },
        { ref = "${host.prefix}_${replace(host.hostname, ".", "_")}_verify", hostname = host.hostname, path = "/api/contact/verify" },
      ]
      ]) : {
      ref               = endpoint.ref
      description       = "Rate limit POST ${endpoint.path} for ${endpoint.hostname} by source IP."
      expression        = "http.host eq \"${endpoint.hostname}\" and http.request.method eq \"POST\" and http.request.uri.path eq \"${endpoint.path}\""
      action            = "block"
      enabled           = true
      action_parameters = { response = { status_code = 429, content_type = "application/json", content = "{\"error\":\"rate_limited\"}" } }
      ratelimit = {
        characteristics     = ["cf.colo.id", "ip.src"]
        period              = 60
        requests_per_period = 5
        mitigation_timeout  = 600
      }
    }
  ]
}
