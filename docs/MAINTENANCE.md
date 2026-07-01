# Maintenance

## Product Hierarchy

Future maintenance should preserve the portfolio hierarchy:

- Home is the complete high-level overview.
- Detail pages are deeper evidence.
- Generated static content is the performance strategy.
- Skeletons and motion are polish only.

Home order should remain hero, skills, experience, research, projects, recommendations when available, education, and resume/contact.

## Adding Sections

Add new sections by creating a focused component, mapping generated content into it, and keeping Home concise.

Use existing primitives first:

- `PageIntro`
- `SectionHeader`
- `PortfolioCard`
- `FeaturedGrid`
- Glass primitives

Prefer server components unless interactivity is required.

## Adding Sheet Fields

When adding a spreadsheet field:

1. Update `src/content/types.ts`.
2. Update normalization in `src/lib/content/normalizePortfolioContent.ts`.
3. Update validation in `src/lib/content/validatePortfolioContent.ts` if the field affects correctness.
4. Update CSV templates in `src/content/templates`.
5. Update docs in `docs/CONTENT_SHEET_SCHEMA.md` and `docs/CONTENT_MAPPING.md`.
6. Add or update tests.
7. Regenerate content with `npm run generate:content`.

When adding footer/legal fields, prefer `site_settings` or `links` rows. Do not hard-code repository URLs or license choices in components.

## Theme Maintenance

Supported theme names are `navy`, `light`, and `dark`. Add new theme values only by updating:

1. `src/lib/theme/resolveThemeName.ts`
2. Theme tokens in `src/styles/tokens.css`
3. The footer theme switcher labels
4. Tests for accepted and rejected theme names
5. Relevant docs

Keep component styles on semantic tokens so new themes do not require component CSS rewrites.

## Updating Validators

Validators should fail on malformed production-critical content and stay tolerant of optional blank fields. Keep error messages specific enough to identify the sheet and row problem.

## Updating Templates

Template rows should remain generic demo content unless a real content update is intentionally requested. Templates should prove the UI works without accidentally publishing private or inaccurate data.

## Updating Generated Content

Run `npm run generate:content`. Generated content is the build artifact consumed by static pages.

Do not change generated content by hand. Change the source CSV or remote sheet, then regenerate.

## Testing Changes

Run:

- `npm run generate:content`
- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`

Use `npm run verify` before shipping.

## Security Maintenance

- Keep the app static-first unless a future product decision explicitly adds endpoints.
- If endpoints are ever added, document authentication, validation, and rate limiting before implementation.
- Run dependency reviews deliberately; do not force major upgrades without checking Next.js and test-tooling compatibility.
