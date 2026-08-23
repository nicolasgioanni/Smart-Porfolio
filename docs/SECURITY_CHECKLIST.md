# Security Checklist

Use this checklist with [Contact System](CONTACT_SYSTEM.md), [Security](SECURITY.md), and [Deployment](DEPLOYMENT.md). Check source and generated artifacts for repository behavior. Check provider dashboards and controlled deployed requests for external behavior.

## Evidence and control status

- Label each control as repository-enforced, an external operator requirement, or live state unverified.
- Do not treat documentation, Wrangler variables, or unit tests as proof that secrets, DNS, WAF rules, sender verification, or delivery settings are active in production.
- Resolve prose conflicts against the current implementation and generated deployment files, then update the conflicting prose.
- Keep public Privacy and Security statements within behavior that source or deployed evidence can support.

## Runtime surface and routing

- Confirm core routes still use Next.js static export without route handlers, server actions, middleware, or runtime content fetches.
- Confirm `public/_routes.json` includes exactly `/api/contact/verify` and `/api/contact`, with no broader pattern.
- Confirm the exported `out/_routes.json` matches the reviewed source file.
- Confirm unauthenticated deployment smoke checks require a `405` JSON response from both Function paths.
- Document data, validation, retention, logging, abuse controls, and response behavior before adding or broadening an endpoint.

## Shared request envelope

- Accept only `POST` on both endpoints and include `Allow: POST` on `405` responses.
- Require base media type `application/json`; permit parameters only through the existing normalized media-type check.
- Enforce the 16,384-byte limit on both streamed request bodies before JSON parsing completes, including when `Content-Length` is absent or misleading.
- Require strict UTF-8 and valid JSON.
- Require an exact configured `Origin`; reject missing, `null`, malformed, non-HTTP(S), path-bearing, or unlisted origins.
- Fail configuration closed if any comma-separated origin or hostname entry is invalid.
- Keep errors generic and do not add CORS headers.
- Keep every Function response non-cacheable JSON with the handler-owned referrer and content-type-sniffing headers.

## Turnstile verification

- Render the visible widget with public `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; never expose `TURNSTILE_SECRET_KEY` to the client.
- Keep action `portfolio_contact`, explicit token handling, and the gate before contact data entry.
- Accept a plain verification object with exactly `submissionId` and `turnstileToken`.
- Require a valid bounded UUID and a non-empty token of at most 2,048 characters without unsafe controls.
- Send one server-side Siteverify request per new verified session with a 5-second timeout.
- Use the UUID as Siteverify `idempotency_key`.
- Include `CF-Connecting-IP` as `remoteip` only after the existing length and control-character checks.
- Require an HTTP-success JSON response, `success: true`, action exactly `portfolio_contact`, and an exact allowed hostname.
- Fail closed on missing configuration, provider failure, timeout, invalid JSON, failed verification, action mismatch, or hostname mismatch.
- Keep production and preview site keys, secrets, allowed hostnames, and allowed origins separated.

## Verification ticket

- Set `__Host-portfolio_contact_ticket` with `Path=/`, `Max-Age=1800`, `Secure`, `HttpOnly`, `SameSite=Strict`, and no `Domain` attribute.
- Store only version, submission UUID, issue time, and expiry time in the signed ticket. Store no contact fields.
- Derive the signing key from `TURNSTILE_SECRET_KEY` with the existing domain-separated HKDF-SHA-256 construction and sign with HMAC-SHA-256.
- Reject an absent or duplicate cookie name, oversized or non-canonical encoding, malformed payload, wrong signature size, invalid signature, wrong version, future issue time beyond allowance, altered lifetime, expiry, or UUID mismatch.
- Clear the ticket only after successful provider delivery. Retain a still-valid ticket after delivery failure for retry.
- Do not describe the ticket as encrypted, database-backed, revoked, or server-enforced single-use.

## Delivery schema and ordering

- Allow only `submissionId`, `firstName`, `lastName`, `email`, optional `phone`, `message`, `contactConsent`, `legalConsent`, `legitimateConsent`, `startedAt`, and `website`.
- Reject unknown keys, invalid types, unsafe control characters, excessive lengths, malformed email or phone values, and any acknowledgment other than boolean `true`.
- Require trimmed first and last names, a valid email, a message, all three acknowledgments, a safe integer start time, and the required honeypot string.
- Keep names at 80 characters each, email at 254, phone at 40 with 7 to 20 digits when non-empty, message at 3,000, and honeypot at 200.
- Preserve line-feed normalization for the message and the documented timing bounds: 1,200-millisecond minimum, 30-second future allowance, and two-hour maximum age.
- Preserve the actual handler order: honeypot and timing signals are evaluated while parsing the payload before ticket validation.
- Return silent `200 {"ok":true}` for a non-empty honeypot or completion under 1,200 milliseconds, with no Resend call.
- Require a valid ticket and matching submission UUID before normal provider delivery. Do not claim the ticket is checked before all field parsing.

## Client retry and email delivery

- Send no contact fields to `/api/contact/verify` and do not send the Turnstile token to `/api/contact`.
- Keep the contact draft in React memory and use same-origin credentials for both requests.
- After the first delivery attempt starts, lock review navigation and acknowledgments.
- Require same-ticket retries to reuse the same UUID, start time, acknowledgment values, and byte-equivalent JSON body.
- On `verification_required`, return to the gate, preserve the draft, unlock it for a new session, and create a new UUID after verification.
- Validate the mail domain with bounded MX lookup, documented A/AAAA fallback, explicit null-MX rejection, and distinct invalid-versus-unavailable errors.
- Reserve no more than two slots per normalized-address HMAC during a rolling 24-hour window before provider delivery.
- Send the visitor confirmation first with `Idempotency-Key: portfolio-contact/visitor/<submissionId>`; only after acceptance send the owner notification with the corresponding `/owner/` key.
- Send the owner notification to the private configured recipient with only the validated visitor email as `reply_to`.
- Send the visitor confirmation to the validated visitor email with the fixed public reply-to.
- Keep the sender and subject formats server-controlled, reject header controls in names and addresses, escape user-controlled HTML, and include plain-text alternatives.
- Treat provider timeout, network failure, and non-success status as generic `502 delivery_failed` without returning or logging provider details.

## Privacy, storage, and logging

- Keep the contact draft out of local storage and session storage.
- Keep contact fields out of the ticket and the verification request.
- Keep D1 limited to submission UUID, normalized-address HMAC, reservation epoch seconds, and expiry epoch seconds; store no raw contact fields or delivery content.
- Confirm expired rows are removed during reservation cleanup, same-ID same-address retries are free, changed-address replay is rejected, and D1 failures fail closed.
- Account for Cloudflare, Turnstile, Resend, receiving mailboxes, and the visitor's mailbox as processors or retention locations outside the repository.
- Keep `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, and `CONTACT_RECIPIENT_EMAIL` server-only.
- Confirm the private recipient never appears in browser variables, generated content, build output, responses, analytics, or application logs.
- Do not log request bodies, contact fields, tokens, cookie contents, provider responses, message identifiers, recipient values, or credentials.
- If telemetry is added, limit it to coarse outcomes, bounded timings, and non-sensitive aggregates.

