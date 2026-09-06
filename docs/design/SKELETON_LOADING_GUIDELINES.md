# Skeleton loading guidelines

Skeletons are route-transition loading states. They reserve familiar geometry while Next.js resolves a statically generated route; they do not hide runtime content fetching.

## Static-first rule

Render generated static content whenever it is available. Do not fetch portfolio content in a client component to justify a skeleton.

The generated `enable_skeletons` setting controls whether route loading files return their skeleton component. No route adds an artificial delay.

## Components

Reusable primitives and compositions include:

- `SkeletonBlock`
- `SkeletonText`
- `SkeletonButton`
- `RouteHeaderSkeleton`
- `RouteSkeleton`
- `PageSkeleton`
- `HomePageSkeleton`
- `ResearchPageSkeleton`
- `ProjectsPageSkeleton`
- `ExperiencePageSkeleton`
- `RecommendationsPageSkeleton`
- `ResumePageSkeleton`
- `ContactPageSkeleton`
- `LegalPageSkeleton`

## Route behavior

| Route group | Loading composition |
| --- | --- |
| Home | Profile shell, core content sections, three skills cards, and recommendation footprint. |
| Research | Page introduction, compact audience selector, and three alternating visualization-and-evidence modules. |
| Projects | Page introduction and card grid shaped like the evidence route. |
| Experience | Page introduction, compact audience selector, and logo-led role cards with evidence-row footprints. |
| Recommendations | Page introduction and recommendation cards. |
| Resume | Page introduction and private-resume request panel. |
| Contact | Page introduction and form-shell footprint while the static contact route resolves. |
| Terms, Privacy, Security | Canonical legal header and route-specific section footprints. |

Each route `loading.tsx` calls `shouldRenderSkeletons()` before returning the page-specific composition. The setting changes loading polish, not route content.

## Layout matching

- Use the same grids, radii, spacing tokens, and approximate block heights as the destination.
- Reserve body image, paragraph, metadata, and action geometry without inventing or imitating prose. Canonical page-header ink is the intentional exception described below.
- Update a skeleton when its route changes enough to create a noticeable layout jump.
- Keep responsive column changes aligned with the destination style sheet.

## Canonical header geometry

`src/lib/content/routeHeaderContent.ts` is an exhaustive registry for every registered route. Resolved pages and `RouteHeaderSkeleton` reuse its eyebrow, title, description, placement, and accessory contract. The Home entry is intentionally `null` because Home has a different hero composition.

`RouteHeaderSkeleton` renders the exact canonical strings inside an `aria-hidden` header. The text color is transparent while each browser-generated line fragment receives one flat `--color-skeleton-surface` fill through `box-decoration-break: clone`. Pointer selection and interaction are disabled. This lets the browser derive the real typography, wrapping, and line boxes at every width without viewport JavaScript, fake prose, or per-route width tables.

Experience is the only generated page-header override. Both its resolved route and loader pass validated `getPortfolioContent()` data through `resolveRouteHeaderContent()` so they share the generated `profile.experienceSummary` or the registry fallback exactly. Do not add another generated override outside that resolver.

Research card footprint counts come from validated selected detail items and the same `getResearchVisibleResources()` resolver used by resolved cards. Only the isolated visual renderer may inject controlled canonical local-template Research items; normal loading boundaries and direct alignment remain generated-workbook driven.

Research graphical-abstract frames preserve the resolved route's local 16px top-aligned inset, full available visual-column width, rounded clipping, and 16:9 containment geometry. Keep the placeholders noninteractive while updating this frame.

## Accessibility

Primitive blocks use `aria-hidden="true"`. `PageSkeleton` exposes a labelled region with `aria-busy="true"`. The canonical header strings exist only inside an `aria-hidden` ancestor and are transparent, non-selectable, and noninteractive, so they do not become headings, copy, focus targets, or announcements in the accessibility tree. Body skeletons contain no fake text, links, buttons, or form controls.

The page-level busy region is sufficient. Do not add a live region for every placeholder.

## Reduced motion

Skeletons use static solid `--color-skeleton-surface` fills in every motion setting. Placeholder geometry remains visible so the loading state still reserves space; do not add shimmer, gradients, blur, or glow.

