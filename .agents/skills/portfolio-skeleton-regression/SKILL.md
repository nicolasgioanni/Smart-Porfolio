---
name: portfolio-skeleton-regression
description: Maintain deterministic route-skeleton alignment, visual, and transition regressions, including reviewed Linux baselines and static-export semantics.
---

# Portfolio skeleton regression

Use this skill when changing a route skeleton, shared loading primitive or CSS, route coverage, visual baseline workflow, or skeleton browser gate.

## Preserve loading geometry

Start with `RouteSkeleton`, its route composition, `RouteHeaderSkeleton`, existing profile data, and `skeletons.css`. Keep skeletons static and solid, permitting only intentional control-shaped geometry. Preserve the labelled busy region and hidden primitive blocks. Do not add shimmer, gradients, blur, glow, fake prose, or real interactive controls.

Treat `src/lib/content/routeHeaderContent.ts` as the exhaustive source for resolved and loading page headers. `RouteHeaderSkeleton` lays out those same strings as transparent, `aria-hidden`, noninteractive ink over a flat skeleton fill; this is the only copy-shaped exception. Keep `box-decoration-break: clone` and the shared typography so the browser derives every responsive line fragment. Do not replace that mechanism with viewport JavaScript or hand-maintained route-width tables.

Experience is the only generated header override. Pass validated content through `resolveRouteHeaderContent()` so the resolved page and loader use the same generated summary or the same canonical fallback. Add any future override to that resolver and its content-contract and browser-alignment tests rather than reading data independently in a skeleton.

## Preserve the visual harness

`tests/e2e/standaloneSkeletonDocument.ts` is the shared document and asset-readiness contract for `skeleton-alignment.spec.ts` and `skeletons.visual.spec.ts`. The live page may supply resolved HTML and body attributes, the generated body font class, and absolute compiled stylesheet URLs; each suite fulfills a separate same-origin fixture route with canonical server-rendered skeleton markup.

Keep that fixture inert: no application scripts, development portal, or mutation of React-owned DOM. Do not use `replaceChildren`, remove mounted nodes, or inject a fixture into the hydrated application tree. Preserve stylesheet and font readiness checks, browser-diagnostic rejection, two-frame layout settling, static-animation assertions, and zero-difference screenshots.

Research visual snapshots receive controlled canonical local-template detail items only through `tests/e2e/renderRouteSkeleton.tsx`. Keep that injection isolated to the visual renderer. Normal loading boundaries and component or alignment coverage must resolve generated-workbook data so their resource geometry follows validated content.

## Review Linux baselines

Baselines are Linux-only and currently contain 23 images under `tests/e2e/__screenshots__/linux/`. Capture them only with the manual Ubuntu 24.04 workflow for the exact selected revision. Review every uploaded image before committing the approved artifact bytes. Do not create Windows or macOS snapshots, weaken the zero-difference threshold, or accept an unreviewed update.

If route coverage or the viewport matrix changes intentionally, update the visual specification, baseline-workflow count guard, workflow tests, documentation, and reviewed images together.

## Keep CI and transition semantics accurate

The full release tier of the stable `verify` job runs on Ubuntu 24.04, installs Chromium once, and runs `npm run test:e2e:full`. Its complete browser selection must retain all three `npm run test:e2e:skeletons` parts: direct resolved-versus-loader alignment, held-navigation transition semantics, and the Linux visual matrix. The pull-request priority tier may run alignment only. Preserve the failure-only diagnostics artifact as separate from the deployable static artifact.

The transition suite suppresses viewport prefetch and holds the first non-prefetch RSC request. With synchronous route rendering, holding that response preserves the source body rather than mounting a streamable fallback. Static export does not provide loading streaming; do not change this into a fallback-visibility claim.

Run `npm run test:skeletons`, `npm run test:skeleton-guidance`, `npm run test:skeleton-baseline-workflow`, and `npm run test:e2e:skeletons:alignment` for relevant changes. Run visual comparison only on Linux; a non-Linux visual run must fail rather than emit a platform-specific baseline.
