# Architecture

Smart Portfolio is a static-first Next.js application with a build-time content pipeline, a typed generated-content boundary, and two isolated Cloudflare Pages Functions for the contact workflow. The browser never reads the workbook. GitHub Actions owns verification and deployment.

The implementation map in [Implementation inventory](IMPLEMENTATION_INVENTORY.md) identifies the exact source for each boundary and distinguishes checked-in behavior from operator-managed live configuration.

## System goals

- Deliver the portfolio as static HTML, CSS, JavaScript, and public assets from Cloudflare Pages.
- Let the portfolio owner edit public-safe content independently from React components.
- Reject structurally or semantically invalid workbook content before build.
- Deploy the exact candidate that passed tests and artifact-integrity checks.
- Keep request-time code limited to the contact verification and delivery boundary.
- Preserve readable, keyboard-operable content when motion is disabled.

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

The build-time content path, static delivery path, and runtime contact path remain separate. See [Content pipeline](../content/CONTENT_PIPELINE.md), [Deployment](../operations/DEPLOYMENT.md), and [Contact system](../security/CONTACT_SYSTEM.md) for their detailed contracts.

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
| Overlay primitives | `src/components/overlay/` | Default portal and optional persistent in-place native-dialog rendering, modal lifecycle and topmost stack, focus containment, scroll locking, dismissal, and trigger-focus restoration shared by media and evidence dialogs. |
| Portfolio UI | `src/components/portfolio/` | Home overview, evidence pages, cards, skills, recommendations, and route-specific presentation. |
| Theme and interaction | `src/components/theme/`, `src/components/motion/`, `src/lib/theme/` | System preference resolution, manual theme persistence, role and scroll motion, reduced-motion behavior, and hydrated state. |
| Content contracts | `src/content/types.ts` | Generated and UI-facing TypeScript shapes. |
| Content transformation | `src/lib/content/`, `src/lib/csv/`, `scripts/lib/portfolioContentGeneration.ts` | Parsing, normalization, validation, selection, sorting, hashing, workbook structure, and canonical route-header ownership. |
| Styling | `src/styles/` | Semantic tokens, themes, layout, solid surface primitives, portfolio surfaces, navigation, motion, loading, and contact UI. |
| Runtime contact | `functions/`, `migrations/` | Origin enforcement, Turnstile verification, signed tickets, schema and DNS validation, pseudonymous quota storage, and email delivery. |
| Operations | `.github/workflows/ci.yml`, `scripts/`, `wrangler.jsonc` | Candidate selection, quality gates, artifact integrity, Direct Upload, smoke tests, and environment configuration. |

## Static-first application

`next.config.mjs` sets `output: "export"` and disables Next.js image optimization so all application routes can be emitted as static files. `src/app/layout.tsx` reads the generated snapshot during build, resolves the server fallback theme, creates metadata, and renders the shared shell.

`npm run typecheck` runs `next typegen` before strict TypeScript checking. Generated route and root-parameter declarations stay under ignored `.next/`; Next regenerates the ignored root `next-env.d.ts` as part of that command, while the Next-managed TypeScript settings in `tsconfig.json` are accepted only when a clean type-generation run produces the change. Next 16 also maintains a version-matched agent guidance block in the repository guidance file; leave that managed block intact so implementation work can consult the bundled framework documentation.

`src/app/robots.txt` and `src/app/sitemap.xml` use Next.js static metadata file conventions so they are copied into the export without a runtime metadata route. Their focused tests compare crawler policy and canonical sitemap URLs with the shared site configuration and route registry.

`src/lib/content/routeHeaderContent.ts` owns the exhaustive page-header registry shared by resolved routes and `RouteHeaderSkeleton`. The skeleton renders those same strings as transparent, noninteractive, `aria-hidden` ink over a solid fill so browser typography determines the loader's responsive line boxes. Experience is the sole generated header override: the server-side `resolveRouteHeaderContent()` path consumes the validated profile summary for both the resolved route and loading composition, with the same registry fallback. Research skeleton resource counts likewise reuse validated selected detail content and `getResearchVisibleResources()` rather than maintaining a second presentation model.

