# Testing

Smart Portfolio uses a layered quality gate for documentation, static content, React behavior, style contracts, Cloudflare Pages Functions, deployment automation, and the exported build. This guide maps each command to the behavior it actually verifies.

## Supported environment

| Setting | Value |
| --- | --- |
| Node.js | 22.13 or newer locally, Node.js 22 in CI |
| Package installation | `npm ci` from `package-lock.json` in CI |
| Test runner | Vitest 4.1.11 |
| Default test environment | jsdom |
| DOM assertions | Testing Library and `@testing-library/jest-dom` |
| Browser runner | Playwright 1.x with Chromium |
| TypeScript mode | Strict, no emit |
| CI runner | Verify: `ubuntu-24.04`; deploy and scheduled heartbeat: `ubuntu-latest` |

`vitest.config.ts` enables globals, loads `vitest.setup.ts`, maps `@` to `src`, excludes `tests/e2e/`, and uses one fork worker so local D1 and jsdom contracts do not compete for host resources. Playwright likewise runs one worker and starts an owned Next.js server; select a unique `PLAYWRIGHT_PORT` when another worktree is active. The verification path has one explicit Ubuntu 24.04 and Node 22 configuration, not a multi-platform test matrix.

## Command matrix

| Command | What it runs | Important behavior |
| --- | --- | --- |
| `npm run docs:check` | Dependency-free Markdown validator | Does not make network requests |
| `npm run generate:content` | Content source download or template read, normalization, validation, and generated JSON write | Uses `.env` when run through the CLI |
| `npm run lint` | ESLint over the repository with `--max-warnings=0` | Generated content and build directories are ignored; direct library/component import boundaries cover alias and relative specifiers |
| `npm run typecheck` | `next typegen && tsc --noEmit` | Regenerates Next route types and the ignored managed `next-env.d.ts` before strict TypeScript checking |
| `npm run test:priority` | High-risk documentation, deployment, contact, shared dialog, theme palette, Research, Experience, Recommendations, navigation, and skeleton contracts | Pull-request unit and contract gate; feature directories admit future shared-detail tests and it includes every Function test under `functions/` |
| `npm run test:footer` | Two focused footer regression files | Use while changing the footer; release CI covers them through `test` |
| `npm run test:navigation` | Focused mobile rail, header, responsive-query, theme, and navigation style tests | Use while changing navigation; release CI covers them through `test` |
| `npm run test:skeletons` | Focused skeleton component, content, style, and page-entry tests | Protects route fallback semantics, fixture geometry, and static no-motion placeholders |
| `npm run test:e2e:priority` | Playwright skeleton alignment and held-navigation transitions, navigation, footer, mocked-contact, Recommendations, Experience, and Research flows | Portable pull-request browser gate; uses no provider credentials or delivery endpoint and intentionally excludes Linux-only visual comparison |
| `npm run test:e2e:full` | Every supported Playwright specification in one Chromium process | Release browser gate; includes every skeleton part and the mocked-contact flow |
| `npm run test:e2e:contact` | Playwright contact flow specification in Chromium | Mocks Turnstile and both same-origin contact endpoints; never submits to a provider |
| `npm run test:e2e:navigation` | Playwright navigation specification in Chromium | Uses port 3100 by default and starts its own local server |
| `npm run test:e2e:skeletons:alignment` | Playwright resolved-page versus canonical-loader geometry specification | Covers direct header line boxes, wrap boundaries, generated Experience copy, detail footprints, overflow, themes, and reduced motion in inert same-origin fixtures |
| `npm run test:e2e:skeletons:visual` | Linux-only Playwright screenshot specification | Captures or compares 23 reviewed skeleton geometry baselines on Ubuntu 24.04 only, rejecting browser diagnostics before any screenshot |
| `npm run test:e2e:skeletons` | Playwright alignment, route-transition, and visual skeleton specifications | Runs the direct geometry matrix, holds non-prefetch RSC navigation for each non-Home route, and includes the Linux visual matrix; it does not claim static-export streaming |
| `npm run test:e2e:footer` | Playwright footer specification in Chromium | Covers every route, first paint, client navigation, restored scroll, and scroll activation |
| `npm run test:e2e:recommendations` | Playwright recommendation specification in Chromium | Samples desktop geometry through expansion and dismissal, then checks responsive and reduced-motion behavior |
| `npm run test:e2e:experience` | Playwright experience specification in Chromium | Protects detail-level switching, disclosure semantics, responsive controls, and reduced-motion behavior |
| `npm run test:e2e:research` | Playwright research specification in Chromium | Protects research-card alternation, accessible detail disclosures, responsive stacking, reduced-motion behavior, graphical abstracts, and the CytoCV video modal |
| `npm run test` | Complete Vitest suite, including local D1 and Workers transport integration coverage | Uses mocks, jsdom, isolated local D1, and local workerd; no live provider credentials |
| `npm run build` | `prebuild`, Next.js static export, segment-cache normalization, then content-version write | Regenerates content before building |
| `npm run build:generated` | Next.js static export, segment-cache normalization, and content-version write | Consumes existing generated JSON without another content fetch |
| `npm audit` | Locked full dependency graph audit | Covers development and deployment dependencies |
| `npm audit --omit=dev` | Locked production dependency graph audit | Covers the deployed runtime dependency graph |
| `npm run db:migrate:local` | Pending tracked migrations against Wrangler's local D1 state | Never targets preview or production |
| `npm run verify` | Docs check, lint, typecheck, full Vitest suite, and normal build | Compatibility local gate; does not install Chromium |
| `npm run verify:priority` | Docs check, lint, typecheck, priority Vitest and browser suites, and normal build | Portable pull-request-sized local gate; install Chromium first. Linux CI runs the visual skeleton comparison as its separate priority-only step |
| `npm run verify:full` | Docs check, lint, typecheck, complete Vitest and Playwright suites, and normal build | Release-candidate gate; its Linux-only visual comparison must run on Ubuntu 24.04 |
| `npm run verify:local` | Dependency preparation, explicit content generation, then `verify` | The final normal build invokes generation again |

