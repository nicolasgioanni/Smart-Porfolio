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
- Text contrast remains strong on glass surfaces.
- Focus states remain visible.
- Reduced-motion users do not receive entrance, compression, or shimmer effects.
- Dialog focus, disclosure state, and form errors remain keyboard accessible.

## Code

- Static export assumptions still hold for portfolio pages.
- No runtime portfolio content fetch was added.
- Runtime request handling remains isolated to the documented `/api/contact/verify` and `/api/contact` Cloudflare Pages Functions.
- Client components are justified by interaction or browser APIs.

## Verification

- `npm run docs:check`
- `npm run generate:content`
- `npm run lint`
- `npm run typecheck`
- `npm run test:footer`
- `npm run test:e2e:footer`
- `npm run test`
- `npm run build`
- `npm run verify`

`npm run verify` includes documentation validation, lint, typecheck, the full test suite, and a normal build. The focused footer command remains a separate named CI gate, while CI also runs the Chromium footer regression after installing the browser.
