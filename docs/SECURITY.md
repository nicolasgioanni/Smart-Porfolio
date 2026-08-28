# Security

## Static-first architecture with an isolated endpoint

Portfolio content is fetched by one anonymous HTTPS XLSX download at build time, normalized into generated JSON, and rendered as a static Next.js export. Core pages do not need a database, authentication service, runtime Next.js server, Google authentication, or a runtime Google Sheets request.

The sole request-handling boundary is the Cloudflare Pages Function at `/api/contact`. `public/_routes.json` limits Function invocation to that exact path. Do not broaden the include rule or introduce another endpoint without documenting its data, abuse cases, validation, logging, and rate limits first.

## Contact trust boundary

The browser presents Turnstile before the data-entry steps to reduce automated traffic early, but placement is not the security boundary. Client validation, disabled controls, consent-card state, and a successful widget animation can all be bypassed. The Pages Function must independently enforce every rule before delivery.

The Function accepts only POST requests with `application/json`, applies a 16 KiB body limit while streaming the request, rejects malformed or unknown fields, and validates required first name, last name, email, message, three acknowledgements, timing metadata, and a submission identifier. Phone is optional and is validated when present. A hidden honeypot and minimum-completion-time check add low-cost abuse signals without replacing Turnstile or rate limiting.

Requests must carry an exact allowed `Origin`; production `CONTACT_ALLOWED_ORIGINS` must list only the canonical HTTPS origin. Responses use generic error codes so configuration, address, provider, and validation details are not exposed to visitors.

## Turnstile verification

Every accepted request requires a fresh Turnstile token. The Function sends it to Cloudflare Siteverify with `TURNSTILE_SECRET_KEY`, the request's Cloudflare-provided remote IP when available, and the submission ID as the verification idempotency key. Delivery proceeds only when Siteverify returns all of the following:

- `success: true`;
- action exactly `portfolio_contact`;
- hostname in the exact `TURNSTILE_ALLOWED_HOSTNAMES` list.

Missing, invalid, expired, duplicated, action-mismatched, hostname-mismatched, malformed, timed-out, or unverifiable tokens fail closed. The public `NEXT_PUBLIC_TURNSTILE_SITE_KEY` may appear in the client bundle; the matching secret must exist only in Pages Function secrets. Production widget credentials must not authorize local-development hostnames.

## Email delivery and personal data

After all checks pass, the Function uses Resend's batch endpoint to send an owner notification to the private `CONTACT_RECIPIENT_EMAIL` and a receipt to the visitor's required email address. It uses a submission-scoped Resend idempotency key to reduce duplicate sends. The `CONTACT_FROM_EMAIL` runtime value must belong to a verified sending domain. Owner notifications reply to the visitor's validated email; confirmation messages reply to the separately configured public `CONTACT_REPLY_TO_EMAIL`.

`CONTACT_RECIPIENT_EMAIL`, `RESEND_API_KEY`, and `TURNSTILE_SECRET_KEY` are encrypted runtime secrets. `CONTACT_FROM_EMAIL` and `CONTACT_REPLY_TO_EMAIL` are reviewed, non-secret Wrangler variables; they still must not be confused with the private destination inbox. Never expose the recipient through `NEXT_PUBLIC_` values, examples, generated JSON, source maps, response bodies, analytics, or logs.

The site does not persist contact submissions in a database. Resend and email providers still process and retain delivery data under their own policies. Do not log request bodies, Turnstile tokens, email addresses, phone numbers, message content, API responses containing provider identifiers, or the recipient secret. Operational logs should be limited to coarse outcome codes, timings, and non-sensitive aggregate counts.

## Rate limiting and abuse controls

Production activation requires a Cloudflare WAF rate-limiting rule matching only:

```text
http.request.uri.path eq "/api/contact"
```

Count by source IP. The Free-plan-compatible baseline is 5 requests per 10 seconds with a 10-second block; plans that support the Method field and longer periods may narrow the rule to POST and use a longer window. Tune only from non-sensitive aggregate evidence. Rate limiting is defense in depth alongside exact-origin checks, the body limit, strict schema validation, timing/honeypot checks, mandatory Siteverify validation, and Resend idempotency. None of those controls is sufficient alone.

## Browser security headers

`public/_headers` applies a Content Security Policy and baseline protections to static Pages responses. Turnstile requires `https://challenges.cloudflare.com` in `script-src` and `frame-src`; the current policy also allows that origin in `connect-src`. The exported Next.js app currently needs inline script and style allowances. Prefer nonces or hashes if the delivery architecture later supports per-response CSP values, and do not add broader third-party origins without review.

Cloudflare Pages `_headers` rules do not apply to Function-generated responses. `/api/contact` therefore sets its own `Cache-Control: no-store`, JSON content type, referrer policy, and content-type-sniffing protection.

