---
name: portfolio-release-security
description: Change Smart Portfolio endpoints, security boundaries, deployment configuration, or release automation while retaining exact-artifact safeguards.
---

# Portfolio release security

Use this skill for Pages Functions, contact flow security, environment configuration, CI/CD, migrations, deployment, or post-deployment verification.

Use the `contact` or `release` card in the [agent map](../../../docs/development/AGENT_MAP.md#owner-cards). For an endpoint or runtime-control change, start with [endpoint rules](../../../docs/security/SECURITY.md#adding-or-changing-an-endpoint) and the [endpoint contract](../../../docs/security/CONTACT_SYSTEM.md#endpoint-contract). For deployment, migration, or release automation, start with the [exact-artifact pipeline](../../../docs/operations/DEPLOYMENT.md#single-snapshot-exact-artifact-pipeline) or the matching [operations path](../../../docs/operations/OPERATIONS.md#routine-deployment-paths). Read both sets only when the change crosses those boundaries. Treat repository enforcement and external operator configuration as separate evidence.

For every endpoint, define and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, abuse controls, errors, headers, and release checks. Keep secrets server-only and retain the existing environment separation.

Preserve the exact-candidate, verified-artifact deployment path and its stale-revision, integrity, binding, migration, and smoke-test checks. Do not imply that GitHub branch protection or provider controls are enabled unless their live configuration has been independently verified.
