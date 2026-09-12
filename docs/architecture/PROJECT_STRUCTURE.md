# Project structure

Smart Portfolio separates static application code, build-time content, isolated runtime contact handling, deployment automation, and documentation. This guide identifies each boundary and the primary location for common changes.

## Repository map

```text
Smart-Porfolio/
|-- .agents/
|   `-- skills/portfolio-skeleton-regression/SKILL.md
|-- .github/
|   `-- workflows/ci.yml
|-- docs/
|-- functions/
|   |-- _shared/contact.ts
|   `-- api/
|       |-- contact.ts
|       `-- contact/verify.ts
|-- migrations/
|   |-- 0001_contact_rate_reservations.sql
|   `-- 0002_contact_payload_fingerprint.sql
|-- public/
|   |-- _headers
|   |-- _routes.json
|   |-- favicon.ico
|   |-- favicon/
|   `-- images/
|-- scripts/
|   |-- fetchPortfolioContent.ts
|   |-- lib/
|   |-- artifactIntegrity.mjs
|   |-- checkDeployedContent.mjs
|   |-- nextBuildAdapter.mjs
|   |-- normalizeNextStaticExport.mjs
|   |-- writeContentVersion.mjs
|   `-- local automation and tests
|-- tests/
|   `-- e2e/
|-- src/
|   |-- app/
|   |-- components/
|   |-- content/
|   |   |-- generated/
|   |   `-- templates/
|   |-- lib/
|   `-- styles/
|-- next.config.mjs
|-- package.json
|-- playwright.config.ts
|-- vitest.config.ts
`-- wrangler.jsonc
```

## Top-level responsibilities

| Location | Responsibility |
| --- | --- |
| `.github/workflows/ci.yml` | Candidate selection, content generation, verification, artifact transfer, Cloudflare Direct Upload, smoke tests, and schedule heartbeat. |
| `.agents/skills/portfolio-skeleton-regression/` | Repository-scoped guidance for deterministic skeleton alignment, visual, and transition regression work. |
| `docs/` | Guides, references, checklists, and README assets. |
| `functions/` | Cloudflare Pages Functions for contact verification and delivery. These are not Next.js route handlers. |
| `migrations/` | Append-only Cloudflare D1 schema changes applied before the corresponding Pages deployment. |
| `public/` | Public images, favicons, Pages security headers, and the exact Function route allowlist copied into the static export. |
| `scripts/` | Content ingestion, local automation, deployment manifests, artifact integrity, deployment smoke checks, and script-level tests. |
| `tests/e2e/` | Playwright Chromium regressions for deterministic skeleton alignment, inert visual fixtures, and transitions; responsive navigation; recommendation overlays; Experience and Research detail behavior; and footer first-render, route, restoration, and scroll behavior. |
| `src/` | Next.js routes, React components, typed content, selectors, validation, theme helpers, and CSS. |
| `next.config.mjs` | Static export and unoptimized image configuration. |
| `package.json` | Supported Node.js range, dependencies, and executable project commands. |
| `playwright.config.ts` | Chromium skeleton, navigation, recommendation, Experience, Research, and footer regression configuration plus the local Next.js web server. |
| `wrangler.jsonc` | Pages output directory plus reviewed production and preview runtime variables and isolated D1 bindings. Encrypted secrets are configured outside the repository. |

## Documented application routes

Every route under `src/app/` is compatible with the Next.js static export. Client components hydrate only the interactions used by a page or by the shared shell. The table is non-exhaustive.

| Route | Source | Role | Primary navigation |
| --- | --- | --- | --- |
| `/` | `src/app/page.tsx` | Profile and portfolio overview | Yes |
| `/experience` | `src/app/experience/page.tsx` | Two-depth, expandable experience showcase | Yes |
| `/research` | `src/app/research/page.tsx` | Two-depth, alternating visual research showcase | Yes |
| `/projects` | `src/app/projects/page.tsx` | Detailed project evidence | Yes |
| `/recommendations` | `src/app/recommendations/page.tsx` | Recommendation list or configured empty state | Conditional |
| `/resume` | `src/app/resume/page.tsx` | Private resume request instructions without a published file | Yes |
| `/contact` | `src/app/contact/page.tsx` | Static form shell that calls the isolated contact Functions | No, footer only |
| `/privacy` | `src/app/privacy/page.tsx` | Privacy notice | No, footer only |
| `/terms` | `src/app/terms/page.tsx` | Terms and accuracy notice | No, footer only |
| `/security` | `src/app/security/page.tsx` | Security and responsible disclosure notice | No, footer only |

The recommendation route and navigation item remain discoverable only when recommendation settings and content permit them. The Contact page is marked `noindex` in route metadata. See [Architecture](ARCHITECTURE.md) for the static and runtime boundary.

## Application composition

### Layout and navigation

`src/app/layout.tsx` loads generated content, resolves the server fallback theme, installs the pre-hydration system-preference script, creates metadata, and renders `SiteShell`. The shell composes the desktop top header or mobile bottom dock, route content, and progressive footer.

- `src/components/layout/` owns page containers, header and footer composition, profile preview, and structural primitives.
- `src/components/navigation/` owns the route registry, desktop and mobile navigation, external-link handling, active-route state, and social links.
- `src/components/overlay/` owns reusable portal-backed modal lifecycle, focus management, dismissal, and background-scroll locking.
- `src/components/theme/` and `src/lib/theme/` own pre-hydration and live system resolution, manual override persistence, cross-tab synchronization, and the theme disclosure.

### Portfolio components

`src/components/portfolio/` contains the Home summary layer and evidence-focused route components. `HomeOverview.tsx` owns Home section order. `selectHomeContent.ts` and `profileOverview.ts` own content selection and fallback rules. `ResearchGraphicalAbstractPreview.tsx` owns Research thumbnail and enlarged-preview composition while delegating lifecycle behavior to the shared dialog.

Focused client behavior includes the configured role rotation, modal media and skills dialogs, recommendation measurement and expansion, optional scroll reveals, and the shared shell interactions. Content rendering remains server-generated. Modal consumers provide their content and geometry while `src/components/overlay/ModalDialog.tsx` provides the common accessible interaction contract.

### Surface and loading primitives

`src/components/glass/` owns reusable solid surfaces, cards, controls, links, chips, dividers, and blobs. `src/components/loading/` owns route-level skeleton composition, including `RouteSkeleton` delegation and `RouteHeaderSkeleton` intrinsic header ink. Components consume semantic values from `src/styles/` rather than defining theme colors locally.

Shared dialog lifecycle and transition state live in `src/components/overlay/ModalDialog.tsx` and `src/styles/dialog.css`. Consumer style sheets define only domain-specific backdrop color, frame size, and internal presentation.

`tests/e2e/standaloneSkeletonDocument.ts` owns the inert same-origin HTML shell and stylesheet/font readiness used by direct skeleton alignment and Linux screenshot comparison. Browser tests must use that helper instead of replacing nodes inside the hydrated application tree.

## Content system

| Location | Responsibility |
| --- | --- |
| `src/content/types.ts` | Generated content and UI-facing TypeScript contracts. |
| `src/content/templates/` | Nine checked-in public-sheet templates plus the required header-only `resume.csv` compatibility template. |
| `src/content/generated/portfolio.generated.json` | Current generated development snapshot consumed by the application. It is an output, not the authoring source. |
| `src/lib/csv/` | CSV parsing. |
| `src/lib/content/normalizePortfolioContent.ts` | Conversion from source rows to typed content. |
| `src/lib/content/validatePortfolioContent.ts` | Required values, references, URLs, and cross-field invariants. |
| `src/lib/content/selectHomeContent.ts` | Home and detail selection, ordering, limits, and recommendation visibility. |
| `src/lib/content/routeHeaderContent.ts` | Exhaustive canonical route-header registry and the sole generated Experience summary resolver shared by resolved pages and loaders. |
| `src/lib/content/researchGraphicalAbstracts.ts` | Canonical graphical-abstract selection and checked-in fallback metadata for established Research IDs. |
| `scripts/fetchPortfolioContent.ts` | Source-mode selection, anonymous workbook fetch, timeout and byte-cap enforcement, generated-file I/O, and command output. |
| `scripts/lib/portfolioContentGeneration.ts` | Workbook URL and payload checks, XLSX parsing, worksheet and row validation, formula extraction, hashing, and metadata finalization. |
| `scripts/lib/pngMetadata.mjs` and `scripts/stripPngMetadata.mjs` | Strict, resource-bounded PNG chunk parsing and lossless removal of non-rendering text, EXIF, and provenance chunks from contributed research media. |

Deployment replaces the development snapshot with one strict workbook-derived candidate, tests it, and builds the exact static artifact without fetching again. It does not commit the deployed production or stable preview candidate. See [Content pipeline](../content/CONTENT_PIPELINE.md).

The local `resume.csv` compatibility template must remain header-only. It is never a remote workbook tab or a source of published resume content; a workbook containing a `resume` worksheet is invalid.

## Styling architecture

`src/app/layout.tsx` imports focused style sheets directly in their intended cascade order.

| File | Scope |
| --- | --- |
| `tokens.css` | Typography, spacing, radii, timing, semantic colors, solid surface tiers, theme values, borders, and restrained shadows. |
| `base.css` | Document defaults, body, typography, links, and focus foundations. |
| `layout.css` | Shell, containers, page introductions, header, and footer layout. |
| `glass.css` | Solid surface primitives, cards, buttons, links, chips, dividers, and blobs. |
| `navigation.css` | Desktop and mobile navigation, theme disclosure, profile preview, and route indicator. |
| `portfolio.css` | Home profile, cards, timelines, skills, recommendations, and detail layouts. |
| `research.css` | Research modules, evidence rows, graphical-abstract containment, and preview-dialog presentation. |
| `motion.css` | CSS-only page entrance plus scroll reveal and compression states. |
| `skeletons.css` | Static solid loading placeholders and transparent canonical header ink whose line fragments follow resolved typography. |
| `contact.css` | Contact wizard, fields, review, consent, status, and responsive rules. |
| `interactions.css` | Shared Hover Base states and reduced-motion behavior. |
| `utilities.css` | Small reusable utility classes. |

The principal responsive thresholds are 980, 860, 720, 620, 520, 480, and 380 CSS pixels. Use the existing breakpoint that matches the affected layout instead of adding a near-duplicate threshold.

## Cloudflare runtime boundary

`functions/api/contact/verify.ts` verifies a Turnstile response and issues a short-lived signed verification ticket. `functions/api/contact.ts` validates that ticket and the contact payload, checks mail-domain routing, reserves a pseudonymous D1 quota slot, and sends two sequential idempotent Resend requests. Shared validation, response construction, cryptography, configuration parsing, and delivery helpers live in `functions/_shared/contact.ts`; the minimal reservation schema lives under `migrations/`.

`public/_routes.json` is the deployment allowlist for those exact Function paths. Broadening it changes the runtime and security boundary and requires tests plus updates to [Contact system](../security/CONTACT_SYSTEM.md) and [Security](../security/SECURITY.md).

## Tests

Tests stay next to the behavior they protect when practical:

- component and route tests under `src/`;
- Function tests under `functions/`;
- content-generation and automation tests under `scripts/`;
- CSS contract tests next to the component or style behavior they protect.

Vitest discovers the complete suite. ESLint, TypeScript, the static build, documentation validation, artifact checks, and deployment smoke tests provide additional layers. See [Testing](../quality/TESTING.md).

## Where should this change go?

| Change | Primary locations | Also review |
| --- | --- | --- |
| Add or change a portfolio content field | template header, `types.ts`, normalization, validation, selector, component | Content tests, schema, mapping, public workbook, security impact |
| Change an existing sheet column | matching template and content helpers | Remote workbook header, schema, tests, hash behavior |
| Add a Home section | `HomeOverview.tsx` and a focused portfolio component | Home selector, skeleton, responsive CSS, accessibility, tests, mapping |
| Add a detail route | `src/app/<route>/` and `siteRoutes.ts` | Navigation, metadata, loading state, tests, smoke coverage |
| Change a theme token | `src/styles/tokens.css` | All themes, focus states, contrast, design system, theme tests |
| Add a surface primitive | `src/components/glass/` and `glass.css` | Hover Base state, semantics, reduced motion, solid-tier design system |
| Change navigation or footer behavior | layout and navigation components plus CSS | Keyboard behavior, route tests, footer regressions, accessibility |
| Change contact behavior | contact components, Functions, migrations, and contact tests | Privacy and security pages, Function routes, D1 retention, WAF review, contact docs |
| Add a runtime endpoint | `functions/` and `public/_routes.json` | Threat model, limits, rate limiting, headers, tests, operations |
| Change artifact behavior | deployment scripts under `scripts/` | Workflow, package-script tests, deployment and operations docs |
| Change deployment behavior | workflow, deployment scripts, and `wrangler.jsonc` | Permissions, exact-SHA guard, preview isolation, tests, docs |
| Add or reorganize documentation | owning guide and `docs/README.md` | Relative links, `npm run docs:check`, root README discoverability |

## Related guides

- [Architecture](ARCHITECTURE.md)
- [Content pipeline](../content/CONTENT_PIPELINE.md)
- [Design system](../design/DESIGN_SYSTEM.md)
- [Testing](../quality/TESTING.md)
- [Maintenance](../development/MAINTENANCE.md)