Use the cross-platform `verify:local:node` alias when PowerShell is unavailable.

## Documentation integrity

Run:

```bash
npm run docs:check
```

`scripts/validateDocumentation.mjs` reads `README.md`, every Markdown file under `docs/`, the optional root `AGENTS.md`, and every Markdown file under `.agents/`. It checks:

- Exactly one H1 per document.
- Balanced fenced code blocks.
- Resolution and exact capitalization of relative Markdown, image, reference, HTML `href`, and HTML `src` links.
- Rejection of relative links that escape the repository.
- Rejection of links to local environment files or generated output directories.
- Rejection of absolute Windows user paths.
- Localhost URL use only in the approved local-development documents.
- Rejection of workbook URL patterns and obvious unresolved placeholders.
- Validation of repository-local agent skill frontmatter and links when `.agents/` is present.
- Rejection of prose that presents generated output directories as committed source.

The validator uses only Node.js standard-library APIs and does not check external-link availability. Its fixture tests live in `scripts/validateDocumentation.test.mjs`.

## Content pipeline coverage

| Area | Authoritative tests | Coverage |
| --- | --- | --- |
| CSV parsing and normalized content shape | `src/lib/content/content.test.ts` | Fields, IDs, URLs, research-media path and pairing rules, dates, ordering, selection, empty states, and profile helpers |
| Workbook download boundary | `scripts/portfolioContentGeneration.test.ts` | Anonymous HTTPS URL, bounded retry and backoff, fresh attempt signals, stalled-body cancellation, byte cap, response validation, and strict failure behavior |
| Workbook structure | `scripts/portfolioContentGeneration.test.ts` | Exact worksheets, normalized titles, visibility, headers, dimensions, cells, formulas, schema errors, and an ExcelJS data-bar write/read round trip that exercises its UUID extension path |
| Semantic hashing | `scripts/portfolioContentGeneration.test.ts` | Canonical normalized content subset, research-media fields, and `generatedAt` preservation |
| Public asset references | `scripts/demoAssets.test.mjs`, `scripts/pngMetadata.test.mjs` | Referenced local assets and the three curated research abstracts exist and are non-empty; configured media stays under its allowlisted directory and extensions; Research PNG IHDR, palette, critical-chunk, zlib, Adam7 scanline, and nonempty image-data ordering semantics; stat-before-read size rejection; protected byte/chunk/decoded-data/dimension/canvas ceilings; restricted metadata absence; and dimensions, exact byte length, complete-file SHA-256, and IDAT-stream SHA-256 for every curated abstract |
| Environment placeholders | `scripts/envConfiguration.test.mjs` | Supported variables, ignored local files, and removal of legacy variable families |
| D1 configuration and schema | `scripts/d1Configuration.test.mjs`, `scripts/d1Reservation.integration.test.ts` | Distinct pinned remote UUIDs, local isolation, minimal reservation and payload-fingerprint columns, indexes, migration-before-deploy ordering, and real local-D1 changed-payload and third-reservation refusal |

