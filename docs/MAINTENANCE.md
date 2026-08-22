# Maintenance

Smart Portfolio changes safely when each update follows the full path from source data or configuration through types, validation, selectors, components, tests, documentation, security review, and deployment impact. This guide maps common extensions to that path.

## Core invariants

- Portfolio pages remain compatible with Next.js static export.
- Portfolio content is generated before build and is never fetched by the browser.
- Production and stable preview candidates each use one strict workbook snapshot for generation, tests, and build.
- Home is the summary layer; focused routes are the evidence layer.
- Runtime requests remain limited to explicitly allowed Cloudflare Pages Functions.
- Public configuration and encrypted secrets stay separated.
- The deployed artifact is the exact artifact that passed verification.
- Keyboard, focus, reduced-motion, and static-content behavior are part of every UI change.

## Change map

| Change | Primary implementation | Required companion work |
| --- | --- | --- |
| Add a profile field | profile template, strict key allowlist, types, normalizer, validator | Mapping, component, tests, schema, owner guide |
| Add a collection field | matching template, types, normalizer | Validation, selector, component, tests, schema, workbook header |
| Add a site setting | `site_settings` key row, strict key allowlist, types, normalizer | Default, validation, consumer, tests, schema, workbook row |
| Add or rename a sheet column | template header and row conversion | Exact workbook header, tests, docs, migration plan |
| Add a route | `src/app/`, route registry | Navigation or footer, metadata, loading state, tests, smoke scope |
| Add a Home section | `HomeOverview.tsx`, selector, component | Skeleton, styles, tests, content mapping, accessibility |
| Add a card variant | `PortfolioCard`, glass and portfolio CSS | Semantics, responsive behavior, tests, design system |
| Add a theme token | `tokens.css` | All themes, component usage, contrast and focus review, tests |
| Change navigation | route registry and navigation components | Active state, mobile behavior, keyboard checks, tests, docs |
| Change contact behavior | contact components and Functions | Legal copy, Function tests, WAF review, security and contact docs |
| Add a runtime endpoint | `functions/`, `_routes.json` | Threat model, limits, headers, rate limiting, tests, operations |
| Change CI | workflow and script tests | Permissions, branch conditions, no-op behavior, operations docs |
| Change deployment provider | workflow, scripts, configuration | Static and Function compatibility, secrets, DNS, rollback, all operations docs |

## Add a profile field

Profile source data is a key-value sheet, but generated content uses explicit typed properties.

1. Add the source key to the profile template.
2. Add the key to the strict `allowedProfileKeys` workbook allowlist in `scripts/lib/portfolioContentGeneration.ts`.
3. Add the generated property to `ProfileContent` in `src/content/types.ts`.
4. Map the source key in `normalizePortfolioContent.ts`.
5. Add required, URL, grouped-field, or reference validation in `validatePortfolioContent.ts`.
6. Add selection or display fallback logic in a content helper when the raw field should not reach a component directly.
7. Render it with semantic structure and existing primitives.
8. Test blank, valid, and invalid cases, strict remote unknown-key and duplicate-key rejection, and the intended UI fallback.
9. Update [Content sheet schema](CONTENT_SHEET_SCHEMA.md), [Content mapping](CONTENT_MAPPING.md), and [Local content editing](LOCAL_CONTENT_EDITING.md).
10. Align the public workbook key set before the next production or stable preview candidate.

If a profile value refers to a collection row, validate the exact ID. Do not silently choose an unrelated row when an explicit reference is invalid.

## Add a collection column

For links, research, projects, experience, recommendations, education, or skills:

1. Add the column to the checked-in template in its final position.
2. Extend the source-row and generated types.
3. Parse and normalize the value, including list, link, boolean, number, or date behavior.
4. Add value and cross-field validation.
5. Update selectors and sort behavior if the field affects visibility, ordering, or fallback.
6. Update the consuming component and loading state when layout changes.
7. Test local CSV parsing and remote workbook row conversion.
8. Test whether the field belongs to the canonical normalized content subset and whether equivalent source representations remain equal.
9. Update the exact field reference and mapping guide.
10. Update the workbook header before strict remote generation runs.

The remote workbook header contract is exact. A column rename is a schema migration, not a presentation-only edit. Coordinate the code and workbook so no deployable candidate observes a mixed version.

## Add a site setting

`site_settings` remains a `key,value` sheet. Add a row, not a column.

