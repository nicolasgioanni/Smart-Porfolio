# Security

The portfolio is a static-first site with a deliberately narrow dynamic boundary. Core pages are exported as static files. Cloudflare Pages invokes Functions only for the two contact endpoints listed in `public/_routes.json`.

This document separates controls that the repository enforces from controls that an operator must configure in external services. For the exact contact request and response contract, use [Contact System](CONTACT_SYSTEM.md). For environment activation and deployment checks, use [Deployment](DEPLOYMENT.md). Use [Security Checklist](SECURITY_CHECKLIST.md) when reviewing a change or release.

## Control status

| Status | Meaning |
| --- | --- |
| Repository-enforced | Source code, generated configuration, or tests implement the control in this repository. |
| External operator requirement | Cloudflare, Resend, DNS, mailbox, or account configuration must be set and checked outside the repository. |
| Live state unverified | Repository inspection cannot establish whether the external control is enabled or effective in the deployed environment. |

Documentation is not evidence that an external control is active. Treat the implementation and generated deployment files as authoritative for repository behavior, and verify external state in the relevant provider.

## Authoritative sources

| Concern | Source |
| --- | --- |
| Function route boundary | `public/_routes.json` |
| Static response headers | `public/_headers` |
| Contact request validation, tickets, provider calls, and Function headers | `functions/_shared/contact.ts` |
| Contact endpoint order and responses | `functions/api/contact/verify.ts`, `functions/api/contact.ts` |
| Browser request and retry behavior | `src/components/contact/ContactForm.tsx` |
| Turnstile widget configuration | `src/components/contact/TurnstileWidget.tsx` |
| Production and preview non-secret Function values | `wrangler.jsonc` |
| Build-time public values and deployment flow | `.github/workflows/ci.yml` |
| Contact behavior reference | `docs/CONTACT_SYSTEM.md` |

## Threat model

Assume that a visitor can bypass all browser controls, construct arbitrary requests, replay cookies, alter JSON, omit headers, and send traffic directly to a Function. Also assume that public static files, browser bundles, repository contents, response headers, and client-visible environment values can be inspected.

Primary risks are:

- disclosure of credentials, the private contact destination, or other non-public data;
- automated form abuse, unsolicited delivery, and provider-cost exhaustion;
- header injection, malformed input, oversized bodies, or unsafe rendered content;
- cross-origin submission and misuse of a verification result for another submission;
- duplicate or uncertain email delivery during retries;
- a deployment or external-service configuration that differs from repository assumptions;
- expansion of the runtime surface without equivalent validation, privacy, and abuse controls.

Client validation, disabled controls, consent state, and a successful widget animation improve usability but are never the server security boundary.

## Trust boundaries

### Public static surface

The Next.js application exports static HTML, JavaScript, CSS, images, and public generated content. Core pages do not require a runtime Next.js server, database, user authentication, or runtime spreadsheet request. Every file emitted under `out/` is public.

The build downloads one anonymous HTTPS XLSX source, validates it, and turns it into public generated content. Treat that workbook as untrusted public input. The generator applies download, archive, worksheet, row, field, and URL checks before static rendering. Spreadsheet text renders as ordinary React text. Do not add raw HTML or `dangerouslySetInnerHTML` for content-source text.

### Build and deployment boundary

Build-time inputs and deploy credentials belong in GitHub Actions configuration, not browser code. `PORTFOLIO_WORKBOOK_URL` is an anonymous read-only source URL stored as an Actions secret for runner-log masking. The Pages direct-upload credential is also an Actions secret. Neither value is a Cloudflare Function binding.

Generated JSON is a build input. The exported artifact and its integrity metadata are deployment outputs, not private storage. Review all build inputs as public-safe before publication.

### Contact boundary

`public/_routes.json` contains exactly:

```json
{
  "version": 1,
  "include": ["/api/contact/verify", "/api/contact"],
  "exclude": []
}
```

