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
    condition     = var.d1_name == "smart-portfolio-contact-rate-limit-production"
    error_message = "D1 name must be the reviewed existing production rate-limit database name."
  }
}
resource "cloudflare_d1_database" "contact_rate_limit" {
  account_id = var.cloudflare_account_id
  name       = var.d1_name
  lifecycle { prevent_destroy = true }
}
