# Performance Budget

## Runtime Strategy

The portfolio is a static export app with one isolated Cloudflare Pages Function for contact delivery. The site should render portfolio content from static HTML and generated data without runtime sheet requests.

Keep `output: "export"` unless the hosting and product requirements change.

## Content Fetching

Do not fetch portfolio content from the browser or from route handlers at request time. Fetch content during generation/build and render from generated files.

Security tests should continue proving there are no Next.js API routes, route handlers, server actions, or runtime content fetches, and that Pages Function routing invokes only `/api/contact`.

## JavaScript Budget

Prefer Server Components for static content. Client components should be isolated and purposeful.

Current intentional client features:

- Mobile navigation state.
- Scroll reveal/compress motion.
- Footer theme switcher with localStorage persistence.
- Contact wizard and explicit Turnstile integration.

Avoid large client-only components unless they provide clear portfolio value.

## Animation Budget

Keep animation CSS-first. Do not add animation-heavy libraries in the core portfolio experience.

Motion rules:

- Animate opacity and transform only.
- Do not blur text.
- Do not animate layout properties.
- Respect reduced motion.

## Assets

Optimize images before placing them in `public`. Prefer appropriately sized PNG, JPG, WebP, or AVIF assets. Avoid oversized source images.

Reserve dimensions for images, skeletons, grids, cards, and controls to avoid layout shift.

Avoid full-page wallpaper backgrounds. The shared page background should remain CSS/token-driven so Home visual polish does not add a large render-blocking image request.

## Glass Effects

Limit large `backdrop-filter` surfaces. Glass should be bounded to cards, navigation, footer, and section panels. The `enable_glass_effects` setting must keep the interface readable when disabled.

## Skeleton Loading

Skeletons support route transitions and deferred UI. They do not replace the static content strategy.

Skeletons should:

- Match final layout dimensions.
- Contain no real content text.
- Disable shimmer under reduced motion.

## Build Metrics

After major visual-system changes, record the Next build route table and first-load JavaScript values from `npm run build`. Watch for unexpected growth from client components, fonts, images, or libraries.