Next 16's client router requests flattened `__next.*.txt` segment-cache files. On Windows, the framework exporter can preserve platform separators inside those generated names and create nested directories instead, as tracked in Next.js issues [#92339](https://github.com/vercel/next.js/issues/92339) and [#85374](https://github.com/vercel/next.js/issues/85374). Next 16.3.4 runs the stable `adapterPath` build-completion hook after the full static export, so the local adapter invokes `scripts/normalizeNextStaticExport.mjs` before the content-version writer runs. It converts only directory trees that match 16.3.4's filesystem-safe, dot-free encoded-segment grammar, beginning with one `__next.<encoded-segment>` root, to the same flat layout produced on Linux. It rejects malformed trees, symbolic links, unexpected entries, path escapes, and collisions, preserves the segment bytes, and leaves an already-correct export untouched.

Static export does not mean the site contains no JavaScript. Focused client components hydrate browser-only behavior:

- active-route measurement, mobile rail overflow state, and bounded idle navigation motion;
- system color-scheme following, theme selection, and local override persistence;
- header and footer disclosure behavior;
- profile image preview through the shared modal layer;
- Home role rotation;
- scroll reveal where enabled;
- skills dialogs through the shared modal layer;
- independent Project Concept/How it works tabs;
- recommendation measurement and expansion;
- contact verification and submission.

Portfolio data is already present in the generated page output. Hydration adds interaction; it does not fetch portfolio content.

## Generated-content boundary

The generator converts either checked-in templates or one complete workbook download into `src/content/generated/portfolio.generated.json`. Application code imports that file only through `getPortfolioContent()`, which validates the generated shape again before selectors and components consume it.

Research graphical abstracts and video cross one additional presentation boundary. `getResearchGraphicalAbstract()` selects a complete canonical path-and-alt pair when authored, otherwise supplies the checked-in abstract for one of the three established project IDs only when both canonical fields are absent. `getResearchVideo()` supplies the curated, captioned CytoCV media only for its exact ID when its canonical video field is absent; an authored value must pass the strict local video-path guard and match the registered self-hosted asset, while its captions and transcript must also pass their local allowlists. Both resolvers accept own registry keys only, and invalid or incomplete canonical input is never masked by a fallback. The temporary legacy workbook `image` field is discarded during normalization and is never a presentation input. `ResearchGraphicalAbstractPreview` and `ResearchVideoPreview` progressively enhance static media with the shared `ModalDialog`; neither fetches portfolio content or duplicates modal lifecycle behavior. The video asset contract is in [Research media](../content/RESEARCH_MEDIA.md).

The boundary has four responsibilities:

1. Convert source rows into typed property names and values.
2. Reject invalid required fields, cross-field groups, references, URLs, and duplicate identifiers.
3. Attach source metadata and a canonical SHA-256 content hash.
4. Provide one deterministic snapshot to tests and the static build.

Production candidates use strict remote mode. The workflow generates once, runs tests against that snapshot, and calls `build:generated` so the build cannot download a different workbook revision. Production-generated content is a transient candidate, not deployment state committed back to the branch.

## Project presentation boundary

The workbook remains the authority for project records, summaries, ordering, visibility, and destinations. `src/lib/projects/projectVisualRegistry.ts` adds typed local illustration metadata and diagram content for established IDs without changing `ProjectItem` or the workbook schema. Unknown IDs fall back to authored content and images. `projectActions.ts` supplies the shared source-first action selection used by Home, the gallery, and their loading footprints.

`ProjectList` and `ProjectCard` remain server-composed around `PortfolioCard`, `FeaturedGrid`, and `GlassButton`. Only each `ProjectVisualTabs` boundary owns client selection; it starts at Concept on every route mount and does not fetch data. Native disclosures retain diagrams without JavaScript. Home stays compact and keeps its existing skill-dialog behavior. The [project showcase guide](../content/PROJECT_SHOWCASE.md) owns the five-row migration, reviewed source evidence, image prompts, and attribution.

## Content selection and UI mapping

