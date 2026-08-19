# Maintenance

## Product Hierarchy

Future maintenance should preserve the portfolio hierarchy:

- Home is the complete high-level overview.
- Detail pages are deeper evidence.
- Generated static content is the performance strategy.
- Skeletons and motion are polish only.

Home order should remain profile overview, experience, education, research, projects, six Skills category cards, recommendations, then the global footer. Each top-level Home section should keep its own full-width row. Experience, Research, Projects, and Recommendations retain compact top-right buttons to their detail routes; enabled recommendation surfaces show an honest empty state when no rows exist.

Keep the separate Home Research-card actions limited to verified `Source code`, `Manuscript`, and `Live demo` links in that order. Do not restore the Home Featured tag, a `Learn more` action, or controls for pending resources on those cards. The compact profile-overview Research panel is the deliberate exception: center its resource group and keep its button-like published links transparent at rest, revealing their surface and border on hover or focus without underlining the label. It may expose a spreadsheet pending resource such as `Manuscript` only as a native disabled, non-interactive unpublished button.

Within the profile overview, preserve `Hi, I’m {greetingName}` without a trailing period as the sole Home H1, the spreadsheet-driven role with a static `headline` fallback, the personal About copy, full-width Current Work, and the equal 50/50 Education/Research row. Keep `View experience` and `View research` in overlaid slots within their relevant panel headers so control hit areas do not change header spacing; do not restore a detached bottom navigation row. Keep Education's graduation footer aligned with Research's resource footer. Both Home Education surfaces use the shared spreadsheet-backed wording `Bachelor of Science in Computer Science`; the compact panel keeps it under `Degree` and retains `Concentration: Information Assurance & Cybersecurity`. Compact Research uses its spreadsheet organization logo and presents configured Position, Contributions, and Labs as an Education-style fact list. The panel label is `Research`, and Education stacks before Research below 720px.

Research `home_title` is the concise title for both Home surfaces. Keep the formal `title` for the Research page and résumé, and retain `title` as the Home fallback when `home_title` is blank. Optional pipe-delimited `profile_contributions` and `profile_labs` belong only to the compact profile Research panel; when either is present, `role` becomes Position and the summary is omitted. When both are blank, the legacy fallback order is `profile_summary`, `home_summary`, then `detail_summary`. The larger Home Research cards continue to render `home_summary` and must not substitute any profile-only field.

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

Fields that form an optional group must be validated together. The Home role fields are either all blank/omitted or all non-empty; a partial set must fail generation instead of silently mixing animated and fallback content.

When adding footer/legal fields, use `site_settings`; `links` remains the source for header and profile contact controls. Do not hard-code repository URLs or license choices in components.

Keep the footer in normal flow and compact during server rendering. Observe a fixed-size trigger aligned with the compact row so the footer automatically expands at roughly 50% visibility without reacting to its own height transition. Keep it expanded while scrolling downward through the details, then collapse it only during upward scrolling when the trigger retreats through the viewport's lower edge to roughly 15% visibility. Native scrolling must remain passive and unobstructed. Preserve the explicit `Details`/`Collapse` control, suppress automatic reopening after manual collapse until the entire footer exits and later re-enters, and defer collapse while focus remains within the details. Do not connect this behavior to `enable_scroll_motion` or restore duplicate social icons.

Before making a repository public or populating its public footer links, audit the current tracked tree and every reachable historical object for credentials, private contact information, unpublished assets, and unsafe configuration. A failed audit blocks both visibility changes and production source links until the history is remediated and re-audited. History rewriting and force-pushing require explicit authorization.

## Theme Maintenance

Supported theme names are `navy`, `light`, and `dark`. Add new theme values only by updating:

1. `src/lib/theme/resolveThemeName.ts`
2. Theme tokens in `src/styles/tokens.css`
3. The header theme disclosure labels and presentation order
4. Tests for accepted and rejected theme names
5. Relevant docs

Keep component styles on semantic tokens so new themes do not require component CSS rewrites.

## Updating Validators

Validators should fail on malformed production-critical content and stay tolerant of optional blank fields. Keep error messages specific enough to identify the sheet and row problem.

## Updating Templates

Template rows should remain generic demo content unless a real content update is intentionally requested. Templates should prove the UI works without accidentally publishing private or inaccurate data.

## Updating Generated Content

Run `npm run generate:content`. Generation validates and normalizes local or remote CSV input, then rewrites `src/content/generated/portfolio.generated.json`, the build artifact consumed by static pages.

Do not change generated content by hand. Change the source CSV or remote sheet, regenerate, and review and commit the source and generated JSON together.

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
