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

## Minimal runtime boundary

Core portfolio pages do not require a runtime Next.js server. Static export generates their HTML and client assets for Cloudflare Pages. The one runtime boundary is the Cloudflare Pages Function at `/api/contact`; `public/_routes.json` limits Function invocation to that exact path so ordinary page and asset requests remain static.

## Contact submission flow

The footer-only `/contact` page is statically exported and hydrates a focused client form. A visitor completes Turnstile first, supplies a required name, email, and message with an optional phone number, reviews the request, accepts all three acknowledgements, and submits JSON to the same-origin `/api/contact` endpoint. Direct email remains available as the fallback channel.

The browser-side checks are usability controls, not the trust boundary. The Pages Function rejects unsupported methods and media types, enforces origin, body-size, field, acknowledgement, timing, and honeypot rules, and sends generic failure responses. It then calls Cloudflare Turnstile Siteverify with the server-only secret and accepts a token only when verification succeeds and both the `portfolio_contact` action and configured hostname match.

After verification, the Function uses Resend to deliver the request to the server-only `CONTACT_RECIPIENT_EMAIL` and send a confirmation to the visitor. Resend and Turnstile credentials never enter browser code, generated content, or the static export. The form does not use a database; delivery is email-only.

## No database

The spreadsheet is the editing source, and generated JSON is the build artifact. A database would add operational cost and complexity without improving the v1 portfolio workflow.

## No authentication

The portfolio only renders public-safe information. Authentication would be unnecessary for readers and incompatible with the static-first v1 goal.

## No runtime Google Sheets requests

The deployed site does not fetch spreadsheet data in the browser. This avoids loading delays, API availability issues, quota concerns, and exposure of implementation details.

## Cloudflare Pages fit

The content build runs once per deployment and publishes `out/` as static assets. Cloudflare compiles the repository-level `functions/` directory separately, while `public/_routes.json` keeps the invocation surface limited to `/api/contact`. No database, authentication service, background job, or runtime content API is required.

## Home and detail layers

The Home page is the summary layer. It presents the profile overview, experience, education, research, three projects, three spreadsheet-driven Skills category cards, and three Recommendations in that order. Each Skills card contains four badges; complete popup fields hydrate a shared accessible dialog that presents proficiency and evidence of use while preserving static rendering for legacy rows. Compact top-right `View` buttons connect the Experience, Research, Projects, and Recommendations sections to their focused routes. A focused client coordinator hydrates the server-rendered Home recommendation grid to balance three/four-line previews per visual row, preserve the outer panel's collapsed height, and publish normal-flow space for a protruding expanded card; the surrounding page remains static-first. When recommendations are enabled without published rows, Home and the Recommendations route may show an honest empty state instead of inventing content.

The detail pages are evidence layers. Research, projects, experience, and recommendations show longer explanations, bullets, context, impact details, recommendation quotes, and supporting links. The Resume route intentionally publishes only an access-request statement; a private resume file is not part of the static export.

The footer stays in normal document flow after every route and server-renders as a compact copyright row. Its client wrapper reserves a scroll runway beneath the compact dock that is large enough for the expanded details. The compact row therefore appears before the page reaches its hard bottom; continued native scrolling into the reserved runway crosses a stable activation boundary and expands the details into that already-reserved footprint. The same below-to-visible boundary crossing expands the footer when content above it contracts, even if the browser clamps the scroll position upward while the page becomes shorter. Scrolling upward across the return boundary collapses the details and restores the runway without changing the document's overall length. A small hysteresis window prevents oscillation near the boundary. An explicit `Details`/`Collapse` disclosure remains the device-independent fallback; manual collapse suppresses automatic reopening until the footer interaction area is exited and later re-entered, and focused details are never hidden. Route changes reset the disclosure before position is evaluated again. `/contact`, `/terms`, `/privacy`, and `/security` remain footer-only routes; the Contact page shell is static even though its submission target is the isolated Pages Function.
