# Deployment and release

Owns the [CI workflow](../../.github/workflows/ci.yml), [artifact integrity](../../scripts/artifactIntegrity.mjs), [deployment checks](../../scripts/checkDeployedContent.mjs), [static export config](../../next.config.mjs), [export adapter](../../scripts/normalizeNextStaticExport.mjs), [Wrangler config](../../wrangler.jsonc), and [D1 migrations](../../migrations/0002_contact_payload_fingerprint.sql). The workflow deploys only the exact verified static artifact; Pages separately compiles the bundled Functions during deployment.

Read the [exact-artifact pipeline](../../docs/operations/DEPLOYMENT.md#single-snapshot-exact-artifact-pipeline) and [routine deployment paths](../../docs/operations/OPERATIONS.md#routine-deployment-paths). Reuse [package-script coverage](../../scripts/packageScripts.test.mjs) and artifact manifest helpers; keep external operator controls separate from repository evidence.

Run `npm run test -- scripts/packageScripts.test.mjs scripts/checkDeployedContent.test.mjs`. Broaden to `npm run verify:priority` for CI, artifact, or configuration changes and `npm run verify:full` for release candidates.