## Spreadsheet data rules

The workbook URL and all nine worksheets are intentionally public content sources. The downloaded workbook must contain exactly the expected visible worksheets and no hidden, unexpected, duplicate, or `resume` sheet. Do not store secrets, private recommendation text, credentials, unpublished contact details, private resume files or access links, or sensitive personal data in worksheet cells or workbook metadata.

Treat the XLSX file as untrusted input even though its URL is configured by the repository owner. The generator enforces HTTPS, a fixed timeout and byte limit, HTML/login-page rejection, XLSX ZIP validation, exact worksheet structure, cached formula results, headers, row shape, and the existing content schema before build. It does not log the workbook URL, Google identifiers, or response metadata. GitHub Actions registers the configured workbook URL for masking before the strict generation step so later runner output redacts it.

Generated JSON is a transient build input in deployment workflows. The tested `out/` artifact carries a digest and a public-safe `/content-version.json`; no generated snapshot or deployment state is committed to `main`.

## URL rules

Accepted general content URLs are:

- `https://`
- `http://`
- valid `mailto:`
- safe root-relative paths such as `/images/profile/portrait.png`

Root-relative paths must not contain traversal segments such as `..`. Recommendation `source_url`, `linkedin_url`, and `full_quote_link_url` values must be HTTPS URLs.

Every root-relative file under `public/` is publicly retrievable. URL validation does not make an asset private.

## Private resume handling

A resume is private only when the file and every access URL are absent from the deployed public surface. Hiding the link or replacing the `/resume` page is not sufficient if a PDF remains under `public/`.

For the private-resume configuration:

- Keep `profile.resume_url` and `profile.resume_download_label` blank in both local templates and remote content sources.
- Keep `src/content/templates/resume.csv` empty except for its header. The resume sheet has no remote-source environment variable and must never be populated.
- Remove resume-kind link rows that point to a file, and do not place a resume PDF under `public/resume/` or any other public directory.
- Regenerate content after source changes and verify that built HTML, generated JSON, and the exported `out/` tree contain no resume-file URL.
- Check prior deployments, CDN caches, repository history, and published source archives separately. Removing the current file does not retract copies that were already published or committed.

Repository-history rewriting and cache-purge operations are separate, potentially destructive actions that require an explicit review and authorization.

## External links

External links that open in a new tab must use:

```text
target="_blank"
rel="noopener noreferrer"
```

LinkedIn recommendation links are verification/navigation links only. Do not scrape LinkedIn, call the LinkedIn API, or fetch recommendation content from LinkedIn at runtime.

## Rendering spreadsheet content

Spreadsheet text should render as plain React text. Do not use `dangerouslySetInnerHTML` for spreadsheet-provided content. A recommendation's optional inline link is the only structured exception: generation validates its paired label and HTTPS URL, and the component composes ordinary text nodes with one escaped anchor. Do not parse HTML or Markdown, and do not auto-link raw URLs from recommendation copy.

## Environment separation

`PORTFOLIO_WORKBOOK_URL` identifies one anonymous XLSX download, not a credential. It grants no Google account or Drive access; the build performs one ordinary HTTPS request and never uses a connector, Google API, API key, OAuth grant, or service account. Local development uses one Git-ignored `.env` file for build-time values and Pages Function values. Create it from the tracked `.env.example`, which must contain placeholders only, and pass it to Wrangler with `npm run dev:pages` or `wrangler pages dev out --env-file .env`.

The consolidated local file does not change the production trust boundary. Build-time public values belong in GitHub repository variables, and the restricted direct-upload credential belongs in GitHub Actions secrets. Cloudflare Pages encrypted secrets hold the server-only Turnstile, Resend, and recipient values; reviewed hostnames, origins, sender, and reply-to identities live as non-secret production/preview Wrangler variables. Never upload `.env` to either service or copy local credentials into production. `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is client-visible; a `develop` build receives only `NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY`, with no production-key fallback. Keep preview and production site keys, server secrets, allowed hostnames, allowed origins, Resend keys, and recipient values separated by environment.

## Repository publication

Before changing repository visibility, scan tracked files and every reachable Git object for credentials, private contact information, unpublished assets, oversized artifacts, and unsafe configuration. Commit author and committer metadata is part of the public history and must use only approved addresses. Do not expose repository or license links in production until the audit passes and both anonymous HTTPS destinations resolve successfully. Rewriting published history and force-pushing are separate destructive operations that require explicit authorization.

## Dependency audit workflow

Run:

```powershell
npm audit
```

Classify findings as production runtime, static-build, or development tooling risk. Do not run `npm audit fix --force` without explicit approval because it can introduce major dependency upgrades.