The generated snapshot contains the full public content model. Selectors decide what each surface receives:

- `selectHomeContent()` applies Home ordering, limits, group construction, and recommendation settings; `selectVisibleContent.ts` supplies its shared explicit-visibility, featured, then all-items fallback.
- `selectDetailContent.ts` sorts complete research, project, experience, and education collections; `selectRecommendationContent.ts` owns recommendation selection and excerpt fallback.
- `createProfileOverviewContent()` chooses current work, primary education, and profile research from explicit references and deterministic fallbacks.
- display helpers format links, lists, dates, and summary fallback values. The shared `DisabledResourceButton` keeps unpublished resources semantically native across profile and Research surfaces.

Home is the summary layer. Its implemented order is profile overview, experience, education, research, projects, skills, and recommendations when enabled. Focused routes provide deeper evidence.

See [Content mapping](../content/CONTENT_MAPPING.md) for field-to-component ownership and [Project structure](PROJECT_STRUCTURE.md) for route locations.

## Theme and visual composition

The server fallback theme is resolved from generated site settings. A synchronous `ThemePreferenceScript` runs in the document head before hydration. It applies a valid stored `navy`, `light`, or `dark` override from `portfolio-theme`; without one, it maps `(prefers-color-scheme: dark)` to Dark or Light before body paint. The generated value remains the no-JavaScript and unavailable-media-query fallback. The visitor-facing label for the stable `navy` identifier is My mode.

After hydration, `useThemePreference` tracks the preference and effective palette separately. System mode listens for live device color-scheme changes. A manual Light, My mode, or Dark choice takes precedence and is synchronized across tabs through browser storage events. Choosing System removes the stored override and immediately resumes device following; a cleared or invalid cross-tab value has the same effect.

All hydrated effective-palette writes pass through `applyTheme` in `src/lib/theme/themeTransition.ts`. The first reconciliation is a direct write because the head script already selected the correct prepaint palette. Later manual, live-system, and storage-driven changes progressively invoke the native View Transitions API for one `160ms` opacity-only root snapshot fade. Reduced-motion, hidden-document, unavailable, failed, and unchanged-palette paths write directly, so preference semantics, static rendering, and no-flash behavior do not depend on the enhancement.

Semantic values in `tokens.css` isolate components from theme-specific colors. Surface primitives, cards, blobs, controls, navigation, motion, loading states, and the Hover Base interaction system compose those values through focused style sheets. Light uses distinct off-white, light-gray, and blue-gray tiers; Dark uses distinct charcoal and slate tiers. The application remains usable when generated settings disable legacy glass effects or scroll motion, with both surface paths staying opaque and solid.

Above `980px`, the sticky header owns profile identity, desktop routes, social links, theme selection, and compact-on-scroll behavior. At `980px` and below, the identity and desktop route list are hidden and the same surface island becomes a fixed bottom dock. One native horizontal rail contains the canonical route navigation followed by the configured GitHub, LinkedIn, Email, and theme controls. The route links retain their own navigation landmark, while the action controls remain outside that landmark. The theme popover is positioned above its moving trigger without being clipped by the rail. Safe-area insets and shell bottom clearance prevent the dock from covering route content.

See [Design system](../design/DESIGN_SYSTEM.md), [Accessibility](../design/ACCESSIBILITY.md), and [Animation guidelines](../design/ANIMATION_GUIDELINES.md).

## Contact boundary

The Contact page is static. Runtime work begins only when its client component calls the two same-origin Functions allowlisted by `public/_routes.json`. The browser submits a fresh Turnstile token and generated submission ID to `/api/contact/verify`; after server-side verification, the host-only signed ticket binds the later request to that same ID. The browser then sends the locked, acknowledged form payload to `/api/contact`. The delivery Function independently validates it, validates mail-domain routing, reserves a pseudonymous D1 quota slot, and requests visitor acceptance before the private owner notification.

