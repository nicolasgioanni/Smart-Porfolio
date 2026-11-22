# Routes and metadata

Owns static route composition and crawler metadata. Start with [the route registry](../../src/lib/routing/siteRoutes.ts), [application layout](../../src/app/layout.tsx), and [metadata helper](../../src/lib/content/createPageMetadata.ts). Cover every `src/app/` page, loading boundary, `robots.txt`, and `sitemap.xml` through this card.

Read [documented application routes](../../docs/architecture/PROJECT_STRUCTURE.md#documented-application-routes) and [static-first application](../../docs/architecture/ARCHITECTURE.md#static-first-application). Reuse the registry and route-header resolver; route code composes content and components, never runtime content fetching.

Validate with [route tests](../../src/lib/routing/siteRoutes.test.ts) and [robots tests](../../src/app/robots.test.ts): `npm run test -- src/lib/routing/siteRoutes.test.ts src/app/robots.test.ts`. Run `npm run build` when output or metadata conventions change; use the skeleton card when route loading geometry or coverage changes.
