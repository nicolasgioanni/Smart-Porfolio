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
| Contact-rate reservation schema | `migrations/` |
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

Cloudflare Pages, D1, and Turnstile process request, pseudonymous quota, and verification data. DNS resolution processes the domain portion of a submitted address. Resend and downstream mail systems process the delivered messages and delivery metadata. Provider-side authentication, retention, logging, sender-domain verification, quotas, and abuse controls exist outside this repository and require separate review.

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

`POST /api/contact` allows only its documented fields, rejects unknown keys and unsafe values, requires three acknowledgments to be boolean `true`, and validates the names, email, optional phone, message, timing fields, and submission UUID. The hidden honeypot and minimum-completion check are evaluated during payload parsing, before ticket validation. A non-empty honeypot or completion under 1,200 milliseconds returns a silent generic success without calling DNS, D1, or Resend. This order avoids making the low-cost bot signals an oracle. Normal provider delivery cannot begin until the signed ticket and its submission binding, the mail-domain route, and a D1 quota reservation have been validated.

The application code does not implement a request-body timeout, whole-request timeout, or client fetch timeout. Its bounded outbound work covers Siteverify, mail-domain DNS queries, and each Resend request. Platform limits still apply.

## Verification ticket

A successful verification sets `__Host-portfolio_contact_ticket` with `Path=/`, `Max-Age=1800`, `Secure`, `HttpOnly`, `SameSite=Strict`, and no `Domain` attribute. The ticket is host-only and available to the Functions through the browser's same-origin credentials mode.

The signed payload contains only version `1`, the submission UUID, issue time, and expiry time. It contains no contact fields. It is signed, not encrypted. The signing key is derived from `TURNSTILE_SECRET_KEY` with domain-separated HKDF-SHA-256 and used for HMAC-SHA-256.

The delivery handler rejects missing, duplicated, oversized, malformed, non-canonical, incorrectly signed, wrongly versioned, future-issued, lifetime-altered, expired, or submission-mismatched tickets. Successful delivery clears the cookie. A provider failure retains the still-valid cookie so the same delivery can be retried. If that ticket expires after an ambiguous or partial provider attempt, the browser obtains a new ticket for the original submission UUID instead of creating a new delivery identity.

There is no server-side ticket database, consumed-ticket record, or revocation list. D1 recognizes the UUID only for quota and same-address retry handling; it does not mark the ticket consumed or record final mail delivery. Ticket lifetime, exact origin, submission binding, the locked client retry body, and provider idempotency reduce replay and duplicate-delivery risk. They do not make the ticket a database-backed single-use credential. Rotating the Turnstile secret invalidates outstanding tickets and changes the separately derived quota-hash key.

## Mail-domain and quota controls

After payload and ticket validation, bounded DNS MX lookup checks the submitted email domain. A domain with no MX result may use the documented A/AAAA fallback, while an explicit null MX is rejected. DNS failure is separated from an unroutable result so a resolver outage produces a retryable service error rather than incorrectly labeling the address invalid. This is domain-route validation, not proof that a mailbox exists or is controlled by the submitter.

The delivery handler then reserves one of two slots for the normalized email address in a rolling 24-hour window. It computes HMAC-SHA-256 over `email.trim().toLowerCase()` using a key derived from `TURNSTILE_SECRET_KEY` with a distinct HKDF context. The `CONTACT_RATE_LIMIT_DB` row contains only the opaque submission UUID, keyed hash, reservation epoch seconds, and expiry epoch seconds. It contains no raw address, name, phone number, or message. No provider-specific alias normalization occurs.

Expired records are deleted during reservation work. An existing submission UUID with the same keyed address is a free retry; reuse with a different address is rejected. The reservation is created before Resend and remains after provider failure, so repeated failures cannot evade the two-slot limit. D1 errors and a missing binding fail closed. Production and preview use distinct remote databases, while local Pages development uses isolated local persistence.

## Email delivery, idempotency, and header safety