These are unit and integration-style tests with temporary files and injected fetch implementations. They do not download the production workbook during pull-request verification.

## Contact-system coverage

| Layer | Authoritative tests | Coverage |
| --- | --- | --- |
| Client field validation | `src/components/contact/contactFormValidation.test.ts` | Required fields, trimming, email suffix and Punycode rules, phone, 500-character message boundary, and shared limits |
| Workers transport | `scripts/contactTransport.integration.test.ts` | Actual local workerd plain/JSON success and every 3xx rejection, with zero destination requests or credential forwarding |
| IANA snapshot | `scripts/updateContactTlds.test.mjs` | Complete attributed offline suffix set, bounded explicit updater, malformed/oversized input, and no build-time download |
| Contact notifications | `src/components/contact/ContactNotifications.test.tsx` | Body portal, three-card capacity, duplicates, independent expiry, pause/resume, announcements, focus recovery, dismissal, and reduced motion |
| Turnstile widget | `src/components/contact/TurnstileWidget.test.tsx` | Visible upfront rendering, submission custom data, success, expiry, reset, theme, and missing-key failure |
| Contact route | `src/app/contact/contact.test.tsx` | Hard-gate isolation, 500-millisecond transition and Continue fallback, three data-entry steps, two acknowledgments, challenge and two-hour draft recovery, retry focus, repeated-click blocking, exact payload, standalone success, subsequent-message gates, and locked retries |
| Verification Function | `functions/api/contact/verify.test.ts` | Method, origin, media type, body contract, Siteverify action, hostname and custom-data binding, operation-scoped bounded retry, transient failure mapping, remote IP, and signed cookie |
| Delivery Function | `functions/api/contact.test.ts` | Method, origin, media type, body size, schema, honeypot, timing, ticket, DNS, rolling quota, keyed retry-payload binding, sequential idempotent delivery, and retry |
| Contact styles | `src/styles/contactStyles.test.ts` | Notice tones, focus, disabled, responsive, wrapping, animation, and reduced-motion contracts |
| Legal disclosures | `src/components/legal/legal.test.tsx` | Contact processing, pseudonymous reservation storage, DNS validation, retention, and published notices |

The Function tests call exported handlers with web-standard `Request` and `Response` objects while mocking Turnstile, DNS, D1, and Resend. They do not execute in a real Workers runtime, cross a WAF rule, use live provider credentials, mutate remote D1, or send production email.

The separate transport integration test executes the actual shared transport in local workerd through the Miniflare version pinned alongside Wrangler. Its local provider fixture accepts credential-bearing requests and advertises redirects to an instrumented destination. Both helpers must accept successful exchanges and reject every status from 300 through 399 without a destination request. This catches Workers API incompatibilities that Node mocks miss. It runs in the priority PR gate and full suite; it does not prove live Turnstile, WAF, DNS, or Resend configuration.

The contact browser specification also checks unchanged gate geometry across loading, expiry, widget shrink/removal, failure, retry, pending server confirmation, and success at desktop/mobile widths, in all themes and reduced motion. It covers stacked notification peeks, touch/keyboard expansion and dismissal, focus recovery, viewport scrolling, email suffix typos, and retained completion/recovery. Unit tests separately control independent 30-second clocks, duplicate refresh, capacity eviction, and announcements. Existing skeleton baselines and all three skeleton regression gates remain unchanged.

## Interface and accessibility coverage

