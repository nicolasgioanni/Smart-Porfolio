# Architecture

Smart Portfolio is a static-first Next.js application with a build-time content pipeline, a typed generated-content boundary, and two isolated Cloudflare Pages Functions for the contact workflow. The browser never reads the workbook. GitHub Actions owns verification and deployment.

## System goals

- Deliver the portfolio as static HTML, CSS, JavaScript, and public assets from Cloudflare Pages.
- Let the portfolio owner edit public-safe content independently from React components.
- Reject structurally or semantically invalid workbook content before build.
- Deploy the exact candidate that passed tests and artifact-integrity checks.
- Keep request-time code limited to the contact verification and delivery boundary.
- Preserve readable, keyboard-operable content when motion or glass effects are disabled.

## System context

```mermaid
flowchart TB
    Owner[Portfolio owner] --> Workbook[Public-safe XLSX workbook]
    Owner --> Templates[Local CSV templates]

    subgraph Build[Build and deployment]
        Actions[GitHub Actions]
        Validate[Download and validate]
        Normalize[Normalize and hash]
        Json[Typed generated JSON]
        Export[Next.js static export]
        Artifact[Verified artifact]
    end

    Workbook --> Actions
    Templates --> Validate
    Actions --> Validate --> Normalize --> Json --> Export --> Artifact
    Artifact --> Pages[Cloudflare Pages]
    Pages --> Browser[Visitor browser]

    subgraph Contact[Runtime contact boundary]
        Verify[/api/contact/verify]
        Submit[/api/contact]
        Turnstile[Cloudflare Turnstile]
        DNS[Mail-domain DNS]
        D1[Cloudflare D1]
        Resend[Resend]
    end

    Browser --> Verify --> Turnstile
    Browser --> Submit
    Submit --> DNS
    Submit --> D1
    Submit --> Resend
```

The build-time content path, static delivery path, and runtime contact path remain separate. See [Content pipeline](CONTENT_PIPELINE.md), [Deployment](DEPLOYMENT.md), and [Contact system](CONTACT_SYSTEM.md) for their detailed contracts.

## Boundaries

| Boundary | Inputs | Outputs | Runs where |
| --- | --- | --- | --- |
| Content authoring | Public-safe workbook or local templates | Source rows | Owner workflow or local repository |
| Content generation | One source snapshot | Validated generated JSON and semantic hash | Local process or GitHub Actions |
| Static application | Generated JSON, components, styles, public assets | `out/` static export | Next.js build |
| Deployment | Tested export, exact commit, Functions, Wrangler config | Cloudflare Pages deployment | GitHub Actions |
| Contact verification | Turnstile token and opaque submission ID | Signed host-only verification ticket | `/api/contact/verify` Pages Function |
| Contact delivery | Verification ticket and contact payload | DNS result, D1 reservation, and two Resend acceptances | `/api/contact` Pages Function |

Core pages do not require a runtime Next.js server, database, authentication service, or runtime content API. The two Pages Functions are deployed beside the static export but are not part of the Next.js route tree.

## Application layers

| Layer | Primary source | Responsibility |
| --- | --- | --- |
| Routes and metadata | `src/app/` | Static route composition, page metadata, loading files, and legal content. |
| Layout and navigation | `src/components/layout/`, `src/components/navigation/` | Shared shell, desktop header, active routes, mobile bottom dock and rail, footer, and profile preview. |
| Portfolio UI | `src/components/portfolio/` | Home overview, evidence pages, cards, skills, recommendations, and route-specific presentation. |
| Theme and interaction | `src/components/theme/`, `src/components/motion/`, `src/lib/theme/` | Theme persistence, role and scroll motion, reduced-motion behavior, and hydrated state. |
| Content contracts | `src/content/types.ts` | Generated and UI-facing TypeScript shapes. |
| Content transformation | `src/lib/content/`, `src/lib/csv/`, `scripts/lib/portfolioContentGeneration.ts` | Parsing, normalization, validation, selection, sorting, hashing, and workbook structure. |
| Styling | `src/styles/` | Semantic tokens, themes, layout, glass primitives, portfolio surfaces, navigation, motion, loading, and contact UI. |
| Runtime contact | `functions/`, `migrations/` | Origin enforcement, Turnstile verification, signed tickets, schema and DNS validation, pseudonymous quota storage, and email delivery. |
| Operations | `.github/workflows/ci.yml`, `scripts/`, `wrangler.jsonc` | Candidate selection, quality gates, artifact integrity, Direct Upload, smoke tests, and environment configuration. |

## Static-first application

`next.config.mjs` sets `output: "export"` and disables Next.js image optimization so all application routes can be emitted as static files. `src/app/layout.tsx` reads the generated snapshot during build, resolves the default theme, creates metadata, and renders the shared shell.

Static export does not mean the site contains no JavaScript. Focused client components hydrate browser-only behavior:

- active-route measurement, mobile rail overflow state, and bounded idle navigation motion;
- theme selection and local preference persistence;
- header and footer disclosure behavior;
- profile image preview;
- Home role rotation;
- scroll reveal where enabled;
- skills dialogs;
- recommendation measurement and expansion;
- contact verification and submission.

