mock_provider "cloudflare" {}

variables {
  account_id           = "0123456789abcdef0123456789abcdef"
  zone_id              = "fedcba9876543210fedcba9876543210"
  preview_hostname     = "preview.nicolasmgioanni.dev"
  identity_provider_id = "11111111-1111-1111-1111-111111111111"
  allowed_emails       = ["owner@example.com"]
  pages_preview_domain = "*.smart-portfolio-bds.pages.dev"
  service_token_id     = "preview-service-token-id"
}

run "preview_requires_explicit_identity" {
  command = plan
  assert {
    condition     = cloudflare_zero_trust_access_application.preview.domain == "preview.nicolasmgioanni.dev" && cloudflare_zero_trust_access_application.preview.type == "self_hosted" && cloudflare_zero_trust_access_application.preview.allow_authenticate_via_warp == false && cloudflare_zero_trust_access_application.preview.options_preflight_bypass == false && cloudflare_zero_trust_access_policy.preview_identities.decision == "allow" && length(cloudflare_zero_trust_access_policy.preview_identities.exclude) == 0 && length(cloudflare_zero_trust_access_policy.preview_identities.include) > 0 && length(cloudflare_zero_trust_access_policy.preview_identities.require) == 1 && cloudflare_zero_trust_access_application.preview_service_auth.domain == "*.smart-portfolio-bds.pages.dev" && cloudflare_zero_trust_access_application.preview_service_auth.zone_id == null && cloudflare_zero_trust_access_application.preview_service_auth.auto_redirect_to_identity == false && cloudflare_zero_trust_access_policy.preview_service_auth.decision == "non_identity" && length(cloudflare_zero_trust_access_policy.preview_service_auth.include) == 1 && length(cloudflare_zero_trust_access_policy.preview_service_auth.exclude) == 0 && length(cloudflare_zero_trust_access_policy.preview_service_auth.require) == 0 && length(cloudflare_zero_trust_access_application.preview_service_auth.policies) == 2 && cloudflare_zero_trust_access_application.preview_service_auth.policies[0].precedence == 1 && cloudflare_zero_trust_access_application.preview_service_auth.policies[1].precedence == 2
    error_message = "Preview Access must keep the human custom-host and narrow Pages service-token policies separate."
  }
}

run "rejects_pages_dev_preview_hostname" {
  command = plan
  variables { preview_hostname = "preview.smart-portfolio.pages.dev" }
  expect_failures = [var.preview_hostname]
}

run "rejects_invalid_identity_provider" {
  command = plan
  variables { identity_provider_id = "not-an-identity-provider" }
  expect_failures = [var.identity_provider_id]
}

run "rejects_invalid_allowed_group" {
  command = plan
  variables { allowed_group_ids = ["not-a-group-id"] }
  expect_failures = [var.allowed_group_ids]
}

run "rejects_other_pages_namespace" {
  command = plan
  variables { pages_preview_domain = "*.other.pages.dev" }
  expect_failures = [var.pages_preview_domain]
}

run "rejects_service_secret_as_identifier" {
  command = plan
  variables { service_token_id = "contains whitespace" }
  expect_failures = [var.service_token_id]
}