## Visual and transition regression coverage

`tests/e2e/standaloneSkeletonDocument.ts` provides the shared same-origin inert document and asset-readiness contract for the alignment and visual suites. It carries only the real shell's resolved HTML/body attributes, generated body font class, and absolute compiled stylesheet hrefs. Fixtures contain canonical server-rendered `RouteSkeleton` markup, no application scripts, and no `nextjs-portal`, so neither React reconciliation nor the Next development toolbar can affect measurements or pixels.

`tests/e2e/skeleton-alignment.spec.ts` compares resolved page-header Range line boxes with canonical loader ink relative to the persistent `site-main` shell. It covers compact, phone, tablet, transition, and fluid desktop widths; representative wrap boundaries; the generated Experience summary; Home overflow; Projects and Research detail footprints; Light and Dark; and reduced motion. Run it locally with `npm run test:e2e:skeletons:alignment`. Keep its existing font-metric tolerance strict.

`tests/e2e/skeletons.visual.spec.ts` additionally asserts dark-theme resolution, stylesheet count and load state, `document.fonts.ready`, the loaded Space Grotesk face and computed font, static skeleton block styling, and stylesheet/font request or HTTP failures while the two-frame layout settle is in progress. Browser warnings, errors, and page errors are rejected before and after each screenshot. The source document's inline development style only defines Next toolbar fonts and is intentionally not copied. It covers every registered route at desktop and mobile widths plus the selected `980px` boundaries. Baselines are Linux-only, live under `tests/e2e/__screenshots__/linux/`, and are captured manually on Ubuntu 24.04 through the read-only baseline workflow. Review every PNG update deliberately.

Research visual snapshots inject controlled canonical local-template detail items only through the isolated renderer for deterministic baselines. Normal Research loading boundaries and component or alignment coverage remain generated-workbook driven.

The Research video loader reserves three static 44px toolbar blocks inside the video frame to match the transcript, download, and enlargement footprint. They remain `aria-hidden` placeholders without links, buttons, tooltips, or playback behavior.

`tests/e2e/skeletons.transition.spec.ts` disables viewport prefetch before hydration, clicks real rendered Next links, and holds a target non-prefetch RSC request for every non-Home route. A route with no source link or no held navigation request fails; it must never pass by skipping. With these synchronous Server Component routes, holding the whole Flight response keeps the source body in place rather than mounting a streamable `loading.tsx` fallback. This validates App Router request and navigation ownership in development. The published site is a static export, where Next 16 does not support loading UI streaming, so canonical static markup, busy semantics, and no-animation contracts remain the deployed-artifact geometry protection.

The portable `npm run test:e2e:priority` command runs direct alignment and held-navigation transition coverage. Pull-request CI adds `npm run test:e2e:skeletons:visual` as a separate Ubuntu 24.04 step; local Windows priority runs must not compare Linux baselines. The required full-tier Ubuntu command, `npm run test:e2e:skeletons`, runs the direct alignment, held-navigation transition, and Linux zero-difference visual specifications together.

## Baseline maintenance

Use the [repository skeleton regression skill](../../.agents/skills/portfolio-skeleton-regression/SKILL.md) before changing skeleton geometry, route coverage, or the browser workflow. Capture baseline candidates only through the manual Ubuntu 24.04 workflow for the exact selected revision, review every artifact image, then commit the approved Linux bytes. Do not create Windows or macOS snapshots, relax the zero-difference comparison, or mutate hydrated application DOM to construct a fixture. If the route or viewport matrix changes intentionally, update the visual specification, the baseline workflow count guard, its tests, and the reviewed images together.

## Use skeletons for

- App Router route transitions;
- a real Suspense boundary with deferred UI;
- image placeholders when final geometry is known;
- future optional refresh behavior that does not replace initial static delivery.

## Do not use skeletons for

- static content already present in route output;
- hiding a slow browser request for portfolio data;
- replacing error or honest empty states;
- simulating interactive controls;
- forcing a loading animation to appear for a minimum time.

See [Design system](DESIGN_SYSTEM.md), [Accessibility](ACCESSIBILITY.md), and [Performance budget](../quality/PERFORMANCE_BUDGET.md).
