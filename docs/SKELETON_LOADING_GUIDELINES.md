# Skeleton loading guidelines

Skeletons are route-transition loading states. They reserve familiar geometry while Next.js resolves a statically generated route; they do not hide runtime content fetching.

## Static-first rule

Render generated static content whenever it is available. Do not fetch portfolio content in a client component to justify a skeleton.

The generated `enable_skeletons` setting controls whether route loading files return their skeleton component. No route adds an artificial delay.

## Components

Reusable primitives and compositions include:

- `SkeletonBlock`
- `SkeletonText`
- `SkeletonAvatar`
- `SkeletonButton`
- `SkeletonCard`
- `SkeletonHero`
- `SkeletonGrid`
- `PageSkeleton`
- `HomePageSkeleton`
- `ResearchPageSkeleton`
- `ProjectsPageSkeleton`
- `ExperiencePageSkeleton`
- `RecommendationsPageSkeleton`

## Route behavior

| Route group | Loading composition |
| --- | --- |
| Home | Profile shell, core content sections, three skills cards, and recommendation footprint. |
| Research | Page introduction, compact audience selector, and three alternating visualization-and-evidence modules. |
| Projects | Page introduction and card grid shaped like the evidence route. |
| Experience | Page introduction, compact audience selector, and logo-led role cards with evidence-row footprints. |
| Recommendations | Page introduction and recommendation cards. |
| Contact | Generic page skeleton while the static form shell resolves. |

Each route `loading.tsx` calls `shouldRenderSkeletons()` before returning the page-specific composition. The setting changes loading polish, not route content.

## Layout matching

- Use the same grids, radii, spacing tokens, and approximate block heights as the destination.
- Reserve image, heading, paragraph, metadata, and action geometry without copying real content.
- Update a skeleton when its route changes enough to create a noticeable layout jump.
- Keep responsive column changes aligned with the destination style sheet.

## Accessibility

Primitive blocks use `aria-hidden="true"`. `PageSkeleton` exposes a labelled region with `aria-busy="true"`. Skeletons contain no fake text, links, buttons, form controls, or announcements about content that may not exist.

The page-level busy region is sufficient. Do not add a live region for every placeholder.

## Reduced motion

Skeletons use static solid `--color-skeleton-surface` fills in every motion setting. Placeholder geometry remains visible so the loading state still reserves space; do not add shimmer, gradients, blur, or glow.

## Visual and transition regression coverage

`tests/e2e/skeletons.visual.spec.ts` loads the real shell only to read its resolved dark-theme HTML attributes, generated body font class, and absolute compiled stylesheet hrefs. It then fulfills a same-origin inert fixture document containing those attributes, stylesheets, and canonical `RouteSkeleton` markup rather than timing a navigation. The fixture has no application scripts or `nextjs-portal`, so neither React reconciliation nor the Next development toolbar can affect pixels. It asserts the stylesheet count and load state, `document.fonts.ready`, the loaded Space Grotesk face and computed font, static skeleton block styling, and stylesheet/font request or HTTP failures while the two-frame layout settle is in progress. Browser warnings, errors, and page errors are rejected before and after each screenshot. The source document's inline development style only defines Next toolbar fonts and is intentionally not copied. It covers every registered route at desktop and mobile widths plus the selected `980px` boundaries. Baselines are Linux-only, live under `tests/e2e/__screenshots__/linux/`, and are captured manually on Ubuntu 24.04 through the read-only baseline workflow. Review every PNG update deliberately.

`tests/e2e/skeletons.transition.spec.ts` disables viewport prefetch before hydration, clicks real rendered Next links, and holds a target non-prefetch RSC request for every non-Home route. A route with no source link or no held navigation request fails; it must never pass by skipping. With these synchronous Server Component routes, holding the whole Flight response keeps the source body in place rather than mounting a streamable `loading.tsx` fallback. This validates App Router request and navigation ownership in development. The published site is a static export, where Next 16 does not support loading UI streaming, so canonical static markup, busy semantics, and no-animation contracts remain the deployed-artifact geometry protection.

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

See [Design system](DESIGN_SYSTEM.md), [Accessibility](ACCESSIBILITY.md), and [Performance budget](PERFORMANCE_BUDGET.md).
