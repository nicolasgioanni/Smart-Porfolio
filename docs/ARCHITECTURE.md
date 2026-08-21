# Architecture

## Static-first portfolio

This project is a static-first smart portfolio. Next.js App Router pages are rendered at build time with `output: export`, which produces static files that can be served from a CDN.

## Google Sheets as a lightweight CMS

Google Sheets is used only as a public-safe editing surface. One workbook contains the nine public tabs `profile`, `links`, `research`, `projects`, `experience`, `recommendations`, `education`, `skills`, and `site_settings`; case does not affect tab matching and tab order is irrelevant. There is no remote `resume` tab.

The owner manually creates one workbook in the Google Sheets UI, imports each of the nine checked-in CSV templates into its matching named tab, and exposes only the reviewed workbook for anonymous XLSX download. The project never receives Google Drive access, a connector, Google API credentials, OAuth tokens, a service account, or permission to the owner's account. GitHub Actions holds only `PORTFOLIO_WORKBOOK_URL`, an anonymously downloadable public URL.

## Build-time content fetching

The content generator performs one anonymous HTTPS request to `PORTFOLIO_WORKBOOK_URL` and parses the returned XLSX file locally. It accepts exactly the nine expected visible worksheets. A worksheet is matched by `worksheetName.trim().toLowerCase()`, so capitalization and physical order do not matter, while internal spaces, hyphens, and spelling changes remain invalid. Duplicate normalized names, missing or unexpected worksheets, any `resume` worksheet, hidden sheets, HTML/login responses, oversized or timed-out downloads, invalid ZIP/XLSX data, malformed headers or rows, and schema failures are rejected.

Displayed cell text is converted into the existing CSV-equivalent row model, so the established normalization and validation logic remains authoritative. Equivalent line endings and harmless trailing blank cells or rows normalize consistently. Local development may use checked-in templates when the workbook URL is blank and strict mode is false. GitHub Actions enables strict remote mode for `main`, `develop`, scheduled, and manual deployment candidates, so it never falls back to templates.

Generation writes `src/content/generated/portfolio.generated.json` once per workflow run. The workflow then uses `npm run build:generated`, which consumes that already-generated file instead of fetching Google Sheets again, so tests and deployment use the exact same snapshot.

## Generated JSON and typed UI mapping

The UI imports generated JSON through typed helpers. Pages receive normalized profile, links, research, projects, experience, recommendations, education, skills, the empty local resume compatibility source, and site settings.

Generated metadata includes a SHA-256 `contentHash` over canonical normalized rendered content with volatile metadata excluded. When the hash is unchanged, generation preserves `generatedAt` and reports `content_changed=false`. Worksheet order or title capitalization, XLSX author/modified metadata, download time, line-ending representation, trailing blank cells, and generation timestamps therefore cannot cause a deployment unless normalized visible content changes.

This keeps display components simple and avoids spreadsheet parsing inside React components.

## Minimal runtime boundary

Core portfolio pages do not require a runtime Next.js server. Static export generates their HTML and client assets for Cloudflare Pages. The one runtime boundary is the Cloudflare Pages Function at `/api/contact`; `public/_routes.json` limits Function invocation to that exact path so ordinary page and asset requests remain static.

## Contact submission flow

The footer-only `/contact` page is statically exported and hydrates a focused client form. A visitor completes Turnstile first, supplies a required name, email, and message with an optional phone number, reviews the request, accepts all three acknowledgements, and submits JSON to the same-origin `/api/contact` endpoint. Direct email remains available as the fallback channel.

The browser-side checks are usability controls, not the trust boundary. The Pages Function rejects unsupported methods and media types, enforces origin, body-size, field, acknowledgement, timing, and honeypot rules, and sends generic failure responses. It then calls Cloudflare Turnstile Siteverify with the server-only secret and accepts a token only when verification succeeds and both the `portfolio_contact` action and configured hostname match.

After verification, the Function uses Resend to deliver the request to the server-only `CONTACT_RECIPIENT_EMAIL` and send a confirmation to the visitor. The non-secret sender and fixed reply-to identities come from `CONTACT_FROM_EMAIL` and `CONTACT_REPLY_TO_EMAIL`; provider credentials and the recipient remain encrypted runtime secrets. Resend and Turnstile credentials never enter browser code, generated content, or the static export. The form does not use a database; delivery is email-only.

