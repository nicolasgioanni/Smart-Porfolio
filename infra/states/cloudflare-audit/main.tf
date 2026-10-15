terraform {
  backend "remote" {}
  required_version = "~> 1.16.0"
  required_providers {
    cloudflare = {
      source  = "cloudflare/cloudflare"
      version = "5.27.0"
    }
  }
}
variable "cloudflare_account_id" {
  type      = string
  sensitive = true
}

# This state deliberately consumes a previously sealed collector bundle. The
# collector upload belongs to separately authorized adoption, not the current
# Pages release workflow. Never rebuild source during a saved-plan apply.
variable "collector_bundle_path" {
  type = string
  validation {
    condition     = can(regex("(^|.*/)release/collector/index\\.js$", replace(var.collector_bundle_path, "\\", "/")))
    error_message = "Collector uploads must use the sealed release/collector/index.js bundle."
  }
}

variable "collector_bundle_sha256" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{64}$", var.collector_bundle_sha256))
    error_message = "Collector bundle SHA-256 must be a lowercase 64-character hexadecimal digest."
  }
}

resource "cloudflare_queue" "audit_events" {
  account_id = var.cloudflare_account_id
  queue_name = "smart-portfolio-audit-events"
  settings   = { delivery_delay = 0, message_retention_period = 1209600 }
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_queue" "audit_events_dlq" {
  account_id = var.cloudflare_account_id
  queue_name = "smart-portfolio-audit-events-dlq"
  settings   = { delivery_delay = 0, message_retention_period = 1209600 }
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_r2_bucket" "application_audit" {
  account_id = var.cloudflare_account_id
  name       = "smart-portfolio-application-audit"
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_r2_bucket" "release_control" {
  account_id = var.cloudflare_account_id
  name       = "smart-portfolio-release-control"
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_r2_bucket_lock" "application_audit" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.application_audit.name
  rules       = [{ id = "retain-application-audit-90-days", enabled = true, condition = { type = "Age", max_age_seconds = 7776000 } }]
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_r2_bucket_lock" "release_control" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.release_control.name
  rules       = [{ id = "retain-release-control-365-days", enabled = true, condition = { type = "Age", max_age_seconds = 31536000 } }]
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_r2_bucket_lifecycle" "application_audit" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.application_audit.name
  rules = [{
    id         = "delete-application-audit-after-90-days"
    enabled    = true
    conditions = { prefix = "" }
    delete_objects_transition = {
      condition = { type = "Age", max_age = 7776000 }
    }
  }]
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_r2_bucket_lifecycle" "release_control" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.release_control.name
  rules = [{
    id         = "delete-release-control-after-365-days"
    enabled    = true
    conditions = { prefix = "" }
    delete_objects_transition = {
      condition = { type = "Age", max_age = 31536000 }
    }
  }]
  lifecycle { prevent_destroy = true }
}

# Explicit disabled declarations prevent a future adoption from silently
# enabling public r2.dev access for either audit bucket.
resource "cloudflare_r2_managed_domain" "application_audit" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.application_audit.name
  enabled     = false
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_r2_managed_domain" "release_control" {
  account_id  = var.cloudflare_account_id
  bucket_name = cloudflare_r2_bucket.release_control.name
  enabled     = false
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_workers_script" "audit_collector" {
  account_id         = var.cloudflare_account_id
  script_name        = "smart-portfolio-audit-collector"
  content_file       = var.collector_bundle_path
  content_sha256     = var.collector_bundle_sha256
  main_module        = "index.js"
  compatibility_date = "2026-08-27"
  bindings = [{
    name        = "APP_AUDIT_BUCKET"
    type        = "r2_bucket"
    bucket_name = cloudflare_r2_bucket.application_audit.name
  }]
  lifecycle { prevent_destroy = true }
}

# This Worker has no public Worker URL or preview URL. Its sole invocation
# path is the audited Queue consumer declared below.
resource "cloudflare_workers_script_subdomain" "audit_collector" {
  account_id       = var.cloudflare_account_id
  script_name      = cloudflare_workers_script.audit_collector.script_name
  enabled          = false
  previews_enabled = false
  lifecycle { prevent_destroy = true }
}

resource "cloudflare_queue_consumer" "audit_collector" {
  account_id        = var.cloudflare_account_id
  queue_id          = cloudflare_queue.audit_events.id
  type              = "worker"
  script_name       = cloudflare_workers_script.audit_collector.script_name
  dead_letter_queue = cloudflare_queue.audit_events_dlq.queue_name
  settings = {
    batch_size       = 10
    max_wait_time_ms = 5000
    max_retries      = 5
  }
  lifecycle { prevent_destroy = true }
}