The request schema, byte and time bounds, status mapping, one-operation Turnstile retry, cookie semantics, retry-payload binding, D1 columns, idempotency keys, and Function response headers have one canonical home in [Contact System: endpoint contract](../security/CONTACT_SYSTEM.md#endpoint-contract), [verification ticket](../security/CONTACT_SYSTEM.md#verification-ticket), [quota](../security/CONTACT_SYSTEM.md#mail-domain-validation-and-rolling-quota), and [delivery](../security/CONTACT_SYSTEM.md#email-delivery-and-idempotency). Its [configuration](../security/CONTACT_SYSTEM.md#configuration) and [abuse-control](../security/CONTACT_SYSTEM.md#abuse-protection-enforced-and-external-controls) sections distinguish repository enforcement from the operator-managed WAF, provider, and dashboard state. Do not duplicate those API limits or provider behavior in architecture changes.

## Deployment boundary

The deployment design makes GitHub Actions the sole deployment owner. Operators must keep Cloudflare Pages Git integration disabled. The workflow sends Direct Upload only an artifact that passed the repository gate.

At the architecture level, the release has five boundaries: select the exact candidate and one content snapshot; verify the selected test tier and static export; bind content and artifact metadata to that candidate; revalidate the immutable artifact and selected D1 target before Wrangler; then smoke-test the assigned Pages alias. The workflow does not rebuild or fetch content after verification.

[Deployment: single-snapshot, exact-artifact pipeline](../operations/DEPLOYMENT.md#single-snapshot-exact-artifact-pipeline) owns the ordered release steps, including no-op selection, manifest transfer, branch recheck, and migration ordering. [Testing: CI quality gates](../quality/TESTING.md#ci-quality-gates) owns the priority and full test matrices. [Operations: failure triage](../operations/OPERATIONS.md#failure-triage) owns the recovery decision: a failure before Wrangler leaves the active target unchanged, while a post-upload smoke failure may occur after the new candidate is active and requires a deliberate retry or rollback.

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
| Submission UUID, keyed normalized-email hash, keyed payload fingerprint, and quota timestamps | Pseudonymous runtime data | Environment-specific Cloudflare D1 database |
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

Use [Implementation inventory](IMPLEMENTATION_INVENTORY.md) to decide whether a fact is implemented, repository-declared, operator-managed, historical, or proposed before changing this guide. The table below then identifies the detailed authority for each implemented contract.

| Topic | Authoritative source |
| --- | --- |
| Dependencies and scripts | `package.json` and `package-lock.json` |
| Runtime and static export | `next.config.mjs` and `src/app/` |
| Route registry and navigation | `src/lib/routing/siteRoutes.ts` and `src/components/navigation/navigationItems.ts` |
| Browser navigation regression | `playwright.config.ts` and `tests/e2e/navigation.spec.ts` |
| Skeleton alignment, visual, and transition regressions | `tests/e2e/skeleton-alignment.spec.ts`, `tests/e2e/skeletons.visual.spec.ts`, `tests/e2e/skeletons.transition.spec.ts`, `tests/e2e/standaloneSkeletonDocument.ts`, and `.github/workflows/skeleton-baselines.yml` |
| Canonical route-header content | `src/lib/content/routeHeaderContent.ts` and `src/components/loading/RouteHeaderSkeleton.tsx` |
| Content types | `src/content/types.ts` |
| Workbook contract | `scripts/lib/portfolioContentGeneration.ts` |
| Source-mode orchestration | `scripts/fetchPortfolioContent.ts` |
| Normalization and validation | `src/lib/content/normalizePortfolioContent.ts` and `validatePortfolioContent.ts` |
| Home order and selection | `src/components/portfolio/home/HomeOverview.tsx`, `selectHomeContent.ts`, and `profileOverview.ts` |
| Theme behavior | `src/components/theme/`, `src/lib/theme/`, and `tokens.css` |
| Glass and interaction primitives | `src/components/glass/`, `glass.css`, and `interactions.css` |
| Contact verification and delivery | `functions/api/`, the stable `functions/_shared/contact.ts` facade, and its focused `functions/_shared/contact/` modules |
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

Safe change patterns are detailed in [Maintenance](../development/MAINTENANCE.md).