| Area | Test files | Main contracts |
| --- | --- | --- |
| Navigation and links | Tests under `src/components/navigation/`, plus responsive-query and theme tests | Route registry, active indicator, fixed mobile dock, unified route-and-action rail order, overflow state, idle motion, five-second interaction pause and resume, responsive transitions, external-link safety, and cleanup |
| Themes | Tests under `src/components/theme/`, `src/lib/theme/`, and `src/styles/themePalette.test.ts` | Stable identifiers, visitor-facing labels, pre-hydration system resolution, live device changes, manual precedence, cross-tab synchronization, complete palette tokens, contrast, solid surface tiers, no decorative gradients/glow/blur/masks, keyboard and pointer behavior, native fade eligibility, immediate fallback, and cleanup |
| Motion | `src/components/motion/motion.test.tsx`, `src/components/motion/pageEntryStyles.test.ts`, `src/components/portfolio/profile/AnimatedRole.test.tsx` | Page-root entrance scope, reveal persistence, animation timing, static fallback, reduced motion, and cleanup |
| Footer | `src/components/layout/InteractiveBlobFooter.test.tsx`, `src/components/layout/footerStyles.test.ts` | Server fallback, route-scoped compact state, user-scroll activation, layout-shift resistance, focus safety, responsive layout, motion, and cleanup |
| Skeletons | Tests under `src/components/loading/` plus `scripts/renderRouteSkeleton.test.mjs` | Structure, busy and hidden state, route delegation, canonical header ownership, generated Experience override, body-placeholder content safety, Research footprints, and static solid styling |
| Portfolio rendering | `src/components/portfolio/portfolio.test.tsx` | Home order, cards, empty states, actions, profile hierarchy, images, and footer content |
| Research showcase | `src/components/portfolio/research/ResearchShowcase.test.tsx`, `src/components/portfolio/research/researchStyles.test.ts`, `src/lib/content/researchGraphicalAbstracts.test.ts`, `src/lib/content/researchVideos.test.ts` | Project order, canonical-over-curated media resolution, legacy-workbook-safe fallbacks, alternating contained abstracts, strict local video resolution, responsive layout, resource states, audience depth, disclosure isolation, motion, and Escape behavior |
| Research video assets | `src/lib/media/researchVideoAssets.test.ts`, `src/lib/media/researchVideoPlayback.test.ts`, `src/components/portfolio/research/ResearchVideoPreview.test.tsx` | Immutable MP4, LF-only captions, and visual-description transcript hashes; bounded deterministic MP4 stream metadata and WebVTT timing; native controls; error/download/transcript fallbacks; metadata status recovery; and paused timeline handoff with no programmatic playback through the shared dialog |
| Shared detail controls | `src/components/portfolio/experience/ExperienceShowcase.test.tsx`, `src/components/portfolio/experience/experienceStyles.test.ts` | Compact top-right selector geometry, audience state, shared disclosure semantics, responsive flow, and reduced motion |
| Shared dialogs | `src/components/overlay/ModalDialog.test.tsx`, `src/components/navigation/navigation.test.tsx`, `src/components/portfolio/skills/PortfolioSkillShowcase.test.tsx`, `src/components/portfolio/projects/ProjectSkillShowcase.test.tsx`, `src/components/portfolio/research/ResearchGraphicalAbstractPreview.test.tsx` | Portal lifecycle, accessible names, informative abstract alt text, initial focus, native media controls, focus containment and recovery through exit, topmost stack isolation, Escape, backdrop isolation, exact scroll-lock restoration, reduced motion, rapid reopen, and trigger-focus restoration |
| Recommendations | Recommendation component, layout, and style tests under `src/components/portfolio/` | Expansion, link safety, row measurement, overflow reservation, hard clipping, and reduced motion |
| Static search metadata | `src/app/robots.test.ts`, `src/app/sitemap.test.ts` | Static metadata file syntax, approved crawler policy, canonical sitemap URL, and exact indexable route set |
| Static security contracts | `src/lib/content/security.test.ts` | No Next.js runtime endpoints, scoped Pages routing, safe structured links, responsive and motion contracts |
| Architecture import direction | `src/lib/architecture/importBoundaries.test.ts` | Direct alias and relative import policy for library and component layers, plus permitted shared dependencies |

Many accessibility assertions verify semantic roles, names, focus behavior, keyboard handling, `aria` state, and reduced-motion fallbacks. The repository does not currently run an automated browser accessibility scanner.

## Browser skeleton coverage

`tests/e2e/skeleton-alignment.spec.ts` measures resolved header Range fragments against the canonical loader ink at compact, phone, tablet, navigation-transition, and fluid desktop widths. It also covers representative wrap boundaries, the generated Experience summary override, Home overflow, Projects and Research detail footprints, Light and Dark, and reduced motion. Both alignment and screenshot suites use `tests/e2e/standaloneSkeletonDocument.ts` to render canonical server markup in a separate same-origin inert page with real shell attributes, compiled stylesheets, and the generated body font; they never replace React-owned DOM.

