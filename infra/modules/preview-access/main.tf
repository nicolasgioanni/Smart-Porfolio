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
variable "preview_hostname" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$", var.preview_hostname)) && !strcontains(var.preview_hostname, "*") && !endswith(var.preview_hostname, ".pages.dev")
    error_message = "Preview Access must protect one exact custom hostname."
  }
}
variable "identity_provider_id" {
  type = string
  validation {
    condition     = can(regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", var.identity_provider_id))
    error_message = "Preview Access requires one explicit identity-provider UUID."
  }
}
variable "allowed_emails" {
  type = set(string)
  validation {
    condition     = length(var.allowed_emails) > 0 && alltrue([for email in var.allowed_emails : can(regex("^[^@[:space:]]+@[^@[:space:]]+\\.[^@[:space:]]+$", email))])
    error_message = "Preview Access requires explicit allowed email identities."
  }
}
variable "allowed_group_ids" {
  type    = set(string)
  default = []
  validation {
    condition     = alltrue([for id in var.allowed_group_ids : can(regex("^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$", id))])
    error_message = "Preview Access group IDs must be explicit UUIDs."
  }
}
variable "pages_preview_domain" {
  type = string
  validation {
    condition     = var.pages_preview_domain == "*.smart-portfolio-bds.pages.dev"
    error_message = "Preview service authentication must cover the reviewed Pages preview namespace only."
  }
}
variable "service_token_id" {
  type = string
  validation {
    condition     = can(regex("^[A-Za-z0-9_-]{1,128}$", var.service_token_id))
    error_message = "Preview service authentication requires the adopted opaque service-token identifier, never a client secret."
  }
}

resource "cloudflare_zero_trust_access_policy" "preview_identities" {
  account_id = var.account_id
  name       = "smart-portfolio-preview-allowed-identities"
  decision   = "allow"
  exclude    = []
  include = concat(
    [for email in var.allowed_emails : { email = { email = email } }],
    [for id in var.allowed_group_ids : { group = { id = id } }],
  )
  require = [{ login_method = { id = var.identity_provider_id } }]
}

resource "cloudflare_zero_trust_access_application" "preview" {
  account_id                  = var.account_id
  zone_id                     = var.zone_id
  name                        = "smart-portfolio-preview"
  domain                      = var.preview_hostname
  type                        = "self_hosted"
  allow_authenticate_via_warp = false
  app_launcher_visible        = false
  auto_redirect_to_identity   = true
  options_preflight_bypass    = false
  policies = [{
    id         = cloudflare_zero_trust_access_policy.preview_identities.id
    precedence = 1
  }]
}

# This policy stores only the adopted token identifier. Client credentials stay
# in the later protected preview environment and are never Terraform inputs.
resource "cloudflare_zero_trust_access_policy" "preview_service_auth" {
  account_id = var.account_id
  name       = "smart-portfolio-preview-service-auth"
  decision   = "non_identity"
  include    = [{ service_token = { token_id = var.service_token_id } }]
  exclude    = []
  require    = []
}

resource "cloudflare_zero_trust_access_application" "preview_service_auth" {
  account_id                  = var.account_id
  name                        = "smart-portfolio-preview-service-auth"
  domain                      = var.pages_preview_domain
  type                        = "self_hosted"
  allow_authenticate_via_warp = false
  app_launcher_visible        = false
  auto_redirect_to_identity   = false
  options_preflight_bypass    = false
  policies = [{
    id         = cloudflare_zero_trust_access_policy.preview_service_auth.id
    precedence = 1
    }, {
    id         = cloudflare_zero_trust_access_policy.preview_identities.id
    precedence = 2
  }]
}
