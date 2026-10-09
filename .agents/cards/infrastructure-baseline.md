# Infrastructure baseline

No Terraform, `infrastructure/`, or `infra/` source tree exists on this fixed baseline. This card owns that absence and prevents a future infrastructure addition from being silently outside documentation validation.

Read [repository map](../../docs/architecture/PROJECT_STRUCTURE.md#repository-map) and [deployment ownership](../../docs/operations/DEPLOYMENT.md#ownership-and-trust-boundaries). Reuse the [documentation validator](../../scripts/validateDocumentation.mjs), which discovers Markdown under either future directory.

Validate with [documentation validator tests](../../scripts/validateDocumentation.test.mjs) and `npm run docs:check`. Before adding infrastructure, add a concrete owner card, manifest paths, tests, anchored documentation, and release validation.
