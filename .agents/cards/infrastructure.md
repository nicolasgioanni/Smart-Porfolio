# infrastructure

Terraform ownership, plan policy and branch ruleset. Inspect tracked Terraform ownership, policy and local tests without treating fixtures as live state.

Start at `infra/validate-ownership.mjs` and inspect `infra/tests/saved-plan.test.mjs`. Read the [portfolio-release-security](../skills/portfolio-release-security/SKILL.md) and [authority](../../docs/infrastructure/TERRAFORM_OWNERSHIP.md#local-source-checks) for this contract. Run `npm run infrastructure:check` as applicable.

Consumers: ci, release. Adoption or cloud mutation requires explicit authorization; coordinate with release and CI owners.
