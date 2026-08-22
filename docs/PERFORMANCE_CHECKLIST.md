# Performance checklist

## Rendering

- Core pages render from static HTML and generated JSON.
- No runtime spreadsheet request is required for initial content.
- Static export remains enabled in `next.config.mjs`.
- Images remain static-export safe.

## JavaScript

- Prefer server components for non-interactive content.
- Keep client components limited to focused interaction, route state, and browser APIs.
- Do not add heavy animation, icon, visualization, or component libraries without approval.

## CSS and motion

- Prefer transform and opacity; keep documented layout transitions bounded.
- Do not blur readable content during scroll.
- Keep `backdrop-filter` on bounded surfaces, not full-screen layers.
- Keep `will-change` limited and purposeful.
- Respect `prefers-reduced-motion`.

## Assets

- Place public assets under `public`.
- Use appropriately sized images.
- Reserve image dimensions to avoid layout shift.
- Confirm every deployed asset is intentional and appropriately sized.
- Keep shared page backgrounds CSS/token-driven instead of full-page wallpaper images.

## Verification

- Run a production build before judging performance.
- Inspect static export output when practical.
- Compare first-load JavaScript after dependency or client-component changes.
- Record the route, tool, environment, and date for any performance claim.
- Run `npm run docs:check` when performance guidance changes.
