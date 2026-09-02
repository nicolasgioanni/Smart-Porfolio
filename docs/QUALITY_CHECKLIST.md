# Quality checklist

Run this checklist before shipping meaningful changes.

## Content

- Generated JSON was created from the intended local or strict remote source with `npm run generate:content`.
- Local template content is not accidentally being used for a deployable production candidate.
- New fields are documented in the schema and mapping docs.
- Recommendation text remains in CSV content, not React components.

## UI

- Home gives a complete high-level overview.
- Detail pages provide deeper evidence instead of duplicating the Home page.
- Navigation matches available content and settings.
- Empty states are intentional and accessible.
- Hero and footer copy present the person and work, not the implementation.

## Accessibility

- Links have clear labels.
- External new-tab links use safe `rel` attributes.
- Text contrast remains strong across the Light, My mode, and Dark surface layers.
- Light retains distinct off-white, light-gray, and blue-gray tiers; Dark retains distinct charcoal and slate tiers.
- UI styles contain no decorative gradients, glow shadows, backdrop blur, page overlays, or CSS mask fades.
- Dual-layer focus states remain visible on each palette's canvas, panels, cards, and controls.
- System resolves device light and dark preferences, follows live changes, and never marks an effective palette as a manual selection.
- Reduced-motion users do not receive entrance or compression effects; skeletons remain static in every motion setting.
- Dialog focus, disclosure state, and form errors remain keyboard accessible.

## Code

- Static export assumptions still hold for portfolio pages.
- No runtime portfolio content fetch was added.
- Runtime request handling remains isolated to the documented `/api/contact/verify` and `/api/contact` Cloudflare Pages Functions.
- Client components are justified by interaction or browser APIs.
- Theme listeners are scoped to System behavior, respect manual override precedence, synchronize cleared storage, and clean up on unmount.
- Skeleton geometry changes preserve static loading semantics, the inert visual fixture, and the static-export transition contract. Research visual baselines use only the isolated canonical local-template detail fixture; normal loading and alignment remain generated-workbook driven.

## Verification

- `npm run docs:check`
- `npm run generate:content`
- `npm run lint`
- `npm run typecheck`
- `npm run test:footer`
- `npm run test:navigation`
- `npm run test:skeletons`
- `npm run test:skeleton-guidance`
- `npm run test:skeleton-baseline-workflow`
- `npm run test:e2e:skeletons` on Ubuntu 24.04 when skeleton rendering, route coverage, or browser workflow changes
- `npm run test:e2e:navigation`
- `npm run test:e2e:footer`
- `npm run test:e2e:recommendations`
- `npm run test`
- `npm run build`
- `npm run verify`

`npm run verify` includes documentation validation, lint, typecheck, the full test suite, and a normal build. The focused footer and navigation commands remain separate named CI gates, while CI also runs the Chromium skeleton, navigation, footer, recommendation, experience, and research regressions after one browser installation.
