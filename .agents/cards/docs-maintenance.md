# Documentation maintenance

Owns [documentation validation](../../scripts/validateDocumentation.mjs), its [negative fixtures](../../scripts/validateDocumentation.test.mjs), [this bootstrap](../README.md), and the [ownership manifest](../ownership-manifest.json). Keep the map portable Markdown; the JSON only makes ownership deterministic for tooling.

Read [documentation principles](../../docs/README.md#documentation-principles) and [keeping documentation synchronized](../../docs/README.md#keeping-documentation-synchronized). Reuse the checker instead of scanning every inline-code span for guessed paths; code-path exceptions are explicit manifest records.

Run `npm run docs:check` and the focused documentation test. Broaden to `npm run verify:priority` when changed docs affect a release, content, route, or CI contract.
