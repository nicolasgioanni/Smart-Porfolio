# Terraform ownership and adoption

The repository contains a proposed Terraform ownership layout in [`infra/`](../../infra/README.md). It does not represent active management: no cloud resource has been imported or applied, no HCP Terraform backend has been activated, and GitHub Actions has no automatic Terraform apply path. Existing deployment ownership remains with the exact-artifact release workflow.

## Ownership boundary

Four independent roots divide intended future ownership:

| Root | Proposed scope | Explicit exclusion |
| --- | --- | --- |
| `shared` | Account-wide namespace reservation with no resources | Pages project, secrets, D1 containers, repository rules |
| `preview` | Existing preview contact-rate D1 container | Production container, SQL migrations, Pages runtime configuration |
| `production` | Existing production contact-rate D1 container | Preview container, SQL migrations, Pages runtime configuration |
| `github-governance` | Existing active permanent-branch ruleset | Cloudflare resources and classic main protection |

The D1 roots name the existing preview and production containers separately and use `prevent_destroy`. SQL files under [`migrations/`](../../migrations/) remain release-workflow inputs. The GitHub root models the existing active `protect-permanent-branches` rule exactly for `main` and `develop`, with deletion and non-fast-forward protection only, no bypass actors, and `prevent_destroy`. It must be adopted with a reviewed exact ID; creating an unimported ruleset would duplicate a live control.

Provider versions are fixed at Cloudflare `5.27.0` and GitHub `6.13.0`; each root owns an independent lock file whose source, version constraint, and checksum set must exactly match the reviewed values. The roots intentionally have no backend configuration, provider aliases, or `terraform_remote_state` reads. This prevents a local policy configuration from silently selecting another workspace or coupling ownership roots.

## Evidence versus policy inputs

[`infra/ownership-manifest.json`](../../infra/ownership-manifest.json), a private inventory JSON, and an approval JSON are policy inputs. They can describe the expected root, address, environment, identifier, workspace lineage, and review hashes. They are not source-authoritative proof of the live Cloudflare account, D1 tenancy, GitHub owner/repository/ruleset, HCP Terraform workspace, or state.

For a future authorized activation, derive evidence from authenticated Cloudflare, GitHub, and HCP Terraform APIs and from the selected Terraform state. Cross-check the state pull against its state-version ID, lineage, serial, and digest. Verify immutable workspace identity, organization/project, local execution, state protection, resource IDs, account/repository IDs, and the exact state address-to-resource mapping. Refresh all mutable evidence immediately before any authorized action.

Private records, saved plans, `terraform show -json` output, provider responses, and state snapshots must be stored outside every Git worktree. The [schemas](../../infra/schemas/private-runtime-inventory.schema.json) describe their expected shape without checking in values.

## Offline saved-plan guard

[`scripts/terraform/safePlanGuard.mjs`](../../scripts/terraform/safePlanGuard.mjs) binds a provided saved-plan file and its reproducible `terraform show -json` output to a private approval record. The verification command inspects the pinned binary, reruns the read-only show command from the exact saved-plan bytes, and requires an exact JSON digest match before semantic checks. It checks the clean exact source commit, root configuration digest, lock digest, inventory digest, pinned Terraform version and binary digest, workspace/state identifiers, and expected provider versions. It rejects command overrides such as `TF_WORKSPACE` and `TF_CLI_ARGS`, Terraform trace-output variables, alternative local configuration, a worktree-local `TF_DATA_DIR`, malformed evidence, duplicate ownership, wrong environment, stale bindings, unknown addresses, imports, deletes, replacements, deferred work, drift, failed or unknown checks, and unknown plan values.

A successful offline result means only that supplied review artifacts are internally consistent and the plan is a complete no-op. It never proves live identity, does not detect cloud drift by itself, never imports or applies, and cannot authorize those actions. The [adoption procedure](../../infra/ADOPTION.md) owns the required authenticated verification and recheck immediately before a future authorized action.

## Validation and recovery

Run `npm run infrastructure:check` to verify source-level root isolation, ownership, pins, locks, permanent-ref scope, no bypass actor, and `prevent_destroy`. Run `npm run test:infrastructure` for the no-op and adversarial plan guard cases. The documentation checker includes Markdown under `infra/` so the proposed activation boundary remains linked and reviewable.

If a future import, plan, or evidence check fails, stop before mutation. Preserve the failing private evidence only in the authorized operational location, determine whether the source, workspace selection, account/repository identity, state, or entitlement is wrong, and start a new review after correction. Do not weaken a guard, remove a live secret, or use a broad provider token to make adoption pass.
