resource "cloudflare_d1_database" "contact_rate_limit" {
  account_id = var.cloudflare_account_id
  name       = "smart-portfolio-contact-rate-limit-production"

  lifecycle {
    prevent_destroy = true
  }
}
