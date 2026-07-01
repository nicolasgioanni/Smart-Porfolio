# Quality Checklist

Run this checklist before shipping meaningful changes.

## Content

- Generated JSON was created from CSV sources with `npm run generate:content`.
- Demo content is not accidentally being used for production.
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

## Code

- Static export assumptions still hold.
- No runtime portfolio content fetch was added.
- No backend-only feature was introduced.
- Client components are justified by interaction or browser APIs.

## Verification

- `npm run lint`
- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run verify`
