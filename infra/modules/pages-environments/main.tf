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
variable "project_name" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9-]{3,58}$", var.project_name))
    error_message = "Pages project name must be a safe identifier."
  }
}
variable "production_d1_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", var.production_d1_id))
    error_message = "Production D1 ID must be a UUID."
  }
}
variable "preview_d1_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", var.preview_d1_id))
    error_message = "Preview D1 ID must be a UUID."
  }
}
variable "production_allowed_origins" {
  type = string
  validation {
    condition = alltrue([
      for origin in split(",", var.production_allowed_origins) : can(regex("^https://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", trimspace(origin))) && !endswith(trimprefix(trimspace(origin), "https://"), ".pages.dev")
    ])
    error_message = "Production origins must be exact HTTPS custom origins."
  }
}
variable "preview_allowed_origins" {
  type = string
  validation {
    condition = alltrue([
      for origin in split(",", var.preview_allowed_origins) : can(regex("^https://[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", trimspace(origin))) && !endswith(trimprefix(trimspace(origin), "https://"), ".pages.dev")
    ])
    error_message = "Preview origins must be exact HTTPS custom origins."
  }
}
variable "production_allowed_hostnames" {
  type = string
  validation {
    condition = alltrue([
      for hostname in split(",", var.production_allowed_hostnames) : can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", trimspace(hostname))) && !endswith(trimspace(hostname), ".pages.dev")
    ])
    error_message = "Production Turnstile hostnames must be exact custom hostnames."
  }
}
variable "preview_allowed_hostnames" {
  type = string
  validation {
    condition = alltrue([
      for hostname in split(",", var.preview_allowed_hostnames) : can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", trimspace(hostname))) && !endswith(trimspace(hostname), ".pages.dev")
    ])
    error_message = "Preview Turnstile hostnames must be exact custom hostnames."
  }
}
variable "compatibility_date" {
  type = string
  validation {
    condition     = can(formatdate("YYYY-MM-DD", "${var.compatibility_date}T00:00:00Z")) ? formatdate("YYYY-MM-DD", "${var.compatibility_date}T00:00:00Z") == var.compatibility_date : false
    error_message = "Compatibility date must be a concrete ISO 8601 calendar date (YYYY-MM-DD)."
  }
}

resource "cloudflare_pages_project" "this" {
  account_id        = var.account_id
  name              = var.project_name
  production_branch = "main"
  deployment_configs = {
    production = {
      compatibility_date = var.compatibility_date
      fail_open          = false
      d1_databases       = { CONTACT_RATE_LIMIT_DB = { id = var.production_d1_id } }
    }
    preview = {
      compatibility_date = var.compatibility_date
      fail_open          = false
      d1_databases       = { CONTACT_RATE_LIMIT_DB = { id = var.preview_d1_id } }
    }
  }
  lifecycle {
    # env_vars is an optional complete map. Existing runtime secrets and values are
    # deliberately operated outside Terraform, so adoption must not replace it.
    ignore_changes = [
      deployment_configs["production"].env_vars,
      deployment_configs["preview"].env_vars,
    ]
    precondition {
      condition     = var.production_d1_id != var.preview_d1_id
      error_message = "Production and preview must use different D1 databases."
    }
    precondition {
      condition     = length(setintersection(toset([for hostname in split(",", var.production_allowed_hostnames) : trimspace(hostname)]), toset([for hostname in split(",", var.preview_allowed_hostnames) : trimspace(hostname)]))) == 0
      error_message = "Production and preview Turnstile hostname contracts must be disjoint."
    }
    precondition {
      condition     = toset([for origin in split(",", var.production_allowed_origins) : trimprefix(trimspace(origin), "https://")]) == toset([for hostname in split(",", var.production_allowed_hostnames) : trimspace(hostname)])
      error_message = "Production API origins must exactly match production Turnstile hostnames."
    }
    precondition {
      condition     = toset([for origin in split(",", var.preview_allowed_origins) : trimprefix(trimspace(origin), "https://")]) == toset([for hostname in split(",", var.preview_allowed_hostnames) : trimspace(hostname)])
      error_message = "Preview API origins must exactly match preview Turnstile hostnames."
    }
  }
}

output "deployment_security" {
  description = "Non-secret deployment security assertions for the shared Pages project."
  value = {
    production_fail_open = cloudflare_pages_project.this.deployment_configs.production.fail_open
    preview_fail_open    = cloudflare_pages_project.this.deployment_configs.preview.fail_open
    d1_ids_are_distinct  = var.production_d1_id != var.preview_d1_id
    production_origins   = toset([for origin in split(",", var.production_allowed_origins) : trimspace(origin)])
    preview_origins      = toset([for origin in split(",", var.preview_allowed_origins) : trimspace(origin)])
  }
}