Portfolio data is already present in the generated page output. Hydration adds interaction; it does not fetch portfolio content.

## Generated-content boundary

The generator converts either checked-in templates or one complete workbook download into `src/content/generated/portfolio.generated.json`. Application code imports that file only through `getPortfolioContent()`, which validates the generated shape again before selectors and components consume it.

The boundary has four responsibilities:

1. Convert source rows into typed property names and values.
2. Reject invalid required fields, cross-field groups, references, URLs, and duplicate identifiers.
3. Attach source metadata and a canonical SHA-256 content hash.
4. Provide one deterministic snapshot to tests and the static build.

Production candidates use strict remote mode. The workflow generates once, runs tests against that snapshot, and calls `build:generated` so the build cannot download a different workbook revision. Production-generated content is a transient candidate, not deployment state committed back to the branch.

## Content selection and UI mapping

The generated snapshot contains the full public content model. Selectors decide what each surface receives:

- `selectHomeContent()` applies Home visibility, ordering, limits, group construction, and recommendation settings.
- detail selectors sort complete research, project, experience, and recommendation collections.
- `createProfileOverviewContent()` chooses current work, primary education, and profile research from explicit references and deterministic fallbacks.
- display helpers format links, lists, dates, and summary fallback values.

Home is the summary layer. Its implemented order is profile overview, experience, education, research, projects, skills, and recommendations when enabled. Focused routes provide deeper evidence.

See [Content mapping](CONTENT_MAPPING.md) for field-to-component ownership and [Project structure](PROJECT_STRUCTURE.md) for route locations.

## Theme and visual composition

The default theme is resolved from generated site settings. `ThemePreferenceScript` runs before hydration and applies a valid stored Navy, Light, or Dark preference from `portfolio-theme`; otherwise it retains the generated default.

Semantic values in `tokens.css` isolate components from theme-specific colors. Glass surfaces, cards, blobs, controls, navigation, motion, loading states, and the Hover Base interaction system compose those values through focused style sheets. The application remains usable when generated settings disable glass effects or scroll motion.

Above `980px`, the sticky header owns profile identity, desktop routes, social links, theme selection, and compact-on-scroll behavior. At `980px` and below, the identity and desktop route list are hidden and the same glass island becomes a fixed bottom dock. Its left side is a native horizontal route rail; its non-scrolling right side keeps the configured GitHub, LinkedIn, Email, and theme controls available. Safe-area insets and shell bottom clearance prevent the dock from covering route content.

See [Design system](DESIGN_SYSTEM.md), [Accessibility](ACCESSIBILITY.md), and [Animation guidelines](ANIMATION_GUIDELINES.md).

## Contact boundary

The Contact page itself is a static route. Runtime work begins only when its client component calls one of the two same-origin Functions allowed by `public/_routes.json`.

### Verification

The visitor completes the visible Turnstile check before entering contact details. The browser sends the token and a generated submission ID to `/api/contact/verify`. The Function enforces POST, JSON media type, exact origin, a narrow request shape, configuration, Turnstile success, the fixed `portfolio_contact` action, and an allowed hostname.

A successful result sets a 30-minute `__Host-portfolio_contact_ticket` cookie. It is `HttpOnly`, `Secure`, `SameSite=Strict`, host-only, path-scoped to `/`, signed with an HMAC key derived from `TURNSTILE_SECRET_KEY`, and bound to the submission ID. It contains no contact fields.

### Delivery

The browser submits contact fields, acknowledgements, timing metadata, honeypot value, and the same submission ID to `/api/contact`. The Function applies its request and schema rules, verifies the ticket binding, validates mail routing for the email domain, and reserves one of two rolling 24-hour slots in D1. It then asks Resend to accept the visitor confirmation before sending the private owner notification. Each message has its own submission-scoped idempotency key.

Successful delivery clears the ticket. Delivery failure retains an otherwise valid ticket and the original quota reservation for retry. The D1 row stores only the submission UUID, keyed normalized-email hash, and reservation and expiry epoch seconds; it stores no raw contact fields or message. Request bodies or personal fields must not be written to logs.

The repository-enforced address quota does not authenticate mailbox ownership and can be bypassed with aliases, so Cloudflare WAF rate limiting remains an operator-managed defense in depth. Source code can document and test the expected endpoint behavior, but it cannot prove the live zone rule, plan capability, or response customization. See [Contact system](CONTACT_SYSTEM.md) and [Security](SECURITY.md).

## Deployment boundary

The deployment design makes GitHub Actions the sole deployment owner. Operators must keep Cloudflare Pages Git integration disabled. The workflow sends Direct Upload only an artifact that passed the repository gate.

A deployable candidate follows this sequence:

1. Resolve the exact candidate commit and target branch.
2. Generate one validated content snapshot.
3. Compare its canonical normalized content subset hash with the active production manifest when the event permits a no-op.
4. Run documentation validation, lint, typecheck, focused footer and navigation regressions, the full Vitest suite, both Playwright Chromium suites, and a static build.
5. Write `content-version.json` and `artifact-integrity.json`.
6. Upload and download the immutable Actions artifact.
7. Verify every artifact digest and the candidate commit.
8. Recheck that a production candidate is still current.
9. Validate the selected D1 target and apply pending migrations.
10. Deploy the static export and Functions from repository root with pinned Wrangler.
11. Smoke-test static content, both manifests, and GET rejection from both contact Functions.

