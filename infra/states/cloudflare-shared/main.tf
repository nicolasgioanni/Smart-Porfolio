terraform {
  backend "remote" {}
}

# The adopted Pages project is the sole owner of both deployment configurations.
variable "cloudflare_account_id" {
  type      = string
  sensitive = true
}
variable "pages_project_name" {
  type = string
  validation {
    condition     = can(regex("^[a-z0-9-]{3,58}$", var.pages_project_name))
    error_message = "Pages project name must be a safe identifier."
  }
}

variable "production_d1_id" { type = string }
variable "preview_d1_id" { type = string }
variable "production_allowed_origins" { type = string }
variable "preview_allowed_origins" { type = string }
variable "production_allowed_hostnames" { type = string }
variable "preview_allowed_hostnames" { type = string }
variable "compatibility_date" { type = string }
variable "cloudflare_zone_id" { type = string }
variable "production_widget_domains" { type = set(string) }
variable "preview_widget_domains" { type = set(string) }
variable "production_api_hostname" { type = string }
variable "preview_api_hostname" { type = string }

module "pages_environments" {
  source                       = "../../modules/pages-environments"
  account_id                   = var.cloudflare_account_id
  project_name                 = var.pages_project_name
  production_d1_id             = var.production_d1_id
  preview_d1_id                = var.preview_d1_id
  production_allowed_origins   = var.production_allowed_origins
  preview_allowed_origins      = var.preview_allowed_origins
  production_allowed_hostnames = var.production_allowed_hostnames
  preview_allowed_hostnames    = var.preview_allowed_hostnames
  compatibility_date           = var.compatibility_date
}

module "edge_controls" {
  source                    = "../../modules/edge-controls"
  account_id                = var.cloudflare_account_id
  zone_id                   = var.cloudflare_zone_id
  production_widget_domains = var.production_widget_domains
  preview_widget_domains    = var.preview_widget_domains
  production_allowed_hostnames = toset([
    for hostname in split(",", var.production_allowed_hostnames) : trimspace(hostname)
  ])
  preview_allowed_hostnames = toset([
    for hostname in split(",", var.preview_allowed_hostnames) : trimspace(hostname)
  ])
  production_api_hostname = var.production_api_hostname
  preview_api_hostname    = var.preview_api_hostname
}
