---
name: portfolio-release-security
description: Change Smart Portfolio endpoints, security boundaries, deployment configuration, or release automation while retaining exact-artifact safeguards.
---

# Portfolio release security

Use this skill for Pages Functions, contact flow security, environment configuration, CI/CD, migrations, deployment, or post-deployment verification.

For an endpoint or runtime-control change, read [Security](../../../docs/security/SECURITY.md) and [Contact system](../../../docs/security/CONTACT_SYSTEM.md). For deployment, migration, or release automation, read [Deployment](../../../docs/operations/DEPLOYMENT.md) and [Operations](../../../docs/operations/OPERATIONS.md). Read both sets only when the change crosses those boundaries. Treat repository enforcement and external operator configuration as separate evidence.

For every endpoint, define and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, abuse controls, errors, headers, and release checks. Keep secrets server-only and retain the existing environment separation.

Preserve the exact-candidate, verified-artifact deployment path and its stale-revision, integrity, binding, migration, and smoke-test checks. When branch governance changes, preserve `main` and `develop` as permanent refs: never delete, rename, force-update, recreate, or weaken protection for either ref. Keep the tracked ruleset limited to deletion and non-fast-forward protection so the guarded ordinary `develop` heartbeat remains valid; retain `main`'s separate pull-request and required-`verify` rules. Add a deterministic configuration test and document the distinction between tracked intent and independently verified live GitHub settings. Do not imply that GitHub branch protection or provider controls are enabled unless their live configuration has been independently verified.
