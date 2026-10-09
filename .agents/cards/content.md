# Content pipeline

Owns [content generation](../../scripts/fetchPortfolioContent.ts), [archive limits](../../scripts/lib/workbookArchive.ts), [parser and hash](../../scripts/lib/portfolioContentGeneration.ts), [normalization](../../src/lib/content/normalizePortfolioContent.ts), [validation](../../src/lib/content/validatePortfolioContent.ts), [generated access](../../src/lib/content/getPortfolioContent.ts), and selectors such as [Home selection](../../src/lib/content/selectHomeContent.ts). The direction is archive and parser to normalize to validate and hash to generated JSON to access and selectors to route components; browser components never fetch the workbook.

Read [generated JSON](../../docs/content/CONTENT_PIPELINE.md#generated-json) and [authoritative implementation](../../docs/content/CONTENT_MAPPING.md#authoritative-implementation). Reuse the named helpers instead of adding component-level source access or a second hash path.

Validate with [content tests](../../src/lib/content/content.test.ts) and [generator tests](../../scripts/portfolioContentGeneration.test.ts): `npm run test -- src/lib/content/content.test.ts scripts/portfolioContentGeneration.test.ts`. Run `npm run generate:content`; broaden to `npm run test:priority` and `npm run build` for generated-boundary or public asset changes.