## No database

The spreadsheet is the editing source, and generated JSON is the build artifact. A database would add operational cost and complexity without improving the v1 portfolio workflow.

## No authentication

The portfolio only renders public-safe information. Authentication would be unnecessary for readers and incompatible with the static-first v1 goal.

## No runtime Google Sheets requests

The deployed site does not fetch spreadsheet data in the browser. This avoids loading delays, API availability issues, quota concerns, and exposure of implementation details.

## Cloudflare Pages fit

GitHub Actions owns the content check, quality gate, static build, and Cloudflare Direct Upload. Cloudflare Git integration stays disabled. The Pages project name is `smart-portfolio`, but its assigned domain is `smart-portfolio-bds.pages.dev`; `CLOUDFLARE_PAGES_DOMAIN` keeps polling and smoke-test URLs independent from the deployment project name. The workflow uploads the tested `out/` artifact from repository root so Wrangler also compiles the repository-level `functions/` directory, while `public/_routes.json` keeps the invocation surface limited to `/api/contact`. No database, authentication service, background job, or runtime content API is required.

## Green-gated content flow

Pull requests verify without deploying. A green `develop` push deploys the tested artifact only to the `develop` preview branch; it cannot update production. A `main` push or forced manual run becomes a production candidate. A daily `13:17 UTC` run becomes one only when the candidate hash differs from the active production `/content-version.json`. Production concurrency and a current-`main` guard keep stale runs from publishing.

The verify job fetches and parses the workbook once, generates JSON once, tests that snapshot, builds `out/` without refetching, writes the public-safe `content-version.json`, and uploads a SHA-256-verified artifact. A deploy job checks out the same commit for `functions/` and `wrangler.jsonc`, validates the downloaded artifact, and runs Wrangler from the repository root without rebuilding or downloading the workbook again.

Generated content and deployment state are not committed. The manifest served by the currently successful Cloudflare deployment remains the source of truth; a failed run leaves it untouched and is retried on the next poll. An unchanged scheduled run is a no-op except for a narrowly allowed heartbeat after 30 inactive days. That heartbeat is written only to the isolated `automation-heartbeat` branch, never `main`, and cannot deploy. Cloudflare stores contact-provider runtime secrets; GitHub stores the public build inputs and restricted Pages deployment credential.

## Home and detail layers

The Home page is the summary layer. It presents the profile overview, experience, education, research, three projects, three spreadsheet-driven Skills category cards, and three Recommendations in that order. Each Skills card contains four badges; complete popup fields hydrate a shared accessible dialog that presents proficiency and evidence of use while preserving static rendering for legacy rows. Compact top-right `View` buttons connect the Experience, Research, Projects, and Recommendations sections to their focused routes. A focused client coordinator hydrates the server-rendered Home recommendation grid to balance three/four-line previews per visual row, preserve the outer panel's collapsed height, and publish normal-flow space for a protruding expanded card; the surrounding page remains static-first. When recommendations are enabled without published rows, Home and the Recommendations route may show an honest empty state instead of inventing content.

The detail pages are evidence layers. Research, projects, experience, and recommendations show longer explanations, bullets, context, impact details, recommendation quotes, and supporting links. The Resume route intentionally publishes only an access-request statement; a private resume file is not part of the static export.

The footer stays in normal document flow after every route and server-renders as a compact copyright row. Its client wrapper reserves a scroll runway beneath the compact dock that is large enough for the expanded details. The compact row therefore appears before the page reaches its hard bottom; continued native scrolling into the reserved runway crosses a stable activation boundary and expands the details into that already-reserved footprint. The same below-to-visible boundary crossing expands the footer when content above it contracts, even if the browser clamps the scroll position upward while the page becomes shorter. Scrolling upward across the return boundary collapses the details and restores the runway without changing the document's overall length. A small hysteresis window prevents oscillation near the boundary. An explicit `Details`/`Collapse` disclosure remains the device-independent fallback; manual collapse suppresses automatic reopening until the footer interaction area is exited and later re-entered, and focused details are never hidden. Route changes reset the disclosure before position is evaluated again. `/contact`, `/terms`, `/privacy`, and `/security` remain footer-only routes; the Contact page shell is static even though its submission target is the isolated Pages Function.