1. Add the key row to the checked-in template and public workbook.
2. Add the generated property to `SiteSettings` in `src/content/types.ts`.
3. Add the key mapping, built-in default, and boolean or number classification in `normalizePortfolioContent.ts` as applicable.
4. Add the key to the strict `allowedSiteSettingKeys` workbook allowlist in `scripts/lib/portfolioContentGeneration.ts`.
5. Add value and cross-field validation in `validatePortfolioContent.ts`.
6. Update the selector, metadata helper, route, layout, or component that consumes the setting.
7. Decide whether the setting belongs to the canonical normalized content subset and add hash tests for that decision.
8. Test local normalization plus remote unknown-key, duplicate-key, blank-value, valid-value, and invalid-value behavior.
9. Update the schema, mapping, local editing guide, and public workbook before the next strict remote candidate.

## Add a source sheet

Adding a sheet changes the strict workbook contract and the generated model.

Review and update:

- expected worksheet names and normalization in `portfolioContentGeneration.ts`;
- matching local template and source loading;
- generated metadata source records;
- types, normalization, validation, and content hashing;
- missing, unexpected, hidden, and duplicate-normalized sheet tests;
- workflow assumptions about exact source count;
- content pipeline, schema, mapping, and owner procedures;
- public-data and security review.

Do not make strict mode accept arbitrary extra sheets. Every accepted sheet becomes public input and requires an explicit purpose.

## Add a route

1. Create `src/app/<route>/page.tsx` with route metadata.
2. Use `PageContainer` or a deliberate equivalent with one H1.
3. Add `loading.tsx` only when a route-level loading shape provides value.
4. Register the path in `siteRoutes.ts` if `SmartLink` should treat it as internal.
5. Add it to primary navigation, footer resources, or neither according to product hierarchy.
6. Add component and navigation tests.
7. Confirm static export creates the expected directory and HTML file.
8. Add the route to local smoke verification and deployment smoke coverage when operationally important.
9. Update the route map in the root README and [Project structure](PROJECT_STRUCTURE.md).

A route that needs request-time server behavior does not belong under a Next.js route handler while `output: "export"` remains active. Review the runtime-endpoint pattern instead.

## Add a Home section

1. Define the content selection rule in `selectHomeContent.ts`.
2. Add the UI-facing type to `HomePortfolioContent`.
3. Create a focused server component unless browser APIs or interactive state are required.
4. Insert it explicitly in `HomeOverview.tsx` at the intended hierarchy position.
5. Use `HomeOverviewSection`, existing card primitives, and established route-action geometry.
6. Update `HomePageSkeleton` to reserve similar layout.
7. Add desktop, breakpoint, empty-state, and reduced-motion behavior.
8. Test selection fallbacks, heading structure, links, and interactive state.
9. Update content mapping, design system, accessibility guidance, and the README overview if material.

Do not reorder Home with CSS grid placement alone. The DOM order must match reading and keyboard order.

## Add a card variant

Use an existing `PortfolioCard` variant when it already expresses the role. A new variant needs a semantic reason such as a distinct information hierarchy, not one route-specific spacing preference.

When adding one:

1. Extend the variant type and class mapping.
2. Reuse semantic color, spacing, radius, and shadow tokens.
3. Define heading, metadata, action, and empty-state structure.
4. Confirm nested Home cards remain quieter than their outer panel.
5. Add focus, hover, selected, disabled, and reduced-motion rules where interactive.
6. Test long text, missing optional data, narrow widths, and all themes.
7. Document the variant in [Design system](DESIGN_SYSTEM.md).

## Add or change a theme token

Supported themes are Navy, Light, and Dark.

1. Define the semantic token in the root token group if it is structural.
2. Define a value in every theme when it represents color, surface, shadow, or gradient.
3. Consume the semantic token from component CSS.
4. Check focus, selection, disabled state, text contrast, and glass-disabled behavior.
5. Test the affected component in each theme and at responsive breakpoints.
6. Update [Design system](DESIGN_SYSTEM.md) if the token becomes part of the reusable contract.

Do not add a component rule that switches directly on `[data-theme]` unless the component genuinely needs behavior beyond token substitution.

## Change navigation or footer behavior

Navigation changes can affect desktop geometry, mobile visibility, active-route state, keyboard order, and the persistent route indicator.

Review:

- `siteRoutes.ts`, `navigationItems.ts`, and generated recommendation visibility;
- desktop and mobile navigation components;
- header compact and expanded states;
- `aria-current`, `aria-expanded`, focus, Escape, and outside-click behavior;
- navigation tests and responsive CSS.

