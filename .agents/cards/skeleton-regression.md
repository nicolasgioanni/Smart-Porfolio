# Skeleton regression

Owns [route skeleton composition](../../src/components/loading/RouteSkeleton.tsx), [header geometry](../../src/components/loading/RouteHeaderSkeleton.tsx), [alignment](../../tests/e2e/skeleton-alignment.spec.ts), [held-navigation transitions](../../tests/e2e/skeletons.transition.spec.ts), and [Linux visual comparison](../../tests/e2e/skeletons.visual.spec.ts). Reuse [route-header content](../../src/lib/content/routeHeaderContent.ts) and the [standalone document](../../tests/e2e/standaloneSkeletonDocument.ts); do not construct a fixture by mutating hydrated DOM.

Read [visual and transition coverage](../../docs/design/SKELETON_LOADING_GUIDELINES.md#visual-and-transition-regression-coverage), [baseline maintenance](../../docs/design/SKELETON_LOADING_GUIDELINES.md#baseline-maintenance), and the mandatory [skeleton skill](../skills/portfolio-skeleton-regression/SKILL.md). Validate with [skeleton contracts](../../src/components/loading/skeleton.test.tsx) and `npm run test:skeletons`.

Run `npm run test:e2e:skeletons` for the complete alignment, transition, and visual aggregate. Its visual comparison is Linux-only and zero-difference. Broaden to the Linux gate when changing geometry, route coverage, visual baselines, transitions, or the browser gate.