The delivery handler sends the visitor confirmation through Resend first with `Idempotency-Key: portfolio-contact/visitor/<submissionId>`. Only after that request is accepted does it send the owner notification with `Idempotency-Key: portfolio-contact/owner/<submissionId>`. A first `verification_required` response before provider ambiguity clears the UUID and permits an unlocked new verified session. After an ambiguous or partial delivery failure, the browser instead locks the reviewed fields and acknowledgments and preserves the same UUID, start time, consent values, and byte-equivalent JSON body through any ticket refresh. If the owner request fails, repeating the accepted visitor request returns its idempotent result before the owner request is retried. After success, the browser clears the draft and verification state, returns to the gate, and keeps the green success notice visible until the visitor explicitly starts another verification.

The owner notification goes to the private configured destination and uses the validated visitor email as `reply_to`. The visitor confirmation goes to the validated visitor email and uses the fixed public reply-to. Both messages use a fixed configured sender and server-controlled subjects. User-controlled values are validated, escaped in HTML, and also placed in plain-text alternatives.

Of the owner notification address headers, the visitor controls only the validated `reply_to` value. Validated contact fields populate the message body, and the already control-character-checked names populate a server-defined subject format. The sender, private destination, subject format, and remaining message headers are controlled by server code and configuration. A provider timeout, network error, or non-success response becomes generic `502 delivery_failed`. Provider response bodies and message identifiers are not parsed, logged, or returned by the handlers.

Resend requires an identical payload when the same key is reused. Provider API acceptance does not establish mailbox ownership or final delivery, and a receiving system may later reject or bounce a message. Provider behavior and retention windows remain external dependencies. See [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Privacy, storage, and logging

The contact draft stays in browser memory. It is not written by the form to local storage or session storage and is not sent in the verification request. The ticket contains only the UUID and timing metadata.

Full contact submissions are not stored in a first-party database. The narrow D1 binding stores only the opaque submission UUID, keyed normalized-email hash, and reservation and expiry times for quota enforcement. An expired row no longer counts and is removed by later reservation cleanup, although physical cleanup and provider backups remain subject to platform behavior. Full contact details are sent to Resend and then to the visitor and owner mail systems only after normal validation and reservation. The visitor confirmation repeats the submitted details. Cloudflare may process network metadata, the Turnstile token, and the optional connecting IP supplied to Siteverify; DNS infrastructure processes the mail domain. Provider and mailbox retention remains governed outside this repository.

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
- bounded mail-domain DNS validation;
- a keyed two-per-address rolling 24-hour D1 quota;
- locked same-payload retries and separate provider idempotency keys;
- generic, non-cacheable Function responses.

### Required external configuration

The repository-enforced D1 quota is keyed to the visitor-supplied email address, so aliases and addresses belonging to someone else remain abuse possibilities. An operator must also configure and maintain a Cloudflare WAF rate-limiting rule for both exact paths, normally counted by source IP:

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

The `CONTACT_RATE_LIMIT_DB` D1 binding is also environment-specific reviewed configuration. Production and preview must use distinct database IDs, and both must have the tracked migrations applied before their Pages deployment. The all-zero IDs in the tracked configuration are non-deployable setup sentinels, not live resources.

Production and preview use separate exact hostnames, origins, and appropriate credentials. The tracked local example contains placeholders only. The ignored local environment file does not cross into GitHub Actions or Cloudflare automatically. Follow [Local development](LOCAL_DEVELOPMENT.md#complete-contact-flow-development) and do not use production credentials locally.

Repository configuration can prove the intended non-secret values, but not the presence, correctness, or separation of live encrypted secrets. Verify those bindings in each Cloudflare environment without printing their values.

## Deployment security

Every production artifact must contain the exact `_routes.json` and `_headers` files. Deployment smoke testing sends unauthenticated `GET` requests to both Function paths and requires `405` JSON responses. This establishes that both routes are deployed and reject the wrong method.

The smoke test does not establish successful POST handling, exact-origin behavior, live Turnstile validation, ticket cookie acceptance, D1 migration state, DNS behavior, WAF state, Resend delivery, sender-domain verification, recipient correctness, or mailbox receipt. Those items require controlled deployed checks. See [Deployment](DEPLOYMENT.md) for the activation sequence.

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
