# Maintenance

## Adding sections safely

Future maintenance work should preserve the product hierarchy:

- Home is the complete high-level overview.
- Detail pages are deeper evidence.
- Generated static content is the performance strategy.
- Skeletons are polish only.

Add new sections by creating a focused component, mapping generated content into it, and keeping Home concise.

Recommendations are a first-class static section. Keep recommendation text in `recommendations.csv` or its remote CSV source, not in React components. LinkedIn URLs are verification/navigation links only.

## Adding sheet fields

When adding a spreadsheet field:

1. Update `src/content/types.ts`.
2. Update normalization in `src/lib/content/normalizePortfolioContent.ts`.
3. Update validation in `src/lib/content/validatePortfolioContent.ts` if the field affects correctness.
4. Update CSV templates in `src/content/templates`.
5. Update docs in `docs/CONTENT_SHEET_SCHEMA.md` and `docs/CONTENT_MAPPING.md`.
6. Add or update tests.
7. Regenerate content with `npm run generate:content`.

When adding footer/legal fields, prefer `site_settings` or `links` rows. Do not hard-code repository URLs or license choices in components.

## Updating validators

Validators should fail on malformed production-critical content and stay tolerant of optional blank fields. Keep error messages specific enough to identify the sheet and row problem.

## Updating templates

Template rows should remain generic demo content unless the user explicitly asks for real personal content. Templates should prove the UI works without accidentally publishing private or inaccurate data.

## Updating generated content

Run `npm run generate:content`. The generated JSON is a build artifact consumed by static pages.

## Testing content changes

Run:

- `npm run generate:content`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Use `npm run verify` before shipping.

## Adding UI sections

When adding UI:

- Keep components small and focused.
- Prefer server components unless interactivity is required.
- Use existing glass primitives and design tokens.
- Avoid client fetching for initial content.
- Keep Home summary-level and detail pages evidence-level.
- Add skeleton shapes only if the route or Suspense boundary can actually load.

## Security maintenance

- Keep the app static-first unless a future product decision explicitly adds endpoints.
- If endpoints are ever added, document authentication, validation, and rate limiting before implementation.
- Run `npm audit` as part of dependency reviews, but do not force major upgrades without checking Next.js and test-tooling compatibility.