`tests/e2e/skeletons.visual.spec.ts` compares 23 reviewed Ubuntu 24.04 images with zero pixel difference. `tests/e2e/skeletons.transition.spec.ts` holds each non-Home route's first non-prefetch RSC request and asserts that the source body remains in place. Static export does not stream `loading.tsx`; the transition suite must not claim otherwise. The portable `test:e2e:priority` command runs alignment and transition semantics, while the priority CI job adds the visual suite as a separate Ubuntu-only step. The `npm run test:e2e:skeletons` aggregate remains the canonical three-part command; the full tier discovers all three specifications through `npm run test:e2e:full`.

## Browser navigation coverage

`tests/e2e/navigation.spec.ts` runs against Chromium through `playwright.config.ts`. The configuration starts an owned Next.js server on `127.0.0.1:3100` by default, captures screenshots only on failure, and retains traces for failed attempts. It never adopts a server from another worktree; set `PLAYWRIGHT_PORT` to an unused port when needed. It also verifies the explicit Next 16 smooth-scroll opt-in that preserves instant client-route scrolling while retaining smooth in-page scrolling. The browser suites fail on browser console errors, warnings, or page errors so React hydration diagnostics cannot be accepted as visual-only regressions. Their shared layout-settling helper waits for document load, fonts, and two animation frames by default because a valid media request can remain active while a rendered page is ready; geometry suites without long-lived media may explicitly add network-idle settling. The global font remains `display: swap` but does not emit a framework preload link; repeated cached-document browser tests otherwise produce a delayed unused-preload warning even though the font is available through the generated stylesheet.

The suite verifies the fixed bottom dock at 320, 390, and 768 CSS pixels; a viewport-bounded rail whose intentionally wider route/action content remains reachable by horizontal scrolling; canonical route links followed by social and theme actions in one moving rail; native overflow with hard clipping; viewport-bottom persistence while the document scrolls; upward unclipped theme placement; document-level overflow protection; initial idle drift; five-second interaction pause and resume from the current position; and the reduced-motion fallback. Static availability cases request reduced motion before navigation so automatic drift cannot race their viewport assertions; the separate regular-motion case installs Playwright's page clock before navigation and advances the actual idle and interaction timers, proving that the rail remains paused through 4.9 seconds and resumes at its five-second deadline without depending on host wall-clock scheduling. It also verifies dark and light device preference changes, manual My mode precedence, returning to System without a stored override, representative opaque backgrounds without gradients or glow in every manual palette, and the hydrated palette fade boundary: initial selection stays immediate, later eligible choices use one native transition, and reduced motion applies the next palette immediately without moving the open control. The reusable `tests/e2e/themePreference.ts` helper establishes all-palette coverage through the supported pre-hydration `portfolio-theme` preference or the hydrated chooser; it never mutates `html[data-theme]` directly. A desktop case protects the sticky top header, identity, route list, and compact-on-scroll behavior. Route-level cases verify that every registered resolved page receives the body entrance while the shared header and footer do not, that same-document client navigation mounts a fresh animated page root, and that reduced motion removes the entrance. Unit and style-contract coverage keeps route skeleton roots separate from the resolved page selector.

## Browser footer coverage

`tests/e2e/footer.spec.ts` records semantic footer mutations and painted animation frames. It verifies that every registered page and the not-found route remain compact through hydration and layout settlement, and that expanded state never carries into a client-side route transition. It also covers restored deep scroll positions and confirms that expansion occurs only after real downward wheel input reaches the reserved runway.

## Browser recommendation coverage

`tests/e2e/recommendations.spec.ts` samples every desktop recommendation slot across the full expand and collapse transition. It protects compact-height caching and each row's offset within the recommendation list during explicit collapse, outside-pointer dismissal, cross-card focus, and direct card switching, so unrelated shell movement cannot be mistaken for a grid regression. Responsive cases preserve natural document flow, while keyboard and reduced-motion cases protect accessible dismissal and transition fallbacks.

Pull-request runs use the checked-in recommendation templates and exercise every scenario. Deploy candidates use validated workbook content, so the suite selects expandable cards by capability, derives counts and row geometry at runtime, and skips only a scenario whose valid content shape cannot exhibit that contract. An empty recommendation collection must still render its configured empty state.