## Abuse controls and WAF

- Keep repository-enforced origin, body-size, schema, acknowledgment, honeypot, timing, Turnstile, ticket, and idempotency controls enabled.
- Keep the repository-enforced D1 address quota and its `429` response distinct from the external IP-based WAF control.
- Configure an external Cloudflare rate-limiting rule for both exact contact paths and review its counting characteristic, threshold, mitigation timeout, and action.
- Treat live WAF state as unverified until checked in Cloudflare and through a controlled deployed test.
- Do not place an interactive Managed Challenge on either JSON endpoint.
- Do not promise a custom JSON rate-limit block response unless the active Cloudflare plan and selected action support it. Cloudflare documents that feature for Pro plans and higher, not as a Free-plan guarantee.
- Tune external thresholds only from non-sensitive aggregate evidence and keep the WAF rule as defense in depth.

## Static headers and Function headers

- Confirm `out/_headers` exists and matches the reviewed `public/_headers` policy.
- Keep the static CSP limited to reviewed origins and the Turnstile allowances needed in `script-src`, `connect-src`, and `frame-src`.
- Confirm static responses receive CSP, Permissions Policy, referrer policy, HSTS, content-type-sniffing, and framing protections.
- Remember that Pages `_headers` rules do not apply to Function-generated responses.
- Confirm both handlers set `Cache-Control: no-store, max-age=0`, JSON content type, `Referrer-Policy: no-referrer`, and `X-Content-Type-Options: nosniff` themselves.

## Content, rendering, and URL safety

- Treat workbook and generated site content as public and untrusted input.
- Keep credentials, private contact values, and unpublished sensitive data out of content sources, generated JSON, and public assets.
- Render content-source text as escaped React text and do not add raw HTML or Markdown parsing.
- Keep general links limited to HTTP(S), valid `mailto:`, or safe root-relative paths, with stricter HTTPS rules where the schema requires them.
- Reject root-relative traversal and treat every accepted file under `public/` as publicly retrievable.
- Require `rel="noopener noreferrer"` for external links opened in a new tab.

## Environment and publication

- Keep the local environment file ignored and the tracked example placeholder-only.
- Expose only values deliberately named for the browser. No server secret may use a `NEXT_PUBLIC_` name.
- Keep GitHub Actions build inputs and upload credentials separate from Cloudflare Function bindings.
- Keep production and preview site keys, server secrets, hostnames, origins, provider keys, and recipient settings separate.
- Keep the pinned production and preview `CONTACT_RATE_LIMIT_DB` IDs distinct, reject missing or all-zero IDs, and apply tracked migrations before deploying each environment.
- Verify live encrypted bindings without printing their values. Do not infer them from `wrangler.jsonc`.
- Keep the build source as one anonymous HTTPS XLSX download without adding an OAuth grant, service account, or Google API credential.
- Verify artifact integrity metadata and active content-version evidence during deployment.
- Scan tracked files, reachable Git objects, generated output, and exported artifacts for secrets, non-public personal data, stale URLs, and unsafe configuration before publication.
- Treat history rewriting, force-pushing, and provider-side deletion as separate destructive operations that require explicit authorization and review.

## Dependencies and future endpoints

- Run `npm audit` and classify advisories as runtime, static-build, or development-tooling risk.
- Do not force major dependency upgrades without compatibility and artifact review.
- For every new endpoint, document and test methods, media types, schema, body and time limits, origins, authentication or verification, privacy, retention, logs, abuse controls, error responses, headers, and deployment checks.
- Update [Contact System](CONTACT_SYSTEM.md), [Security](SECURITY.md), and [Deployment](DEPLOYMENT.md) when the runtime or operator contract changes.