The active `/content-version.json` remains the deployed source of truth. A failure before Wrangler upload leaves it unchanged. A post-upload smoke failure can occur after the new manifest is already active, so operators must inspect the deployed result and choose retry or rollback deliberately. See [Operations](OPERATIONS.md) for event behavior, retry, and rollback considerations.

## Public and private data

| Data | Classification | Placement |
| --- | --- | --- |
| Workbook content and metadata selected for the portfolio | Public | Anonymous workbook, generated JSON, static pages |
| Local content templates and public assets | Public when tracked | Repository and static export where referenced |
| Content and artifact manifests | Public-safe operational metadata | Deployed root |
| Turnstile site keys | Public browser configuration | Build environment and client bundle |
| Workbook locator | Anonymous read locator stored for log redaction | GitHub Actions secret |
| Cloudflare API token and account identifier | Deployment credentials | GitHub Actions secrets |
| Turnstile secret, Resend key, and owner recipient | Private runtime configuration | Cloudflare encrypted secrets |
| Submission UUID, keyed normalized-email hash, and quota timestamps | Pseudonymous runtime data | Environment-specific Cloudflare D1 database |
| Allowed origins, allowed hostnames, sender, and public reply-to | Reviewed non-secret configuration | `wrangler.jsonc` |
| Contact fields and message | Personal request data | In-memory validation and email-provider delivery only |

The anonymous workbook must contain only content approved for public release. Storing its locator as an Actions secret provides runner-log redaction, not access control.

## Design decisions and tradeoffs

### Workbook as an authoring surface

The workbook keeps routine content edits separate from page components. Strict structure and value validation add complexity, but prevent silent layout and security drift.

### Static export

Static delivery reduces runtime surface and removes browser content requests. It also means features that require a Next.js server, middleware, or dynamic image optimization need an explicit architecture change.

### Semantic hashing

Hashing a canonical normalized content subset prevents timestamps, workbook metadata, tab order, and harmless formatting differences from causing unnecessary deployments. Every candidate must still be parsed and validated before it can be considered unchanged.

### Exact-artifact deployment

Transferring and verifying the tested `out/` artifact costs additional workflow steps. It prevents the deploy job from rebuilding or fetching different content after verification.

### Isolated contact Functions

The two-step ticket flow avoids sending a consumed Turnstile token twice and keeps contact processing out of the static application. It adds cookie and cryptographic state that must remain narrowly scoped and fully tested.

## Sources of truth

| Topic | Authoritative source |
| --- | --- |
| Dependencies and scripts | `package.json` and `package-lock.json` |
| Runtime and static export | `next.config.mjs` and `src/app/` |
| Route registry and navigation | `src/components/navigation/siteRoutes.ts` and `navigationItems.ts` |
| Browser navigation regression | `playwright.config.ts` and `tests/e2e/navigation.spec.ts` |
| Content types | `src/content/types.ts` |
| Workbook contract | `scripts/lib/portfolioContentGeneration.ts` |
| Source-mode orchestration | `scripts/fetchPortfolioContent.ts` |
| Normalization and validation | `src/lib/content/normalizePortfolioContent.ts` and `validatePortfolioContent.ts` |
| Home order and selection | `HomeOverview.tsx`, `selectHomeContent.ts`, and `profileOverview.ts` |
| Theme behavior | `src/components/theme/`, `src/lib/theme/`, and `tokens.css` |
| Glass and interaction primitives | `src/components/glass/`, `glass.css`, and `interactions.css` |
| Contact verification and delivery | `functions/api/` and `functions/_shared/contact.ts` |
| Contact-rate storage schema | `migrations/` and `wrangler.jsonc` |
| Function routing and static headers | `public/_routes.json` and `public/_headers` |
| Cloudflare project configuration | `wrangler.jsonc` |
| Candidate and deployment behavior | `.github/workflows/ci.yml` |
| Artifact and manifest behavior | `scripts/artifactIntegrity.mjs`, `writeContentVersion.mjs`, and `checkDeployedContent.mjs` |
| License | `LICENSE` |

## Extension constraints

- Keep portfolio content fetching out of browser components and request-time routes.
- Preserve `output: "export"` unless the hosting architecture is deliberately changed.
- Do not bypass normalization, URL validation, reference checks, or generated-content validation.
- Update templates, types, normalization, validation, selectors, components, tests, and field documentation together.
- Do not broaden Function routing without a threat model, request limits, response headers, rate limiting, tests, and documentation.
- Keep client-visible configuration separate from encrypted runtime secrets.
- Do not rebuild or refetch after an artifact has passed verification.
- Treat WAF rules, custom domains, provider keys, and encrypted secrets as external state that repository tests cannot prove.
- Preserve keyboard, focus, reduced-motion, and static-content fallbacks when adding interaction.

Safe change patterns are detailed in [Maintenance](MAINTENANCE.md).
