---
name: portfolio-release-security
description: Change Smart Portfolio endpoints, security boundaries, deployment configuration, or release automation while retaining exact-artifact safeguards.
---

# Portfolio release security

Use this skill for Pages Functions, contact flow security, environment configuration, CI/CD, migrations, deployment, or post-deployment verification.

For an endpoint or runtime-control change, read [Security](../../../docs/security/SECURITY.md) and [Contact system](../../../docs/security/CONTACT_SYSTEM.md). For deployment, migration, or release automation, read [Deployment](../../../docs/operations/DEPLOYMENT.md) and [Operations](../../../docs/operations/OPERATIONS.md). Read both sets only when the change crosses those boundaries. Treat repository enforcement and external operator configuration as separate evidence.

For every endpoint, define and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, abuse controls, errors, headers, and release checks. Keep secrets server-only and retain the existing environment separation.

When this baseline has no configured Queue or R2 audit binding, keep contact delivery functional without those bindings. Do not add an audit requirement, skip-security switch, or cloud activation to an endpoint change; document any later audit adoption as a separate release and migration decision.

Preserve the exact-candidate, verified-artifact deployment path and its stale-revision, integrity, binding, migration, and smoke-test checks. Do not imply that GitHub branch protection or provider controls are enabled unless their live configuration has been independently verified.

For sealed release work, keep preparation, one accepted-snapshot build, compile/package, and runtime/export verification as separate stages. Bind source, semantic and byte snapshot identities, target-specific public-build fingerprints, build producer order, compiled Functions, routing, CSP, configuration, migrations, and SBOM without serializing secrets. Parse completed HTML rather than matching markup text for CSP hashes, and bind emitted Function bytes to a single bounded no-follow descriptor read before sealing. Keep these commands dormant until a separately reviewed orchestration change supplies their explicit identity inputs; normal builds without `RELEASE_TARGET` retain schema-v1 metadata. Legacy deployed metadata may request full verification but never proves no-op equivalence or ordering; malformed identity fails closed.
