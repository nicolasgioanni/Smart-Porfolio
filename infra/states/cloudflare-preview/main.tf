terraform {
  backend "remote" {}
}
variable "cloudflare_account_id" {
  type      = string
  sensitive = true
  validation {
    condition     = can(regex("^[a-f0-9]{32}$", var.cloudflare_account_id))
    error_message = "Cloudflare account ID must be a 32-character lowercase hexadecimal ID."
  }
}
variable "d1_name" {
  type = string
  validation {
    condition     = var.d1_name == "smart-portfolio-contact-rate-limit-preview"
    error_message = "D1 name must be the reviewed existing preview rate-limit database name."
  }
}
variable "cloudflare_zone_id" { type = string }
variable "preview_hostname" { type = string }
variable "preview_access_identity_provider_id" { type = string }
variable "preview_access_allowed_emails" { type = set(string) }
variable "preview_access_allowed_group_ids" {
  type    = set(string)
  default = []
}
variable "preview_pages_domain" {
  type = string
  validation {
    condition     = var.preview_pages_domain == "*.smart-portfolio-bds.pages.dev"
    error_message = "Preview Pages Access must cover the reviewed Pages preview namespace only."
  }
}
variable "preview_access_service_token_id" {
  type = string
  validation {
    condition     = can(regex("^[A-Za-z0-9_-]{1,128}$", var.preview_access_service_token_id))
    error_message = "Preview Access needs an adopted service-token identifier, not a secret."
  }
}
resource "cloudflare_d1_database" "contact_rate_limit" {
  account_id = var.cloudflare_account_id
  name       = var.d1_name
  lifecycle { prevent_destroy = true }
}

module "preview_access" {
  source               = "../../modules/preview-access"
  account_id           = var.cloudflare_account_id
  zone_id              = var.cloudflare_zone_id
  preview_hostname     = var.preview_hostname
  identity_provider_id = var.preview_access_identity_provider_id
  allowed_emails       = var.preview_access_allowed_emails
  allowed_group_ids    = var.preview_access_allowed_group_ids
  pages_preview_domain = var.preview_pages_domain
  service_token_id     = var.preview_access_service_token_id
}
