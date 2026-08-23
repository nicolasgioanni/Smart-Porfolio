# Architecture

## Static-first portfolio

This project is a static-first smart portfolio. Next.js App Router pages are rendered at build time with `output: export`, which produces static files that can be served from a CDN.

## Google Sheets as a lightweight CMS

Google Sheets is used only as a public-safe editing surface. Each sheet tab is exported as CSV. The site does not use Google API credentials and does not store secrets.

## Build-time content fetching

The content generation script reads CSV URLs from environment variables. If a URL is missing, local template CSV files are used unless strict production mode is enabled.

The script parses CSV, validates required fields, normalizes values, and writes `src/content/generated/portfolio.generated.json`.

## Generated JSON and typed UI mapping

The UI imports generated JSON through typed helpers. Pages receive normalized profile, links, research, projects, experience, recommendations, education, skills, resume, and site settings.

This keeps display components simple and avoids spreadsheet parsing inside React components.

## No backend

There is no runtime server requirement for core portfolio pages. Static export generates the HTML and client assets needed for deployment.

## No database

The spreadsheet is the editing source, and generated JSON is the build artifact. A database would add operational cost and complexity without improving the v1 portfolio workflow.

## No authentication

The portfolio only renders public-safe information. Authentication would be unnecessary for readers and incompatible with the static-first v1 goal.

## No runtime Google Sheets requests

The deployed site does not fetch spreadsheet data in the browser. This avoids loading delays, API availability issues, quota concerns, and exposure of implementation details.

## Vercel Hobby/free fit

The build runs once per deployment. The deployed output is static and does not need serverless functions, databases, background jobs, or paid runtime infrastructure.

## Home and detail layers

The Home page is the summary layer. It presents the profile overview, experience, education, research, three projects, six spreadsheet-driven Skills category cards, and three Recommendations in that order. Compact top-right `View` buttons connect the Experience, Research, Projects, and Recommendations sections to their focused routes. A focused client coordinator hydrates the server-rendered Home recommendation grid to balance three/four-line previews per visual row, preserve the outer panel's collapsed height, and publish normal-flow space for a protruding expanded card; the surrounding page remains static-first. When recommendations are enabled without published rows, Home and the Recommendations route may show an honest empty state instead of inventing content.

The detail pages are evidence layers. Research, projects, experience, recommendations, and resume pages show longer explanations, bullets, context, impact details, recommendation quotes, and supporting links.

The footer stays in normal document flow after every route and server-renders as a compact copyright row. Its client wrapper reserves a scroll runway beneath the compact dock that is large enough for the expanded details. The compact row therefore appears before the page reaches its hard bottom; continued native scrolling into the reserved runway crosses a stable activation boundary and expands the details into that already-reserved footprint. The same below-to-visible boundary crossing expands the footer when content above it contracts, even if the browser clamps the scroll position upward while the page becomes shorter. Scrolling upward across the return boundary collapses the details and restores the runway without changing the document's overall length. A small hysteresis window prevents oscillation near the boundary. An explicit `Details`/`Collapse` disclosure remains the device-independent fallback; manual collapse suppresses automatic reopening until the footer interaction area is exited and later re-entered, and focused details are never hidden. Route changes reset the disclosure before position is evaluated again. `/terms`, `/privacy`, and `/security` remain footer-only static routes.
