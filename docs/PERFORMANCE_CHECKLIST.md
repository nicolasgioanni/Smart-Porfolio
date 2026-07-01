# Performance Checklist

## Rendering

- Core pages render from static HTML and generated JSON.
- No runtime spreadsheet request is required for initial content.
- Static export remains enabled in `next.config.mjs`.
- Images remain static-export safe.

## JavaScript

- Prefer server components for non-interactive content.
- Keep client components limited to navigation state, motion, and browser-only behavior.
- Do not add heavy animation, icon, visualization, or component libraries without approval.

## CSS and motion

- Animate transform and opacity only.
- Do not blur readable content during scroll.
- Keep `backdrop-filter` on bounded surfaces, not full-screen layers.
- Keep `will-change` limited and purposeful.
- Respect `prefers-reduced-motion`.

## Assets

- Place public assets under `public`.
- Use appropriately sized images.
- Reserve image dimensions to avoid layout shift.
- Replace placeholder assets before production launch.

## Verification

- Run a production build before judging performance.
- Inspect static export output when practical.
- Compare first-load JavaScript after dependency or client-component changes.
