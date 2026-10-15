# Terraform ownership preparation

Smart Portfolio keeps Terraform preparation separate from its current release path. The existing GitHub Actions and Wrangler Direct Upload process remains responsible for verified static exports, Pages Functions, D1 migrations, and deployment. [`infra/`](../../infra/README.md) declares only an empty remote-backend type; it introduces no remote organization or workspace configuration, provider credentials, import, apply, or live control.

The proposed isolated states divide future review of shared Pages and edge controls, preview D1 and optional Access, production D1, optional audit storage, and the existing permanent-branch ruleset. They are source intent only. They do not prove Cloudflare, GitHub, HCP Terraform, resource IDs, state, entitlement, or runtime configuration.

The GitHub state is intentionally narrow. It has one future adopted resource, `protect-permanent-branches`, covering `main` and `develop` with deletion and non-fast-forward protection and no bypass. Classic `main` pull-request policy remains outside Terraform ownership. GitHub environment APIs returned no environments on 2026-10-12, so this preparation neither creates nor claims `production` or `preview` environments.

An authorized operator must use the [adoption sequence](../../infra/ADOPTION.md), which requires independently verified workspace, state, and provider evidence; preview-before-production sequencing; and a reviewed no-op saved plan. The saved-plan guard requires a clean committed checkout, hashes the full reviewed root, local-module, and lock closure, binds each plan resource to a private physical-ID inventory and account or repository identity, reruns `terraform show -json`, and invokes canonical plan/OPA controls. It rejects imports, deletes, replacements, unknown values, drift, cross-state resources, overrides, symbolic links, and expanded governance rules. It never authorizes a mutation.

## Local source checks

Run the source and saved-plan contracts locally:

```sh
npm run infrastructure:check
npm run test:infrastructure
TERRAFORM_BIN=/absolute/pinned/terraform OPA_BIN=/absolute/pinned/opa node --test infra/tests/check-plan.test.mjs infra/tests/mock-plan-export.test.mjs
```

These commands require the supplied pinned tools and use backend-disabled, credential-free, mock or private temporary inputs only. They are not wired into CI, deployment, `verify`, a receipt, a scheduled run, or runtime posture. They do not activate infrastructure or establish live provider state.
