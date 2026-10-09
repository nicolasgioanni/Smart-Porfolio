---
name: portfolio-release-security
description: Change Smart Portfolio endpoints, security boundaries, deployment configuration, or release automation while retaining exact-artifact safeguards.
---

# Portfolio release security

Use this skill for Pages Functions, contact flow security, environment configuration, CI/CD, migrations, deployment, or post-deployment verification.

For an endpoint or runtime-control change, read [Security](../../../docs/security/SECURITY.md) and [Contact system](../../../docs/security/CONTACT_SYSTEM.md). For deployment, migration, or release automation, read [Deployment](../../../docs/operations/DEPLOYMENT.md) and [Operations](../../../docs/operations/OPERATIONS.md). Read both sets only when the change crosses those boundaries. Treat repository enforcement and external operator configuration as separate evidence.

For every endpoint, define and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, abuse controls, errors, headers, and release checks. Keep secrets server-only and retain the existing environment separation.

Preserve the exact-candidate, verified-artifact deployment path and its stale-revision, integrity, binding, migration, and smoke-test checks. Do not imply that GitHub branch protection or provider controls are enabled unless their live configuration has been independently verified.

When static response security depends on final export bytes, generate it after export normalization and before artifact integrity work. Keep `public/_headers` as a source template and derive final per-page policy values into `out/_headers`; validate every generated line and the complete rule count against provider limits. Test the generated export through a local Pages emulator, including clean and `.html` paths plus unknown-path 404 fallback behavior. A browser fixture in the release path must use `build:generated` so it consumes the already validated content snapshot and never regenerates local templates after CI has accepted a remote snapshot.
