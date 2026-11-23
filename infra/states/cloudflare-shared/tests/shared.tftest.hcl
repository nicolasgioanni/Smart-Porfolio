mock_provider "cloudflare" {}

variables {
  cloudflare_account_id        = "0123456789abcdef0123456789abcdef"
  pages_project_name           = "smart-portfolio"
  production_d1_id             = "11111111-1111-1111-1111-111111111111"
  preview_d1_id                = "22222222-2222-2222-2222-222222222222"
  production_allowed_origins   = "https://nicolasmgioanni.dev,https://www.nicolasmgioanni.dev"
  preview_allowed_origins      = "https://preview.nicolasmgioanni.dev"
  production_allowed_hostnames = "nicolasmgioanni.dev,www.nicolasmgioanni.dev"
  preview_allowed_hostnames    = "preview.nicolasmgioanni.dev"
  compatibility_date           = "2026-08-27"
  cloudflare_zone_id           = "fedcba9876543210fedcba9876543210"
  production_widget_domains    = ["nicolasmgioanni.dev", "www.nicolasmgioanni.dev"]
  preview_widget_domains       = ["preview.nicolasmgioanni.dev"]
  production_api_hostname      = "nicolasmgioanni.dev"
  preview_api_hostname         = "preview.nicolasmgioanni.dev"
}

run "shared_pages_project_owns_both_environments" {
  command = plan

  assert {
    condition     = !module.pages_environments.deployment_security.production_fail_open && !module.pages_environments.deployment_security.preview_fail_open && module.pages_environments.deployment_security.d1_ids_are_distinct
    error_message = "The shared Pages project must fail closed for production and preview."
  }

}
