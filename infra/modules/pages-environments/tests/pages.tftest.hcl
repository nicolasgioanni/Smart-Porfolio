mock_provider "cloudflare" {}

variables {
  account_id                   = "00000000000000000000000000000000"
  project_name                 = "smart-portfolio"
  production_d1_id             = "11111111-1111-1111-1111-111111111111"
  preview_d1_id                = "22222222-2222-2222-2222-222222222222"
  production_allowed_origins   = "https://nicolasmgioanni.dev,https://www.nicolasmgioanni.dev"
  preview_allowed_origins      = "https://preview.nicolasmgioanni.dev"
  production_allowed_hostnames = "nicolasmgioanni.dev,www.nicolasmgioanni.dev"
  preview_allowed_hostnames    = "preview.nicolasmgioanni.dev"
  compatibility_date           = "2026-08-27"
}

run "secure_defaults_bind_distinct_databases" {
  command = plan
  assert {
    condition     = cloudflare_pages_project.this.deployment_configs.production.fail_open == false && cloudflare_pages_project.this.deployment_configs.preview.fail_open == false
    error_message = "Pages environment application must fail closed."
  }
  assert {
    condition     = cloudflare_pages_project.this.deployment_configs.production.d1_databases.CONTACT_RATE_LIMIT_DB.id != cloudflare_pages_project.this.deployment_configs.preview.d1_databases.CONTACT_RATE_LIMIT_DB.id
    error_message = "Production and preview must not share D1."
  }
  assert {
    condition     = cloudflare_pages_project.this.deployment_configs.production.compatibility_date == "2026-08-27" && cloudflare_pages_project.this.deployment_configs.preview.compatibility_date == "2026-08-27"
    error_message = "Both deployments must use the reviewed pinned compatibility date."
  }

}

run "rejects_shared_d1" {
  command = plan
  variables { preview_d1_id = "11111111-1111-1111-1111-111111111111" }
  expect_failures = [cloudflare_pages_project.this]
}

run "rejects_pages_domain_origin" {
  command = plan
  variables { preview_allowed_origins = "https://develop.smart-portfolio.pages.dev" }
  expect_failures = [var.preview_allowed_origins]
}

run "rejects_wildcard_origin" {
  command = plan
  variables { production_allowed_origins = "https://*.nicolasmgioanni.dev" }
  expect_failures = [var.production_allowed_origins]
}

run "rejects_malformed_origin" {
  command = plan
  variables { production_allowed_origins = "nicolasmgioanni.dev" }
  expect_failures = [var.production_allowed_origins]
}

run "rejects_unpinned_compatibility_date" {
  command = plan
  variables { compatibility_date = "latest" }
  expect_failures = [var.compatibility_date]
}

run "rejects_origin_hostname_mismatch" {
  command = plan
  variables { preview_allowed_origins = "https://untrusted.nicolasmgioanni.dev" }
  expect_failures = [cloudflare_pages_project.this]
}

run "rejects_overlapping_turnstile_hostnames" {
  command = plan
  variables {
    preview_allowed_origins   = "https://www.nicolasmgioanni.dev,https://preview.nicolasmgioanni.dev"
    preview_allowed_hostnames = "www.nicolasmgioanni.dev,preview.nicolasmgioanni.dev"
  }
  expect_failures = [cloudflare_pages_project.this]
}
