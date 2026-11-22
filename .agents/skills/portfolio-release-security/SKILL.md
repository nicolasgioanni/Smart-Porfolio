---
name: portfolio-release-security
description: Change Smart Portfolio endpoints, security boundaries, deployment configuration, or release automation while retaining exact-artifact safeguards.
---

# Portfolio release security

Use this skill for Pages Functions, contact flow security, environment configuration, CI/CD, migrations, deployment, or post-deployment verification.

For endpoint or runtime changes read [Security](../../../docs/security/SECURITY.md) and [Contact system](../../../docs/security/CONTACT_SYSTEM.md). For deployment read [Deployment](../../../docs/operations/DEPLOYMENT.md#single-snapshot-exact-artifact-pipeline) and [Operations](../../../docs/operations/OPERATIONS.md). Repository and external controls are distinct.

For every endpoint, define and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, abuse controls, errors, headers, and release checks. Keep secrets server-only and retain the existing environment separation.

When this baseline has no configured Queue or R2 audit binding, keep contact delivery functional without those bindings. Do not add an audit requirement, skip-security switch, or cloud activation to an endpoint change; document any later audit adoption as a separate release and migration decision.

Preserve the exact-candidate, verified-artifact deployment path and its stale-revision, integrity, binding, migration, and smoke-test checks. A deployment restores the original sealed release, verifies its archive and producer identity, creates and verifies provenance/SBOM attestations, serializes the target without cancellation, rechecks branch freshness before and after the selected D1 migration, then admits only the pinned Wrangler structured result before unique-host and stable-origin smoke checks. Do not imply that GitHub branch protection, environment approvals, or provider controls are enabled unless their live configuration has been independently verified.

Keep sealed runtime-configuration admission pure and shared by compilation, packaging, local runtime verification, and deployment. Admit only reviewed non-secret variables and target-specific bindings; reject serialized secrets, unknown variables, and unactivated binding capabilities. Preview compatibility must equal the compiled worker configuration. This validates sealed source and bytes, not provider ownership of a configured resource or live secret presence.

For sealed releases, preserve separate preparation, accepted-snapshot build, compile/package, and runtime/export verification stages. Bind source, snapshots, target fingerprints, producer order, Functions, routing, CSP, configuration, migrations, and SBOM without secrets. Parse HTML for CSP hashes; read Function bytes through a bounded no-follow descriptor. Deployed-identity reads use unique cache-busting metadata URLs and no-cache headers. Legacy metadata cannot prove equivalence or order; malformed identity fails closed. Local fixtures do not prove hosted or provider operations.

For branch-governance changes, preserve `main` and `develop` as permanent refs: never delete, rename, force-update, recreate, or weaken protection for either ref. The tracked `protect-permanent-branches` ruleset may cover only those exact refs with deletion and non-fast-forward protection and an empty bypass list, so the guarded ordinary `develop` heartbeat remains valid. Preserve `main`'s separate pull-request and required-`verify` policy. Add a deterministic configuration test and document the distinction between tracked intent and independently verified live GitHub settings.

Terraform adoption needs separate authorization. Keep state, plans, credentials, identifiers, inventories, and approvals outside worktrees. Preserve clean-source saved-plan review, configuration and lock closure, private identity bindings, regenerated plan bytes, and fail-closed OPA policy. The independent infrastructure source receipt proves source checks, not authority to mutate. See [Terraform ownership](../../../docs/infrastructure/TERRAFORM_OWNERSHIP.md).
