# release

Release artifacts, deployment and security checks. Trace sealed candidate, artifact integrity, static-export adapter, runtime configuration and deployment verification. Keep `next.config.mjs` and `scripts/normalizeNextStaticExport.mjs` together.

Start at `scripts/release.mjs` and inspect `scripts/release/sealedRelease.test.mjs`. Read the [portfolio-release-security](../skills/portfolio-release-security/SKILL.md) and [authority](../../docs/operations/DEPLOYMENT.md#single-snapshot-exact-artifact-pipeline) for this contract. Run `npm run release:verify` as applicable.

Consumers: none recorded. Changes to endpoints, migrations or infrastructure require those owners and release-security guidance.
