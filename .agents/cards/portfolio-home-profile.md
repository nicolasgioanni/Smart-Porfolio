# Home and profile

Owns [Home composition](../../src/components/portfolio/home/HomeOverview.tsx), [profile motion](../../src/components/portfolio/profile/AnimatedRole.tsx), and [Home selection](../../src/lib/content/selectHomeContent.ts). Keep content selection below the component layer and reuse [visible-content fallback](../../src/lib/content/selectVisibleContent.ts).

Read [Home mapping](../../docs/content/CONTENT_MAPPING.md#shared-home-selection) and [content selection](../../docs/architecture/ARCHITECTURE.md#content-selection-and-ui-mapping). Validate with [portfolio coverage](../../src/components/portfolio/portfolio.test.tsx): `npm run test -- src/components/portfolio/portfolio.test.tsx`.

Run `npm run test:priority` when changed selection can affect route cards, loading footprints, or generated content.
