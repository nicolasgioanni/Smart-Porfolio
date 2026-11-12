# Infrastructure

Owns the tracked [Terraform source](../../infra/README.md#offline-checks) and [ownership validation](../../infra/validate-ownership.mjs). Read [Terraform ownership](../../docs/infrastructure/TERRAFORM_OWNERSHIP.md#local-source-checks) and the release-security skill before changes.

Run the [plan tests](../../infra/tests/check-plan.test.mjs) and `npm run docs:check`. Configuration, artifact integrity, and observed live posture are separate evidence.
