---
name: portfolio-release-security
description: Change Smart Portfolio endpoints, security boundaries, deployment configuration, or release automation while retaining exact-artifact safeguards.
---

# Portfolio release security

Use this skill for Pages Functions, contact flow security, environment configuration, CI/CD, migrations, deployment, or post-deployment verification.

For an endpoint or runtime-control change, read [Security](../../../docs/security/SECURITY.md) and [Contact system](../../../docs/security/CONTACT_SYSTEM.md). For deployment, migration, or release automation, read [Deployment](../../../docs/operations/DEPLOYMENT.md) and [Operations](../../../docs/operations/OPERATIONS.md). Read both sets only when the change crosses those boundaries. Treat repository enforcement and external operator configuration as separate evidence.

For every endpoint, define and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, abuse controls, errors, headers, and release checks. Keep secrets server-only and retain the existing environment separation.

When this baseline has no configured Queue or R2 audit binding, keep contact delivery functional without those bindings. Do not add an audit requirement, skip-security switch, or cloud activation to an endpoint change; document any later audit adoption as a separate release and migration decision.

Preserve the exact-candidate, verified-artifact deployment path and its stale-revision, integrity, binding, migration, and smoke-test checks. For branch-governance changes, preserve `main` and `develop` as permanent refs: never delete, rename, force-update, recreate, or weaken protection for either ref. The tracked `protect-permanent-branches` ruleset may cover only those exact refs with deletion and non-fast-forward protection and an empty bypass list, so the guarded ordinary `develop` heartbeat remains valid. Preserve `main`'s separate pull-request and required-`verify` policy. Add a deterministic configuration test and document the distinction between tracked intent and independently verified live GitHub settings. Do not imply that GitHub branch protection or provider controls are enabled unless their live configuration has been independently verified.
