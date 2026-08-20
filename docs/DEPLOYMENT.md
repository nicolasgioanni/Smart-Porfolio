# Deployment

## Cloudflare Pages deployment

1. Audit the tracked tree and reachable Git history for secrets, private metadata, unpublished assets, and unsafe configuration; resolve every blocker before changing visibility.
2. Push the repository to GitHub only after the exposure audit passes.
3. Create or connect a Cloudflare Pages project. Use Git integration or Wrangler so Cloudflare compiles the repository-level `functions/` directory; a static-assets-only upload is not sufficient for the contact endpoint.
4. Use `npm run build` as the build command and `out` as the build output directory.
5. Confirm the deployed Function route is exactly `/api/contact`. `public/_routes.json` is copied into `out/` and prevents static page and asset requests from invoking the Function.
6. Configure production and preview values separately before accepting contact requests.

The Next.js app remains an `output: "export"` build. Cloudflare serves the exported pages from its CDN and runs only `/api/contact` through Pages Functions.

## Environment variables and secrets

Local development uses the ignored `.env` file created from the tracked, placeholder-only `.env.example`. Do not upload that file or reuse it as production configuration. Configure production and preview variables in the Cloudflare Pages dashboard, and store the sensitive values called out below as encrypted secrets.

Build-time public value:

- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: the public site key compiled into the browser bundle. This is the only Turnstile value permitted under `NEXT_PUBLIC_`.

Pages Function secrets:

- `TURNSTILE_SECRET_KEY`: the matching Turnstile server secret.
- `RESEND_API_KEY`: a restricted Resend API key used only by the contact Function.
- `CONTACT_RECIPIENT_EMAIL`: the private inbox that receives contact requests. Store it as an encrypted secret and never put the real value in source, generated content, build logs, public variables, or example files.

Pages Function configuration:

- `TURNSTILE_ALLOWED_HOSTNAMES`: comma-separated exact hostnames without schemes, ports, paths, or wildcards.
- `CONTACT_ALLOWED_ORIGINS`: comma-separated exact HTTPS origins, including scheme and optional port, with no path.

The Turnstile widget and server verifier use the fixed action `portfolio_contact`. Production and preview must use their own exact hostname/origin lists; do not broadly allow `*.pages.dev`. If a preview hostname is not explicitly configured, contact submission should remain unavailable there.

CSV URL variables:

- `PORTFOLIO_PROFILE_CSV_URL`
- `PORTFOLIO_LINKS_CSV_URL`
- `PORTFOLIO_RESEARCH_CSV_URL`
- `PORTFOLIO_PROJECTS_CSV_URL`
- `PORTFOLIO_EXPERIENCE_CSV_URL`
- `PORTFOLIO_RECOMMENDATIONS_CSV_URL`
- `PORTFOLIO_EDUCATION_CSV_URL`
- `PORTFOLIO_SKILLS_CSV_URL`
- `PORTFOLIO_SITE_SETTINGS_CSV_URL`

Optional strict mode:

- `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true`

Use strict mode for production when demo fallback content should never deploy.

There is intentionally no remote resume-sheet variable. `src/content/templates/resume.csv` must remain the empty, header-only source so a content build cannot restore private resume details from a remote sheet.

## Cloudflare Turnstile setup

1. Create a production Turnstile widget for the canonical portfolio hostname only.
2. Set its public site key as the build-time `NEXT_PUBLIC_TURNSTILE_SITE_KEY`.
3. Store its secret as the encrypted Pages Function secret `TURNSTILE_SECRET_KEY`.
4. Set `TURNSTILE_ALLOWED_HOSTNAMES` to the same exact production hostname set.
5. Keep the widget action fixed to `portfolio_contact` and verify that exact action and hostname after every Siteverify call.

Turnstile tokens are single-use and short-lived. The browser widget is not the enforcement boundary: the Function must fail closed when Siteverify is unavailable or returns an invalid, expired, duplicate, action-mismatched, or hostname-mismatched result. See Cloudflare's [server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/) and [hostname management](https://developers.cloudflare.com/turnstile/additional-configuration/hostname-management/) documentation.

## Resend setup

1. Verify `nicolasmgioanni.dev` in Resend and complete its required DNS records before production delivery.
2. Confirm the fixed sender `Nicolas Gioanni <noreply@nicolasmgioanni.dev>` is permitted by that verified domain.
3. Create a restricted API key and store it only as `RESEND_API_KEY` in Pages Function secrets.
4. Store the actual destination inbox only as the encrypted `CONTACT_RECIPIENT_EMAIL` secret.
5. Exercise both messages in a controlled test: the owner notification replies to the visitor's required email, while the visitor confirmation replies to the fixed public address `ngioanni@uw.edu`. Neither the fixed From nor public reply-to identity is a runtime setting.