No other route invokes a Pages Function. The first endpoint exchanges a validated Turnstile result for a short-lived signed ticket. The second validates the contact payload and ticket before attempting email delivery. See [Contact System](CONTACT_SYSTEM.md) for the complete sequence, schemas, status codes, and timing rules.

### External providers

Cloudflare Pages and Turnstile process request and verification metadata. Resend and downstream mail systems process the delivered messages and delivery metadata. Provider-side authentication, retention, logging, domain verification, quotas, and abuse controls exist outside this repository and require separate review.

## Repository-enforced contact controls

Both handlers:

- accept only `POST` and return `405` with `Allow: POST` for other methods;
- require the base media type `application/json`, while accepting media-type parameters;
- require an exact configured `Origin` and do not implement wildcard CORS;
- limit the streamed body to 16,384 bytes before JSON parsing completes;
- require strict UTF-8 and valid JSON;
- reject invalid configuration instead of falling back to permissive values;
- return generic JSON responses with non-cacheable Function headers.

`POST /api/contact/verify` accepts a plain object with exactly `submissionId` and `turnstileToken`. It sends one JSON Siteverify request with a 5-second timeout, uses the UUID as the provider idempotency key, and includes `CF-Connecting-IP` only after bounded control-character validation. A ticket is issued only for `success: true`, action exactly `portfolio_contact`, and an exact allowed hostname.

`POST /api/contact` allows only its documented fields, rejects unknown keys and unsafe values, requires three acknowledgments to be boolean `true`, and validates the names, email, optional phone, message, timing fields, and submission UUID. The hidden honeypot and minimum-completion check are evaluated during payload parsing, before ticket validation. A non-empty honeypot or completion under 1,200 milliseconds returns a silent generic success without calling Resend. This order avoids making the low-cost bot signals an oracle. Normal provider delivery cannot begin until the signed ticket and its submission binding have been validated.

The application code does not implement a request-body timeout, whole-request timeout, client fetch timeout, or application rate limiter. Its explicit outbound timeouts are 5 seconds for Siteverify and 8 seconds for Resend. Platform limits still apply.

## Verification ticket

A successful verification sets `__Host-portfolio_contact_ticket` with `Path=/`, `Max-Age=1800`, `Secure`, `HttpOnly`, `SameSite=Strict`, and no `Domain` attribute. The ticket is host-only and available to the Functions through the browser's same-origin credentials mode.

The signed payload contains only version `1`, the submission UUID, issue time, and expiry time. It contains no contact fields. It is signed, not encrypted. The signing key is derived from `TURNSTILE_SECRET_KEY` with domain-separated HKDF-SHA-256 and used for HMAC-SHA-256.

The delivery handler rejects missing, duplicated, oversized, malformed, non-canonical, incorrectly signed, wrongly versioned, future-issued, lifetime-altered, expired, or submission-mismatched tickets. Successful delivery clears the cookie. A provider failure retains the still-valid cookie so the same delivery can be retried.

There is no server-side ticket database, consumed-ticket record, or revocation list. Ticket lifetime, exact origin, submission binding, the locked client retry body, and provider idempotency reduce replay and duplicate-delivery risk. They do not make the ticket a database-backed single-use credential. Rotating the Turnstile secret invalidates outstanding tickets.

## Email delivery, idempotency, and header safety

The delivery handler sends one two-message Resend batch with an 8-second timeout and `Idempotency-Key: portfolio-contact/<submissionId>`. The application does not keep a delivery ledger. The browser locks reviewed fields and acknowledgments after the first delivery attempt so a retry uses the same UUID, start time, consent values, and byte-equivalent JSON body.

The owner notification goes to the private configured destination and uses the validated visitor email as `reply_to`. The visitor receipt goes to the validated visitor email and uses the fixed public reply-to. Both messages use a fixed configured sender and fixed subjects. User-controlled values are validated, escaped in HTML, and also placed in plain-text alternatives.

