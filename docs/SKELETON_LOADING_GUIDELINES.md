# Skeleton Loading Guidelines

## Purpose

Skeletons are perceived loading states. They make route transitions and deferred UI feel stable while real static content is loading.

## Static-first rule

The site should render generated static content whenever it is available. Skeletons must not hide real content or require client-side fetching.

The `enable_skeletons` setting controls whether route loading files render skeleton components. Keep skeletons available for polish, but do not rely on them to hide slow runtime data fetching.

## Component list

Reusable skeleton components:

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
- `ResumePageSkeleton`

## Page skeleton behavior

- Home skeleton mirrors the hero, skills, and featured section grid.
- Research and Projects skeletons mirror card grids.
- Experience skeleton mirrors the timeline.
- Resume skeleton mirrors the profile panel and resume sections.

## Route loading behavior

App Router `loading.tsx` files render the page-specific skeletons. No artificial delay is added just to show them.

## Reduced-motion behavior

Skeleton shimmer is disabled when `prefers-reduced-motion: reduce` is active. Motion classes also become static under reduced motion.

## Layout shift prevention

Skeletons use the same grid, radius, spacing, and approximate heights as final glass layouts. They should reserve similar space before content appears.

## Accessibility

Primitive skeleton blocks use `aria-hidden`. Page skeletons expose a loading region with `aria-busy=true`. Skeletons must not contain real content text or fake interactive controls.

## When to use skeletons

Use skeletons for route-level loading, Suspense boundaries, deferred components, image placeholders, and future optional client refreshes.

## When not to use skeletons

Do not use skeletons for static content that is already available. Do not fetch generated content on the client just to justify loading states. Do not use skeletons as a substitute for performance.
