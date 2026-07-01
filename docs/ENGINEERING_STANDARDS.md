# Engineering Standards

## Architecture

Keep the portfolio static-first. Content should be fetched at build time, normalized into generated JSON, and rendered into static pages.

Do not add a backend, database, authentication layer, dashboard, serverless function, or runtime spreadsheet request unless the product direction changes and the static-export tradeoff is documented first.

## Content source

Spreadsheet-compatible CSV files are the source of truth for portfolio facts. Components may contain layout labels and generic UI copy, but they should not hard-code Nicolas-specific experience, project, research, recommendation, license, or repository facts.

Generated JSON is a build artifact. Regenerate it from templates or remote CSV sources instead of editing it by hand.

## Components

Prefer server components for static content. Use client components only for interaction, route state, or browser APIs.

Keep components focused around one rendering job. Reuse the existing glass primitives, content helpers, validators, and formatting utilities before adding new abstractions.

## Styling

Use the shared CSS tokens in `src/styles/tokens.css`. Keep the very dark navy base, restrained glass surfaces, high-contrast text, and quiet motion.

Avoid heavy visual dependencies, decorative animation systems, generic landing-page effects, and low-contrast text.

## Tests

Add tests for content schema changes, navigation rules, validation behavior, and user-visible rendering changes. Keep tests close to the behavior they protect.

## Dependencies

Do not add production dependencies casually. A dependency should solve a real problem, preserve static export, and have a clear performance and maintenance justification.
