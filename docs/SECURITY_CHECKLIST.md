# Security Checklist

## Runtime surface

- Confirm core pages still build through Next.js static export with no route handlers, server actions, middleware, or runtime content fetches.
- Confirm the only Pages Function route is POST `/api/contact` and `out/_routes.json` includes only that exact path.
- Confirm static routes and assets do not invoke the Function.
- Document the data, validation, abuse cases, logging, and rate-limit plan before adding or broadening any endpoint.

## Contact request validation

- Treat all client checks as usability behavior, never as the security boundary.
- Accept only POST with `application/json`; reject other methods and media types.
- Enforce the 16 KiB streaming body limit before JSON parsing completes.
- Reject malformed payloads, unknown keys, unsafe control characters, excessive lengths, invalid email/phone formats, stale or implausibly fast submissions, and failed honeypot checks.
- Require first name, last name, email, message, and all three acknowledgements; validate the optional phone number when supplied.
- Require an exact allowed Origin and keep `CONTACT_ALLOWED_ORIGINS` limited to intended HTTPS origins.
- Return generic errors and `no-store` response headers without exposing configuration, provider details, recipient values, or validation internals.

## Turnstile

- Render the widget with the public `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; never expose `TURNSTILE_SECRET_KEY` to the client.
- Use the fixed action `portfolio_contact` in both widget and verifier.
- Verify every token server-side through Siteverify before delivery.
- Require `success: true`, exact action match, and a hostname in `TURNSTILE_ALLOWED_HOSTNAMES`.
- Fail closed on missing, invalid, expired, duplicate, malformed, timed-out, hostname-mismatched, action-mismatched, or unverifiable tokens.
- Keep production credentials separate from development/preview and do not authorize local hostnames on the production widget.

## Delivery and privacy

- Keep `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, and `CONTACT_RECIPIENT_EMAIL` in Cloudflare Pages encrypted secrets.
- Keep reviewed `CONTACT_FROM_EMAIL` and `CONTACT_REPLY_TO_EMAIL` values in non-secret Wrangler environment variables; never substitute them for the encrypted destination inbox.
- Confirm `CONTACT_RECIPIENT_EMAIL` never appears in tracked files, build output, response bodies, client variables, analytics, or logs.
- Verify the fixed Resend From address belongs to a verified `nicolasmgioanni.dev` domain.
- Use the submission-scoped Resend idempotency key and test both owner notification and visitor receipt.
- Do not log request bodies, message text, visitor contact details, Turnstile tokens, provider response bodies, or recipient-secret values.
- Keep retention statements accurate for Cloudflare, Resend, and downstream email providers even though the site has no contact database.

## Abuse controls

- Enable a Cloudflare WAF rate-limiting rule matching only the `/api/contact` path, counted by source IP; non-POST requests are rejected by the Function.
- On Cloudflare Free, start with 5 requests per 10 seconds and a 10-second block. Use method matching or longer windows only when the active plan supports them, then tune from non-sensitive aggregate evidence.
- Keep origin, body-size, schema, timing, honeypot, Turnstile, and idempotency controls enabled; the WAF rule does not replace them.

## Browser and routing configuration

- Confirm `out/_headers` and `out/_routes.json` exist after every production build.
- Validate `_routes.json` as JSON and ensure its include surface has not broadened.
- Confirm CSP permits `https://challenges.cloudflare.com` only where Turnstile requires it and has no unexplained third-party origins.
- Confirm static responses include CSP, permissions, referrer, HSTS, content-type, and framing protections.
- Confirm Function responses set their own `no-store`, content-type, referrer, and content-type-sniffing headers because Pages `_headers` does not apply to them.

## Content safety

- Spreadsheet data is public-safe.
- Generated JSON is not used for secrets.
- Spreadsheet text renders as plain React text.
- `dangerouslySetInnerHTML` is not used for spreadsheet content.
- Private resume files and access URLs are absent from templates, remote sheets, generated JSON, `public/`, and the exported site.
- `src/content/templates/resume.csv` remains header-only, and no remote resume-sheet environment variable exists.

## URL safety

- General links are limited to `https://`, `http://`, valid `mailto:`, or safe root-relative paths.
- Root-relative paths reject traversal such as `..`.
- Treat every accepted root-relative `public/` asset as public; validation does not provide access control.
- Recommendation `source_url` and `linkedin_url` values are HTTPS only.
- LinkedIn links are outbound verification links only.

## Environment and repository

- `.env` remains local-only and ignored by Git.
- The tracked `.env.example` contains placeholders only and no private recipient, credential, or usable secret.
- Local Pages Function testing uses `npm run dev:pages` or `wrangler pages dev out --env-file .env`; no second local secret file is required.
- Only `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is exposed publicly; no private value uses a `NEXT_PUBLIC_` name.
- Build-time public values are normally configured as GitHub repository variables, the restricted Pages upload credential uses GitHub Actions secrets, and Pages Function runtime values are configured separately in Cloudflare with sensitive values encrypted. Neither environment imports the local `.env` file. `develop` receives only the optional preview Turnstile site key and never falls back to the production key.
- Treat `PORTFOLIO_WORKBOOK_URL` as public-read-only configuration stored in a GitHub Actions secret solely for automatic log redaction. Use one anonymous HTTPS XLSX download and never introduce Drive/Sheets API access, OAuth, a service account, or a Google API key.
- Keep generated deployment state out of `main`; verify the `out/` artifact digest and use the active `/content-version.json` hash as the successful-deployment record.
- Production and preview have separate exact hostname/origin lists and appropriate credentials.
- Scan the tracked tree, reachable Git history, and `out/` for secrets, the private recipient, private resume artifacts, and stale URLs before publishing.

## Dependencies

- Run `npm audit`.
- Classify advisories as production runtime, build-time, or development-tooling risk.
- Do not force major dependency upgrades without checking compatibility.