The Function uses Resend's batch endpoint with a submission-scoped idempotency key. Domain verification and idempotency behavior are documented in Resend's [domain](https://resend.com/docs/dashboard/domains/introduction) and [idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys) guides.

## WAF rate-limit rule

Create a Cloudflare WAF rate-limiting rule before production activation. The Free-plan-compatible baseline matches the endpoint path:

```text
http.request.uri.path eq "/api/contact"
```

Count by source IP. On Cloudflare Free, start with 5 requests per 10 seconds and a 10-second block, then tune from non-sensitive aggregate evidence. The Function rejects non-POST methods independently. Plans that expose the Method field and longer periods may narrow the expression to POST and use a longer window or mitigation period. Apply the rule only to this path so static browsing is unaffected. The WAF rule supplements, but does not replace, the Function's origin checks, 16 KiB body limit, schema validation, honeypot/timing checks, Turnstile Siteverify call, and Resend idempotency key. Confirm current plan limits in Cloudflare's [rate-limiting availability table](https://developers.cloudflare.com/waf/rate-limiting-rules/#availability).

## Security headers and Function routing

`public/_headers` adds a static-response Content Security Policy and baseline browser protections. The policy permits the Cloudflare Turnstile script and frame origin while retaining the inline script/style allowances currently required by the exported Next.js application. Review those allowances whenever inline bootstrapping changes.

Cloudflare Pages `_headers` rules do not govern Function-generated responses. `/api/contact` must continue returning its own `no-store`, content-type, referrer, and content-type-sniffing headers. `public/_routes.json` must continue including only `/api/contact`; broadening it changes the billed and security-relevant runtime surface.

See Cloudflare's [Pages Functions routing](https://developers.cloudflare.com/pages/functions/routing/) and [Turnstile CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/) references.

## Publishing Google Sheets as CSV

1. Create one tab for each logical sheet.
2. Keep the first row as the documented field names.
3. Select `File`, then `Share`, then `Publish to web`.
4. Choose the tab and CSV format.
5. Copy the published CSV URL into the matching Cloudflare build environment variable.

After editing Google Sheets, trigger a new Cloudflare Pages deployment. The build fetches CSV content, generates JSON, and renders static pages; the deployed browser never fetches the sheets at runtime.

## Asset placement

- Portrait image: `public/images/profile/`.
- Project images: `public/images/projects/`.
- Research images: `public/images/research/`.
- Favicon: `public/favicon/`.

Root-relative paths are supported by validation, but every file under `public/` is deployed for anonymous access. For the private-resume configuration, keep `resume_url` and `resume_download_label` blank, remove resume-file link rows, and do not place any resume PDF under `public/resume/` or another public directory.

Before deployment, verify that templates, configured remote sheets, generated JSON, built HTML, and `out/` contain no private resume URL or file. Prior deployments, CDN caches, repository history, and published source archives require separate review; removing a current asset does not retract an earlier copy.

## Static export caveats

- Do not add Next.js API routes, route handlers, middleware, or server actions; runtime request handling belongs in the narrow `functions/` boundary.
- Do not depend on runtime Google Sheets requests.
- Do not use default Next image optimization without a static-compatible configuration.
- Avoid Next.js rewrites, redirects, ISR, and other runtime-server features.
- Keep `/api/contact` out of generated portfolio content and client-exposed configuration.

The `/recommendations` route is a static page generated from the same build-time JSON as the rest of the portfolio. LinkedIn recommendation links are plain outbound links only. The `/contact` page is also statically exported, but its client form posts to the separately compiled `/api/contact` Pages Function.

## Pre-deployment verification

1. Run `npm run verify`.
2. Confirm `out/_routes.json` and `out/_headers` exist after the build and validate `_routes.json` as JSON.
3. Search the tracked tree and `out/` for real secret values, the private recipient address, private resume filenames, and stale public resume URLs.
4. Confirm the production Turnstile widget, site key, secret, hostname list, and fixed `portfolio_contact` action agree.
5. Confirm `CONTACT_ALLOWED_ORIGINS` contains only the intended exact production origin and that `CONTACT_RECIPIENT_EMAIL` is stored as a secret.
6. Confirm the Resend domain and fixed sender are verified, then send one controlled end-to-end request.
7. Verify the request reaches the private inbox, the visitor receives a confirmation, duplicate/replayed Turnstile tokens fail, and logs do not contain message bodies or recipient-secret values.
8. Confirm the WAF rate-limit rule is enabled for POST `/api/contact` before announcing the form.
