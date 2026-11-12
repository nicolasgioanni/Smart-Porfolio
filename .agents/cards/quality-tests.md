# Tests and quality gates

Owns [validation tier selection](../../scripts/runValidationTier.mjs), [documentation validation](../../scripts/validateDocumentation.mjs), and [browser test support](../../tests/e2e/browserTest.ts). Keep focused unit, integration, browser, and workflow contracts distinct; do not replace a targeted contract with a broad run by default.

Read the [command matrix](../../docs/quality/TESTING.md#command-matrix) and [CI quality gates](../../docs/quality/TESTING.md#ci-quality-gates). Validate changes to this boundary with [tier tests](../../scripts/runValidationTier.test.mjs) and [documentation tests](../../scripts/validateDocumentation.test.mjs).

Run the narrow changed command first. Broaden to `npm run verify:priority` for a pull-request-sized cross-boundary change and `npm run verify:full` only for a release candidate.
