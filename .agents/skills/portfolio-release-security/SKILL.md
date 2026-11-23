---
name: portfolio-release-security
description: Change Smart Portfolio endpoints, security boundaries, deployment configuration, or release automation while retaining exact-artifact safeguards.
---

# Portfolio release security

For endpoint or runtime changes read [Security](../../../docs/security/SECURITY.md) and [Contact system](../../../docs/security/CONTACT_SYSTEM.md). For deployment read [Deployment](../../../docs/operations/DEPLOYMENT.md#single-snapshot-exact-artifact-pipeline) and [Operations](../../../docs/operations/OPERATIONS.md).

For every endpoint, define and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, abuse controls, errors, headers, and release checks. Keep secrets server-only and retain the existing environment separation.

When this baseline has no configured Queue or R2 audit binding, keep contact delivery functional without those bindings. Do not add an audit requirement, skip-security switch, or cloud activation to an endpoint change; document any later audit adoption as a separate release and migration decision.

Admit [CircleCI PR evidence](../../../docs/quality/CIRCLECI.md) alongside native security, sealed-build and export checks.

Preserve exact-candidate deployment: restore and verify the sealed release and producer, attest it, serialize the target without cancellation, recheck branch freshness around D1 migration, then admit pinned Wrangler output and smoke the unique and stable hosts. Do not infer external controls from repository configuration.

Keep runtime-configuration admission pure and shared across compilation, packaging, runtime verification, and deployment. Admit reviewed non-secret variables and target-specific bindings; reject secrets, unknown variables, and unactivated capabilities. Preview compatibility must match compilation. This verifies source and bytes, not live resource ownership or secrets.

Preserve CI source-integrity checkpoints before evidence and provider mutations: initial and source-only phases allow no changes; content permits only snapshot-verified generated JSON bytes. These observe persistent changes, not continuous subprocess isolation. See [CI source integrity](../../../docs/quality/CI_CONTRACTS.md#source-integrity-checkpoints).

Private-preview verification is credential-isolated and fail-closed; an unreviewed entitlement mapping blocks activation. Keep provider evidence in restricted temporary storage outside worktrees. See [Runtime posture](../../../docs/operations/RUNTIME_POSTURE.md) for manual observations and distinguish source intent from verified controls.

For sealed releases, preserve separate preparation, accepted-snapshot build, compile/package, and runtime/export verification stages. Bind source, snapshots, target fingerprints, producer order, Functions, routing, CSP, configuration, migrations, and SBOM without secrets. Parse HTML for CSP hashes; read Function bytes through a bounded no-follow descriptor. Deployed-identity reads use unique cache-busting metadata URLs and no-cache headers. Legacy metadata cannot prove equivalence or order; malformed identity fails closed. Local fixtures do not prove hosted or provider operations.

Preserve permanent `main` and `develop` refs and their protections. The tracked ruleset covers only those refs, with deletion and non-fast-forward protection and no bypass, allowing the guarded heartbeat. Preserve the separate `main` PR and `verify` policy. Test configuration deterministically and distinguish it from live settings.

Terraform adoption needs separate authorization. Keep state, plans, credentials, identifiers, inventories, and approvals outside worktrees. Preserve clean-source saved-plan review, configuration and lock closure, private identity bindings, regenerated plan bytes, and fail-closed OPA policy. The independent infrastructure source receipt proves source checks, not authority to mutate. See [Terraform ownership](../../../docs/infrastructure/TERRAFORM_OWNERSHIP.md).