Footer changes must preserve normal document flow, the reserved runway, explicit disclosure control, focus-safe collapse, manual-collapse suppression, route reset, and reduced-motion behavior. Run `npm run test:footer` after any footer or surrounding layout change.

## Change contact behavior

The browser is not the trust boundary. A client field, acknowledgement, or sequence change must be reflected in server validation where it affects acceptance.

Review together:

- `ContactForm.tsx`, `TurnstileWidget.tsx`, and client validation;
- verification and delivery Functions;
- shared field limits, allowed keys, timing, ticket, and response behavior;
- exact origin and hostname configuration;
- privacy, terms, and public security route copy;
- Function, contact component, legal, and static-security tests;
- [Contact system](CONTACT_SYSTEM.md), [Security](SECURITY.md), and the checklist;
- Cloudflare WAF coverage and provider configuration.

Never move an encrypted value into `NEXT_PUBLIC_` configuration. Never return provider, recipient, or validation internals to the visitor.

## Add a runtime endpoint

Adding a Function expands the attack and operational surface. Before implementation, define:

- exact path and accepted method;
- accepted content type and request-size limit;
- strict schema and unknown-field behavior;
- authentication or verification requirement;
- origin and hostname policy;
- abuse cases and edge rate limiting;
- response schema, cache behavior, and security headers;
- personal-data handling, logging, retention, and provider flow;
- failure, retry, and idempotency behavior;
- preview and production configuration;
- unit, integration, routing, and smoke tests.

Then add the exact path to `public/_routes.json`. Do not use a broad wildcard for convenience. Update architecture, project structure, security, operations, troubleshooting, and deployment documentation.

## Change CI behavior

The stable required job is `verify`. Preserve:

- read-only default permissions;
- untrusted pull-request isolation from secrets;
- current-candidate resolution;
- strict remote generation for deployable candidates;
- semantic no-op behavior where allowed;
- documentation validation, lint, typecheck, focused footer tests, full tests, and static build;
- exact artifact and commit binding;
- per-target concurrency and latest-branch-head guards for both production and stable preview;
- smoke testing after upload;
- isolated heartbeat writes only.

Update `scripts/packageScripts.test.mjs` or a focused script test for every workflow invariant that can be checked statically. Run the complete test suite because workflow tests are included by Vitest.

## Change deployment provider

A provider change is an architecture migration. Confirm the replacement supports:

- static export hosting and custom headers;
- deployment of the two isolated contact handlers or an equivalent reviewed runtime;
- exact route allowlisting;
- encrypted runtime secrets and separate preview values;
- immutable artifact upload without rebuilding;
- content and integrity manifests;
- preview and production isolation;
- exact-candidate protection and smoke testing;
- custom-domain TLS, DNS transition, rollback, and cache behavior.

Replace provider-specific workflow, scripts, configuration, headers, Functions, WAF guidance, and documentation as one reviewed change. Do not leave a second automatic deployment owner enabled.

## Maintain content and assets

- Treat local templates as authoring sources and generated JSON as output.
- Keep the public workbook limited to reviewed public-safe data.
- Run `npm run generate:content` after source changes.
- Use safe root-relative asset paths and confirm each referenced file exists.
- Remember that every file under `public/` is anonymously retrievable.
- Remove unused assets only after checking source references and documentation; use a recoverable, explicitly scoped operation.
- Check image dimensions and file size before adding a large raster asset.

See [Local content editing](LOCAL_CONTENT_EDITING.md) and [Performance budget](PERFORMANCE_BUDGET.md).

## Maintain documentation

When behavior changes:

1. Update the deep guide that owns the fact.
2. Update the corresponding checklist without copying the full explanation.
3. Update `docs/README.md` when navigation or document scope changes.
4. Update the root README only when the visitor-facing overview or setup path changes.
5. Run `npm run docs:check` to verify structure, local links, case, privacy patterns, and placeholders.
6. Run `npm run verify` before delivery.

## Do not bypass

- Generated-content helpers and runtime generated-shape validation.
- Strict workbook and header validation.
- URL scheme, traversal, and paired-field validation.
- Explicit Home selection and route mapping.
- Next.js static-export constraints.
- Exact Function route configuration.
- Server-side contact validation and signed-ticket checks.
- Environment separation and secret placement.
- Documentation, lint, typecheck, test, and build gates.
- Artifact-integrity and candidate-SHA verification.
- Production and stable preview smoke tests, plus the production active-manifest comparison.

If a requirement no longer fits, change the architecture deliberately and update its tests and documentation. Do not add a hidden bypass.
