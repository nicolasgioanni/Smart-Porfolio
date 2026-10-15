mock_provider "cloudflare" {}

variables {
  cloudflare_account_id               = "0123456789abcdef0123456789abcdef"
  d1_name                             = "smart-portfolio-contact-rate-limit-preview"
  cloudflare_zone_id                  = "fedcba9876543210fedcba9876543210"
  preview_hostname                    = "preview.nicolasmgioanni.dev"
  preview_access_identity_provider_id = "11111111-1111-1111-1111-111111111111"
  preview_access_allowed_emails       = ["owner@example.com"]
  preview_pages_domain                = "*.smart-portfolio-bds.pages.dev"
  preview_access_service_token_id     = "preview-service-token-id"
}

run "preview_database_is_scoped" {
  command = plan
  assert {
    condition     = cloudflare_d1_database.contact_rate_limit.name == "smart-portfolio-contact-rate-limit-preview"
    error_message = "Preview D1 must use the reviewed existing database name."
  }
}

run "rejects_unscoped_database_name" {
  command = plan
  variables { d1_name = "rate-limit" }
  expect_failures = [var.d1_name]
}
