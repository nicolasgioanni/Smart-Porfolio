---
name: portfolio-release-security
description: Change Smart Portfolio endpoints, security boundaries, deployment configuration, or release automation while retaining exact-artifact safeguards.
---

# Portfolio release security

Use this skill for Pages Functions, contact flow security, environment configuration, CI/CD, migrations, deployment, or post-deployment verification.

For an endpoint or runtime-control change, read [Security](../../../docs/security/SECURITY.md) and [Contact system](../../../docs/security/CONTACT_SYSTEM.md). For deployment, migration, or release automation, read [Deployment](../../../docs/operations/DEPLOYMENT.md) and [Operations](../../../docs/operations/OPERATIONS.md). Read both sets only when the change crosses those boundaries. Treat repository enforcement and external operator configuration as separate evidence.

For every endpoint, define and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, abuse controls, errors, headers, and release checks. Keep secrets server-only and retain the existing environment separation.

Preserve the exact-candidate, verified-artifact deployment path and its stale-revision, integrity, binding, migration, and smoke-test checks. For a deployable Pages artifact, compile Functions during verification into the static output, probe the exact emitted module directory, seal the static manifest bytes, emitted Worker modules and routes, reviewed runtime configuration, and migrations in private metadata outside the public output, and pass a trusted seal digest into deploy. The deploy job must verify and stage that seal before credentials in a workspace without source Functions. Recheck candidate freshness without credentials, then run a bounded exact-project provider preflight immediately before every Cloudflare mutation. Upload the emitted Worker with `--no-bundle` rather than rebuilding it. Keep deployment installs lifecycle-free before credentials and scope credentials only to that provider preflight and mutation commands. Do not imply that GitHub branch protection or provider controls are enabled unless their live configuration has been independently verified.