## Browser experience and research coverage

`tests/e2e/experience.spec.ts` protects the shared detail-level control on the Experience route: it verifies the overview-to-technical switch, 44 CSS-pixel mode-button targets, scoped live status, available accessible disclosures, Escape dismissal, compact desktop control placement, small-screen control flow, and reduced-motion transitions. It derives cards and disclosures from the rendered content and asserts the explicit empty state when the valid workbook has no experience entries. When an expandable card exists, its focused-scroll regression opens a disclosure, moves the pointer away without blurring the control, proves downward and upward scrolling, and confirms the expanded card retains its resting transform and shadow in My mode, Light, and Dark.

`tests/e2e/research.spec.ts` applies the same browser-level detail contracts, including 44 CSS-pixel mode-button and resource targets, to the Research redesign while checking its alternating visual/content rows. Pull-request runs generate the checked-in template content before the suite executes; main and develop pushes use the validated live workbook snapshot instead. The browser test discovers rendered cards and expandable disclosures rather than relying on template IDs, titles, prose, or a fixed project count. It asserts the explicit empty state when no projects render; otherwise it checks order labels, authored organization-logo accessibility, unavailable-resource semantics, desktop alternation, detail controls, narrow-screen stacking without horizontal overflow, reduced-motion fallbacks, and the same all-palette focused-scroll elevation contract when the rendered content provides an expandable project. Graphical-abstract coverage discovers every available preview, verifies intrinsic loading and uncropped containment, Enter and Space activation, Tab and Shift+Tab focus containment, close/Escape/backdrop dismissal, exact focus and scroll-lock restoration, rapid reopen, solid surfaces in every palette, `921/920` and `621/620` breakpoint behavior, and viewport fit at `1280x600` and `320x568`. The CytoCV video coverage verifies native controls with captions and fallbacks, header/action containment within the visual column, no document overflow, dialog focus and viewport fit, and solid modal surfaces across Navy, Light, and Dark at the same short desktop and mobile sizes. Deterministic component tests, rather than browser media playback, cover the `12.5`-second inline-to-modal and `46.25`-second modal-to-inline paused timeline handoffs and verify zero `play()` calls. Both commands run in Chromium after the shared browser installation step in CI.

## Deployment automation coverage

| Test | What it verifies |
| --- | --- |
| `scripts/packageScripts.test.mjs` | Node and tool pins, workflow triggers, single-snapshot conditions, branch isolation, permissions, exact-candidate no-op behavior, artifact transfer, target validation, develop-only heartbeat boundaries and race rejection, no-cache metadata, and Wrangler invocation |
| `scripts/checkDeployedContent.test.mjs` | Independent deployed content and commit comparison, missing or malformed manifest behavior, and post-deployment smoke requests with exact contact Function method rejection |
| Artifact tests inside `scripts/packageScripts.test.mjs` | Content-version creation, hidden file inclusion, manifest structure, commit binding, digest verification, and tamper rejection |
| `scripts/localAutomation.test.mjs` | Project discovery, environment copy safety, dependency-state hashing, stale content, and port selection |

The workflow contract tests inspect checked-in workflow text and execute the manifest helpers. They do not start a GitHub Actions runner or perform a Cloudflare upload.

## CI quality gates

The `verify` job installs locked dependencies before any conditional quality work.

### Pull requests: priority gate

Pull requests targeting `main` or `develop`:

1. Generate validated template content without workbook or Cloudflare credentials.
2. Run documentation integrity.
3. Run lint.
4. Run typecheck.
5. Run the priority Vitest contracts once.
6. Install Chromium once and run the portable priority browser suite: skeleton alignment and held-navigation transitions, navigation, footer, locally mocked contact, Recommendations, Experience, and Research flows.
7. Run the separate Linux-only skeleton visual comparison against the explicit template-content generated for the pull request.
8. Build with `build:generated`.
9. Stop without creating a deployment artifact.

### Push deployments: complete gate

Latest pushes to `main` or `develop`:

1. Validate the fixed Pages project and assigned domain.
2. Download and generate one strict workbook snapshot with at most one bounded transient retry.
3. Read and validate its SHA-256 content hash.
4. Run the complete Vitest suite once, including local D1 integration coverage.
5. Install Chromium once and run the complete browser suite once. This includes the direct skeleton alignment matrix, held-navigation semantics, and Linux zero-difference visual matrix.
6. Build with `build:generated` and the branch-specific public Turnstile key.
7. Create, verify, and upload the artifact manifest.
8. Enter the conditional deploy job, validate the selected D1 binding, and apply pending migrations.
9. Upload the Pages artifact only after migration succeeds.