Of the owner notification headers, the visitor controls only the validated `reply_to` value. Validated contact fields populate the message body. The sender, private destination, subject, and remaining message headers are fixed by server code and configuration. A provider timeout, network error, or non-success response becomes generic `502 delivery_failed`. Provider response bodies and message identifiers are not parsed, logged, or returned by the handlers.

Resend documents idempotent batch requests and requires an identical payload when the same key is reused. Provider behavior and retention windows remain external dependencies. See [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Privacy, storage, and logging

The contact draft stays in browser memory. It is not written by the form to local storage or session storage and is not sent in the verification request. The ticket contains only the UUID and timing metadata.

The site has no first-party contact database or storage binding. Full contact details are sent to Resend and then to the owner and visitor mail systems only after normal payload and ticket validation. The visitor receipt repeats the submitted details. Cloudflare may process network metadata, the Turnstile token, and the optional connecting IP supplied to Siteverify. Provider and mailbox retention remains governed outside this repository.

The two Function handlers contain no explicit request or provider logging. Do not add logs containing bodies, contact fields, tokens, cookie contents, provider responses, private recipient values, or credentials. If operational telemetry is added, restrict it to coarse outcomes, bounded timings, and non-sensitive aggregates.

The private recipient is a server-only encrypted binding. It is not returned in endpoint responses or compiled into the browser. The configured sender and public reply-to are intentionally public identities and must not be confused with the private destination.

The direct email link bypasses the Function-specific verification, ticket, validation, and delivery path. Messages sent through that link are handled directly by the visitor's and recipient's mail systems.

## Abuse protection and rate limiting

### Enforced in the repository

- exact Function route allowlisting;
- POST-only JSON handlers;
- exact-origin checks;
- streaming body-size, strict UTF-8, JSON, and schema validation;
- required acknowledgments and bounded field grammar;
- honeypot and timing signals;
- server-side Turnstile verification with exact action and hostname;
- a short-lived, signed, submission-bound ticket;
- locked same-payload retries and a provider idempotency key;
- generic, non-cacheable Function responses.

### Required external configuration

The repository contains no application rate limiter, rate-limit binding, `429` response path, or deployable WAF ruleset. An operator must configure and maintain a Cloudflare WAF rate-limiting rule for both exact paths, normally counted by source IP:

```text
http.request.uri.path in {"/api/contact/verify" "/api/contact"}
```

The repository cannot verify the live rule, threshold, counting characteristic, mitigation timeout, action, plan capabilities, or current effectiveness. Check those values in Cloudflare and through a controlled deployed test. A WAF rule is defense in depth and does not replace the application controls above.

Do not place an interactive Managed Challenge on either JSON endpoint. It would return an HTML challenge to a client that expects JSON and would add another interactive gate after the form's visible Turnstile step.

Cloudflare documents custom JSON rate-limit block responses as a Pro-plan-or-higher feature. If the API contract requires a JSON edge response, confirm that the active plan and selected action support it. Do not describe a custom JSON block body as a Free-plan guarantee. See [Cloudflare rate-limit custom responses](https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/#configure-a-custom-response-for-blocked-requests).

## Response headers and browser policy

`public/_headers` adds the following protections to static Pages responses:

- a Content Security Policy with `default-src 'self'`, no objects, no framing, and same-origin form actions;
- the minimum `challenges.cloudflare.com` script, frame, and connection allowances used by Turnstile;
- disabled camera, geolocation, microphone, payment, and USB permissions;
- `Referrer-Policy: strict-origin-when-cross-origin`;
- one-year HSTS;
- content-type sniffing protection and `X-Frame-Options: DENY`.

The exported application currently needs inline script and style allowances. Do not broaden third-party origins without review. Prefer nonce or hash based policies if a future delivery architecture can provide per-response CSP values.

Cloudflare Pages does not apply `_headers` rules to Function-generated responses. Both contact handlers therefore set their own `Cache-Control: no-store, max-age=0`, JSON content type, `Referrer-Policy: no-referrer`, and `X-Content-Type-Options: nosniff`. They do not currently add the static CSP, Permissions Policy, HSTS, or framing headers.

## URL and rendering rules

Accepted general content URLs are HTTPS, HTTP, valid `mailto:` links, or safe root-relative paths. Root-relative paths must reject traversal segments. Recommendation source and professional-profile links have stricter HTTPS requirements. Every accepted root-relative file under `public/` remains publicly retrievable.

External links opened in a new tab must include `rel="noopener noreferrer"`. Content-source text must remain escaped React text. An optional validated inline recommendation link may be composed from ordinary text nodes and one HTTPS anchor; do not parse content-source HTML or Markdown and do not auto-link arbitrary text.

## Environment separation

Only `NEXT_PUBLIC_TURNSTILE_SITE_KEY` is read by browser application code. It is public by design. CI maps the preview repository variable into that application variable for `develop`; the application does not read the preview variable name directly. Pull-request builds receive neither deployment key, and preview does not fall back to production.

Server-only values belong in Cloudflare Pages encrypted secrets:

- `TURNSTILE_SECRET_KEY`;
- `RESEND_API_KEY`;
- `CONTACT_RECIPIENT_EMAIL`.

Reviewed non-secret Function values belong in the correct `wrangler.jsonc` environment:

- `TURNSTILE_ALLOWED_HOSTNAMES`;
- `CONTACT_ALLOWED_ORIGINS`;
- `CONTACT_FROM_EMAIL`;
- `CONTACT_REPLY_TO_EMAIL`.

Production and preview use separate exact hostnames, origins, and appropriate credentials. The tracked local example contains placeholders only. The ignored local environment file does not cross into GitHub Actions or Cloudflare automatically. Follow [Local development](LOCAL_DEVELOPMENT.md#complete-contact-flow-development) and do not use production credentials locally.

Repository configuration can prove the intended non-secret values, but not the presence, correctness, or separation of live encrypted secrets. Verify those bindings in each Cloudflare environment without printing their values.

## Deployment security

Every production artifact must contain the exact `_routes.json` and `_headers` files. Deployment smoke testing sends unauthenticated `GET` requests to both Function paths and requires `405` JSON responses. This establishes that both routes are deployed and reject the wrong method.

The smoke test does not establish successful POST handling, exact-origin behavior, live Turnstile validation, ticket cookie acceptance, WAF state, Resend delivery, sender-domain verification, recipient correctness, or mailbox receipt. Those items require controlled deployed checks. See [Deployment](DEPLOYMENT.md) for the activation sequence.

Before publishing a build or changing repository visibility, scan tracked files, reachable Git objects, generated content, and exported artifacts for credentials, non-public contact data, unpublished assets, oversized artifacts, and unsafe configuration. Commit author and committer metadata is part of repository history. History rewriting and force-pushing are destructive operations that require separate authorization and review.

## Dependency review

Run:

```powershell
npm audit
```

Classify findings as production runtime, static-build, or development-tooling risk. Do not run forced major upgrades without reviewing compatibility and generated artifact changes.

## Adding or changing an endpoint

Before broadening the runtime surface:

1. Document the route, methods, media types, schema, body limits, trust boundaries, retention, logging, abuse cases, and failure contract.
2. Add the narrow route to `public/_routes.json` intentionally and verify the exported file.
3. Enforce server-side validation independently of the browser.
4. Set Function response headers explicitly.
5. Define secret ownership and environment separation.
6. Define repository-enforced and external rate-limit controls separately.
7. Add unit, integration, deployment-smoke, and controlled live checks appropriate to the risk.
8. Update [Contact System](CONTACT_SYSTEM.md), [Deployment](DEPLOYMENT.md), and [Security Checklist](SECURITY_CHECKLIST.md) where applicable.
