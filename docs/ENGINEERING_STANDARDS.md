# Engineering standards

## Architecture

Keep portfolio routes static-first. Generate and validate content before build, then render it into the Next.js static export.

Runtime request handling is limited to the documented `/api/contact/verify` and `/api/contact` Cloudflare Pages Functions. Any new endpoint requires an explicit route allowlist, threat model, request limits, abuse controls, tests, and documentation.

## Content source

Checked-in CSV templates are the local authoring source. Production uses one anonymously downloadable XLSX workbook in strict remote mode. Components may contain layout labels and generic interface copy, but portfolio facts belong in content sources.

Generated JSON is an output. Regenerate it instead of editing it by hand. Do not fetch workbook or generated portfolio content from the browser.

## Components

Prefer server components for static content. Use client components only for interaction, route state, or browser APIs.

Keep components focused around one rendering job. Reuse glass primitives, content helpers, validators, formatting utilities, and interaction patterns before adding an abstraction.

## Styling

Use semantic tokens from `src/styles/tokens.css`. Preserve readable surfaces, visible focus, responsive reflow, and reduced-motion behavior in Navy, Light, and Dark.

Avoid heavy visual dependencies, full-screen blur, decorative animation systems, and low-contrast text.

## Security

Treat source content and contact requests as untrusted input. Preserve URL validation, exact origin checks, strict schemas, ticket validation, safe rendering, secret separation, and minimal logging.

Do not broaden `public/_routes.json`, client-visible environment variables, or Content Security Policy origins without review.

## Tests

Add tests for schema changes, selection rules, navigation, validation, interaction, Functions, automation, and user-visible rendering. Keep tests close to the behavior they protect when practical.

Run focused tests during development and `npm run verify` before delivery.

## Documentation

Update the deep guide and concise checklist that own changed behavior. Add new documents to `docs/README.md` and run `npm run docs:check`.

## Dependencies

Do not add production dependencies casually. A dependency must solve a concrete problem, preserve static export and supported Node.js behavior, and have a clear performance and maintenance justification.

See [Architecture](ARCHITECTURE.md), [Project structure](PROJECT_STRUCTURE.md), and [Maintenance](MAINTENANCE.md).
