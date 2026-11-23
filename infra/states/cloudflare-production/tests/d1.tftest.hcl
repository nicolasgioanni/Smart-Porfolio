mock_provider "cloudflare" {}

variables {
  cloudflare_account_id = "0123456789abcdef0123456789abcdef"
  d1_name               = "smart-portfolio-contact-rate-limit-production"
}

run "production_database_is_scoped" {
  command = plan
  assert {
    condition     = cloudflare_d1_database.contact_rate_limit.name == "smart-portfolio-contact-rate-limit-production"
    error_message = "Production D1 must use the reviewed existing database name."
  }
}

run "rejects_unscoped_database_name" {
  command = plan
  variables { d1_name = "rate-limit" }
  expect_failures = [var.d1_name]
}
