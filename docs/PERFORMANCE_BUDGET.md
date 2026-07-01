# Performance Budget

## Runtime strategy

The core performance strategy is static rendering, small JavaScript, optimized assets, and no backend. The site should render real content from static HTML whenever possible.

## Avoid runtime content fetching

Do not fetch Google Sheets content from the browser or from serverless functions at request time. Fetch content during the build and render from generated JSON.

## Keep first-load JavaScript small

Prefer Server Components for static content. Avoid large client-only components unless they add clear value.

## Animation budget

Keep animation CSS-first. Do not add animation-heavy libraries in v1. Avoid Framer Motion, Lottie, Three.js, particles, video backgrounds, and AI chatbot widgets.

## Icon and visual dependencies

Avoid large icon packs. Use text labels, small inline SVGs, or a tiny local icon strategy if icons are needed later.

## Images

Optimize images manually before placing them in `public`. Prefer appropriately sized PNG, JPG, WebP, or AVIF assets. Avoid huge source images.

## Layout stability

Reserve space for images and cards to avoid layout shift. Skeletons should match final layout dimensions when used.

## Glass effects

Limit large `backdrop-filter` surfaces. Use glass styling on bounded cards or navigation surfaces, not full-screen layers.

## Skeleton loading

Skeletons support route transitions and deferred UI. They do not replace the static content strategy. Real static content should render without waiting for client-side fetches.
