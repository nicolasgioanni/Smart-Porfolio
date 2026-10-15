# Infrastructure ownership preparation

This directory records a proposed Terraform ownership boundary. Its roots declare only an empty `remote` backend type; they do not configure or initialize an HCP Terraform organization, project, workspace, or state. It does not authorize `terraform import`, `terraform apply`, provider mutation, cloud-control creation, plan tier changes, or deployment. The current portfolio remains a Next.js static export on Cloudflare Pages Direct Upload with Pages Functions, D1, Turnstile, Resend, and GitHub governance. Existing release automation remains the owner of deployment and SQL migration application.

Five roots are isolated deliberately. They do not read each other's state, use provider aliases, or contain credentials, account identifiers, remote organization/workspace configuration, tfvars, plans, or state.

| State | Proposed future ownership | Current boundary |
| --- | --- | --- |
| `cloudflare-shared` | Existing Pages project configuration and optional edge controls | Adoption is blocked until the existing project, configuration ownership, custom-host coverage, and account entitlement are independently reviewed. |
| `cloudflare-preview` | Existing preview D1, a human custom-host Access policy, and a separate Pages-preview ServiceAuth policy | The state stores only an adopted service-token identifier. Access is not a requirement of the current Pages preview runtime. |
| `cloudflare-production` | Existing production D1 | SQL migrations remain release-workflow owned. |
| `cloudflare-audit` | Optional private audit storage and collector | The current Pages Function has no required queue binding; this state does not activate auditing. |
| `github-governance` | The existing `protect-permanent-branches` ruleset | It models one active ruleset for exactly `main` and `develop`, with deletion and non-fast-forward protection and no bypass. Classic `main` pull-request protection remains externally owned. |

The GitHub environments API returned an empty collection on 2026-10-12. This source therefore does not claim that `preview` or `production` environments exist and does not manage them. HCP Terraform organization, project, workspace, and state evidence is also absent from this repository. A user-created organization or project is not an adopted workspace or proof of state ownership.

The preview module keeps the human custom hostname and the Pages `*.smart-portfolio-bds.pages.dev` namespace in separate future Access applications. The former has an explicit human identity policy; the latter combines exactly one adopted service-token ID in a `non_identity` policy with the same reviewed human identity policy. It has no token-secret resource or variable. This source does not implement a runtime probe or make Access a current Pages preview requirement. Activation remains blocked until an operator independently proves the Access configuration, required Cloudflare entitlement, protected GitHub `preview` environment, and provider identities.

Provider constraints and lockfiles pin Cloudflare `5.27.0` and GitHub `6.13.0`. Terraform `1.16.5` and OPA `1.21.1` remain in the existing pinned-tool manifest. Local source checks use those explicit tools with no credential source, initialized backend, or apply path.

## Offline checks

```sh
npm run infrastructure:check
npm run test:infrastructure
TERRAFORM_BIN=/absolute/pinned/terraform OPA_BIN=/absolute/pinned/opa npm run test:infrastructure:policy
```

`test:infrastructure` covers saved-plan regressions. `test:infrastructure:policy` requires the pinned Terraform `1.16.5` executable through `TERRAFORM_BIN` and pinned OPA `1.21.1` executable through `OPA_BIN`; it exercises credential-free Terraform mock-plan exports and OPA admission. With those tools supplied, run format, backend-disabled initialization, validation, and mock tests for every root. A missing tool, root contract, lock, fixture, or failed check is a failure. These checks prove source contracts, not adopted infrastructure or live posture; they are not a CI job, receipt, `verify` dependency, or deployment input.

To investigate a particular root locally without credentials:

```sh
terraform -chdir=infra/states/cloudflare-preview init -backend=false -lockfile=readonly
terraform -chdir=infra/states/cloudflare-preview validate
terraform -chdir=infra/states/cloudflare-preview test
OPA_BIN=/absolute/path/to/opa node --test infra/tests/check-plan.test.mjs infra/tests/mock-plan-export.test.mjs
```

The OPA gate only evaluates supplied `terraform show -json` data. It rejects malformed, partial, destructive, replacement, unsupported-provider, and unknown-security-value plans. For the optional audit root it also verifies an external sealed collector bundle record; that record is not generated or consumed by the current release workflow.

## Future saved-plan review

Private plans, state, backend files, provider responses, workspace identifiers, inventories, approvals, and raw evidence must stay outside every Git worktree. [`saved-plan.mjs`](saved-plan.mjs) accepts only a clean committed source checkout and a complete no-op plan. Its private approval binds the state, source, complete local configuration closure (root files, recursively declared local modules, and locks), exact rendered JSON, saved-plan bytes, inspected Terraform binary, workspace identity, and private inventory digest. The inventory binds every protected resource's physical ID and, where applicable, the concrete Cloudflare account or GitHub repository identity. Operational overrides and symbolic links are rejected; the guard reruns read-only `terraform show -json`, invokes the canonical `check-plan`/OPA controls, and rejects command or trace overrides.

Use only private absolute paths with the explicit review interface:

```sh
node infra/saved-plan.mjs --state <state> --terraform <pinned-terraform> --saved-plan <private-plan> --plan-json <private-rendered-json> --approval <private-approval> --inventory <private-inventory> --opa <pinned-opa> [--collector-seal <private-seal>]
```

The guard is a consistency check. It cannot prove live provider, HCP workspace, state, entitlement, or account posture, and it never authorizes an import or apply. See [the adoption sequence](ADOPTION.md) and [the documentation guide](../docs/infrastructure/TERRAFORM_OWNERSHIP.md).
