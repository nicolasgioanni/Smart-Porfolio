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
| Research and Projects | Page introduction and card grids shaped like the evidence routes. |
| Experience | Page introduction, audience selector, and logo-led role cards with evidence-row footprints. |
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

`prefers-reduced-motion: reduce` disables shimmer. Placeholder geometry remains visible so the loading state still reserves space.

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