### Scheduled and manual checks

Scheduled runs and non-forced manual runs perform the strict content work before deciding whether full verification is required. When both the candidate content hash and commit SHA match production, documentation integrity, lint, typecheck, tests, build, artifact upload, and deployment are skipped. A mismatch in either field selects the complete path, while forced manual runs always select it after strict content validation.

### Tier boundaries and diagnostics

The stable `verify` job selects `priority` for pull requests and `full` for every candidate that can produce a deployment artifact. The priority tier runs its portable browser selection once, then adds its Linux-only visual skeleton comparison as a separate step; the full tier runs `test:e2e:full` once and does not duplicate individual suites. Stale, unchanged scheduled, and non-forced manual candidates select no tier. `main` branch protection was independently verified on 2026-09-11 to require the current `verify` status check on pull requests; the workflow name and job name must remain stable. If a verify step fails, the job uploads any available `playwright-report/` and `test-results/` files as a seven-day `playwright-diagnostics-<run-id>-<attempt>` artifact. That failure-only artifact is distinct from, and never used as, the one-day `cloudflare-pages-build` deployment artifact.

## Post-deployment smoke tests

The deploy job runs `scripts/checkDeployedContent.mjs` against the stable assigned-domain alias. It verifies root HTML, exact content and commit metadata, exact artifact-manifest equality, and the exact HTTP `405` JSON contract for GET requests to both contact Functions.

It does not test:

- Every static route.
- The custom domain.
- Static security headers.
- Valid contact POST requests.
- Turnstile completion.
- D1 migration or reservation behavior.
- Mail-domain DNS results.
- Resend delivery.
- WAF behavior.
- Browser layout or interaction against the deployed URL. The pre-deployment Playwright suite runs against the exact source candidate through Next.js development mode.

See [Deployment](../operations/DEPLOYMENT.md#exact-automated-smoke-scope) and [Operations](../operations/OPERATIONS.md#post-deployment-verification) for the automated and manual boundaries.

## Running targeted tests

Run one file:

```bash
npx --no-install vitest run scripts/packageScripts.test.mjs
```

Run a related group:

```bash
npx --no-install vitest run functions/api/contact.test.ts functions/api/contact/verify.test.ts
```

Run the focused interaction layers:

```bash
npx playwright install chromium
npm run verify:priority
```

Run the complete release-candidate gate on Ubuntu 24.04, after installing Chromium:

```bash
npx playwright install chromium
npm run verify:full
```

Use `--reporter=dot` for compact output or the default reporter for individual test names.

## Adding or changing tests

When behavior changes:

1. Update the closest unit or component contract.
2. Add an integration test when data crosses a boundary such as workbook parsing, Function validation, or artifact transfer.
3. Add or update a Playwright case when responsive geometry, native browser scrolling, fixed positioning, or cross-component interaction is the contract under test.
4. Update workflow contract tests when a CI trigger, condition, permission, action, command, artifact, or environment variable changes.
5. Update documentation and its cross-links in the same change.
6. Run the targeted tests first, then `npm run verify:priority`; run `npm run verify:full` on Ubuntu 24.04 before deployment.

Avoid snapshot tests that hide semantic changes. Prefer explicit assertions for user-visible text, accessibility state, response contracts, validation errors, and integrity metadata.

## Current limitations

- No coverage percentage is generated or enforced.
- Real-browser coverage is intentionally limited to Chromium, including a local mocked contact journey; it does not exercise a live security provider, D1 binding, delivery service, or mailbox.
- No automated Lighthouse or performance threshold runs in CI.
- No automated browser accessibility scanner is configured.
- No Workers emulator integration test runs in CI.
- No automated live contact delivery test is performed.
- CI covers one Linux and Node-major configuration. Local `verify:full` on another operating system cannot replace the required Ubuntu 24.04 visual comparison.
- Remote D1 binding and migration state, external WAF, DNS, TLS, provider-secret, and branch-protection state are not testable from the repository.

These are explicit boundaries, not implied guarantees. Use the manual checks in [Operations](../operations/OPERATIONS.md) when the release risk reaches beyond the automated suite.
