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
| Research media paths and PNG sanitation | `src/lib/content/validatePortfolioContent.ts`, `src/lib/content/researchGraphicalAbstracts.ts`, `scripts/lib/pngMetadata.mjs` |
| Contact behavior reference | `docs/CONTACT_SYSTEM.md` |

## CSV parsing boundary

CSV content is untrusted build input. `csv-parse` must resolve to `7.0.2` or later to remediate [GHSA-8cw4-87c7-c6xx](https://github.com/advisories/GHSA-8cw4-87c7-c6xx). Local CSV headers also reject empty, duplicate, and prototype-sensitive names (`__proto__`, `constructor`, and `prototype`) before the parser creates row objects. Keep this validation at the parsing boundary as defense in depth; downstream content validation is not a substitute for safe object construction.

## Research media boundary

Canonical graphical abstracts must pass the same strict, root-relative `/images/research/` path guard during generated-content validation and direct presentation resolution. The guard rejects remote and protocol-relative URLs, traversal, repeated percent-encoded traversal, backslashes, null bytes, whitespace, query strings, fragments, and unsupported extensions. Curated fallback lookup accepts only own keys in the three-project registry; invalid or incomplete canonical input fails closed instead of falling back.

Self-hosted video, captions, and transcript paths use the same fixed-point decoded local-path guard with separate extension allowlists. `researchVideos.ts` accepts its curated fallback for the exact CytoCV project ID only when canonical content is absent, and it does not expose a video unless every companion accessibility resource passes that boundary. The video asset contract opens and stats before allocating, caps the MP4 at 16 MiB and each accessibility text asset at 64 KiB, detects growth or truncation during each bounded read, parses ISO MP4 box boundaries and expected track metadata in-process, and fails closed for malformed boundaries, excess boxes, or excessive required-box traversal—without a continuous-integration dependency on an externally installed media probe. Byte hashes, strict UTF-8 decoding, complete WebVTT consumption, and LF-only accessibility-file contracts make a silent replacement or line-ending rewrite visible in review. See [Research media](RESEARCH_MEDIA.md) for the approved source statement and explicitly non-asserted license state.

Contributed PNG sanitation is a local publication tool, but its inputs remain untrusted. The CLI rejects files larger than 32 MiB from file metadata before reading. The parser independently caps input at 32 MiB, declared chunk data at 30 MiB, chunk count at 4,096, decoded image data at 64 MiB, each dimension at 16,384 pixels, and the canvas at 67,108,864 pixels. It requires nonzero dimensions, legal PNG color-type and bit-depth pairs, standard compression and filtering, supported noninterlaced or Adam7 scanlines, legal palette and critical-chunk ordering, a bounded valid zlib stream with exact filter-prefixed scanlines, consecutive nonempty image data, and a terminal `IEND`. Test-only limit overrides may lower protected ceilings but cannot raise or bypass them. Retained chunks remain byte-identical, and the sanitized output is parsed again before it can be written.
## Dependency maintenance

`package-lock.json` is the reviewed dependency graph, and CI installs it with `npm ci`. Run both `npm audit` and `npm audit --omit=dev` after a dependency change: the first covers the full quality-gate graph, while the second covers the deployed runtime graph.

ExcelJS remains exactly `4.4.0` because no newer release is available. Its only override is the nested `exceljs > uuid` `11.1.1` remediation; do not broaden that override to unrelated UUID consumers. `npm ls exceljs uuid` and the locked audit establish that the remediation resolves to `11.1.1`.

GHSA-w5hq-g745-h8pq concerns caller-buffer behavior in UUID v3, v5, and v6. The package-contract test establishes the required resolved version. The real XLSX data-bar test calls ExcelJS's UUID v4 extension path, verifies the generated identifier is serialized into worksheet XML, and verifies that ExcelJS restores the identical identifier on read. That test proves ExcelJS compatibility and serialization for the override; it does not by itself exercise or prove the advisory's v3/v5/v6 caller-buffer remediation. Re-evaluate and remove the narrow override when upgrading ExcelJS.

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

`POST /api/contact/verify` accepts a plain object with exactly `submissionId` and `turnstileToken`. Before contact fields are rendered, the browser presents a visible Turnstile gate and supplies the same submission UUID as `cData`. The handler generates a separate Siteverify operation UUID, sends it as the provider idempotency key, and reuses it only for one bounded retry of the same token after a transient failure. Each attempt has a 5-second timeout. `CF-Connecting-IP` is included only after bounded control-character validation. A ticket is issued only for `success: true`, action exactly `portfolio_contact`, an exact allowed hostname, and returned `cdata` exactly matching the submission UUID. Invalid or duplicate challenges return `400 verification_failed`; exhausted transient failures and provider integration faults return `503 verification_unavailable`. Successful server verification enables Continue and opens the form after a brief 500-millisecond success state unless the visitor continues sooner.

`POST /api/contact` allows only its documented fields, rejects unknown keys and unsafe values, requires both acknowledgments to be boolean `true`, limits the message to 500 characters, and validates the names, email, optional phone, timing fields, and submission UUID. The hidden honeypot and minimum-completion check are evaluated during payload parsing, before ticket validation. A non-empty honeypot or completion under 1,200 milliseconds returns a silent generic success without calling DNS, D1, or Resend. This order avoids making the low-cost bot signals an oracle. The browser records the form-start time when the verified form opens, so time at the gate does not satisfy the completion threshold. Normal provider delivery cannot begin until the signed ticket and its submission binding, the mail-domain route, and a D1 quota reservation have been validated.

The application code does not implement a request-body timeout, whole-request timeout, or client fetch timeout. Its bounded outbound work covers Siteverify, mail-domain DNS queries, and each Resend request. Platform limits still apply.

## Verification ticket

A successful verification sets `__Host-portfolio_contact_ticket` with `Path=/`, `Max-Age=1800`, `Secure`, `HttpOnly`, `SameSite=Strict`, and no `Domain` attribute. The ticket is host-only and available to the Functions through the browser's same-origin credentials mode.

The signed payload contains only version `1`, the submission UUID, issue time, and expiry time. It contains no contact fields. It is signed, not encrypted. The signing key is derived from `TURNSTILE_SECRET_KEY` with domain-separated HKDF-SHA-256 and used for HMAC-SHA-256.

The delivery handler rejects missing, duplicated, oversized, malformed, non-canonical, incorrectly signed, wrongly versioned, future-issued, lifetime-altered, expired, or submission-mismatched tickets. Successful delivery clears the cookie. A provider failure retains the still-valid cookie so the same delivery can be retried. If the ticket expires, the browser returns to the visible gate. For an ambiguous or partial provider attempt, a successful refresh keeps the original submission UUID, start time, acknowledgment values, and byte-equivalent payload, returns to locked review, and never starts delivery automatically.

There is no server-side ticket database, consumed-ticket record, or revocation list. D1 recognizes the UUID only for quota and same-address, same-payload retry handling; it does not mark the ticket consumed or record final mail delivery. Ticket lifetime, exact origin, submission binding, the locked client retry body, and provider idempotency reduce replay and duplicate-delivery risk. They do not make the ticket a database-backed single-use credential. Rotating the Turnstile secret invalidates outstanding tickets and changes the separately derived address and payload HMAC keys.

## Mail-domain and quota controls

After payload and ticket validation, bounded DNS MX lookup checks the submitted email domain. A domain with no MX result may use the documented A/AAAA fallback, while an explicit null MX is rejected. DNS failure is separated from an unroutable result so a resolver outage produces a retryable service error rather than incorrectly labeling the address invalid. This is domain-route validation, not proof that a mailbox exists or is controlled by the submitter.

The delivery handler then reserves one of two slots for the normalized email address in a rolling 24-hour window. It computes HMAC-SHA-256 over `email.trim().toLowerCase()` and a separate HMAC-SHA-256 fingerprint over the normalized full delivery payload, using keys derived from `TURNSTILE_SECRET_KEY` with distinct HKDF contexts. The `CONTACT_RATE_LIMIT_DB` row contains only the opaque submission UUID, keyed address hash, opaque keyed payload fingerprint, reservation epoch seconds, and expiry epoch seconds. It contains no raw address, name, phone number, or message. No provider-specific alias normalization occurs.

Expired records are deleted during reservation work. An existing submission UUID is a free retry only when the keyed address and keyed payload fingerprint both match; changed payload or address reuse is rejected. The reservation is created before Resend and remains after provider failure, so repeated failures cannot evade the two-slot limit. D1 errors and a missing binding fail closed. Production and preview use distinct remote databases, while local Pages development uses isolated local persistence.

## Email delivery, idempotency, and header safety

The delivery handler sends the visitor confirmation through Resend first with `Idempotency-Key: portfolio-contact/visitor/<submissionId>`. Only after that request is accepted does it send the owner notification with `Idempotency-Key: portfolio-contact/owner/<submissionId>`. The browser locks the reviewed payload during delivery and rejects repeated Send actions. A `verification_required` response preserves the draft and returns to the visible gate before another delivery attempt. After an ambiguous or partial delivery failure, the browser preserves the same UUID, original start time, consent values, and byte-equivalent JSON body through any ticket refresh. If the owner request fails, repeating the accepted visitor request returns its idempotent result before the owner request is retried. After success, the browser clears the draft and verification state and shows a standalone completion view. Selecting <em>Send another message</em> creates a new draft identity and gate; a new start time is recorded only when its verified form opens.

Every new logical message requires a fresh, single-use Turnstile token. A still-valid 30-minute ticket skips repeated Turnstile verification only for the same locked delivery retry. It cannot authorize a new outbound message.

The owner notification goes to the private configured destination and uses the validated visitor email as `reply_to`. The visitor confirmation goes to the validated visitor email and uses the fixed public reply-to. Both messages use a fixed configured sender and server-controlled subjects. User-controlled values are validated, escaped in HTML, and also placed in plain-text alternatives.

Of the owner notification address headers, the visitor controls only the validated `reply_to` value. Validated contact fields populate the message body, and the already control-character-checked names populate a server-defined subject format. The sender, private destination, subject format, and remaining message headers are controlled by server code and configuration. A provider timeout, network error, or non-success response becomes generic `502 delivery_failed`. Provider response bodies and message identifiers are not parsed, logged, or returned by the handlers.

Resend requires an identical payload when the same key is reused. Provider API acceptance does not establish mailbox ownership or final delivery, and a receiving system may later reject or bounce a message. Provider behavior and retention windows remain external dependencies. See [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

## Privacy, storage, and logging

The contact draft stays in browser memory. It is not written by the form to local storage or session storage and is not sent in the verification request. The ticket contains only the UUID and timing metadata.

Full contact submissions are not stored in a first-party database. The narrow D1 binding stores only the opaque submission UUID, keyed normalized-email hash, opaque keyed full-payload fingerprint, and reservation and expiry times for quota and retry enforcement. An expired row no longer counts and is removed by later reservation cleanup, although physical cleanup and provider backups remain subject to platform behavior. Full contact details are sent to Resend and then to the visitor and owner mail systems only after normal validation and reservation. The visitor confirmation repeats the submitted details. Cloudflare may process network metadata, the Turnstile token, and the optional connecting IP supplied to Siteverify; DNS infrastructure processes the mail domain. Provider and mailbox retention remains governed outside this repository.

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
- fresh server-side Turnstile verification for each new logical message with exact action, hostname, and submission custom data;
- one bounded same-operation retry for transient Siteverify failure;
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

Do not place an interactive Managed Challenge on either JSON endpoint. It would return an HTML challenge to a client that expects JSON and would add a second gate after the visible browser Turnstile check.

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

The `CONTACT_RATE_LIMIT_DB` D1 binding is also environment-specific reviewed configuration. Production and preview use distinct pinned database IDs, and both must have the tracked migrations applied before their Pages deployment. Missing, all-zero, and shared IDs remain non-deployable invalid states.

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
