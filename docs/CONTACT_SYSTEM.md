# Contact System

The Contact route is a statically exported page with two narrowly routed Cloudflare Pages Functions. The visitor completes a three-step contact wizard before Turnstile runs during the final Send action. A successful verification creates a short-lived signed ticket, and the immediate delivery request uses that ticket instead of submitting the Turnstile token again.

Use this guide for the complete request contract and trust boundary. See [Security](SECURITY.md) for the broader threat model, [Deployment](DEPLOYMENT.md) for production setup, and [Local development](LOCAL_DEVELOPMENT.md#complete-contact-flow-development) for local Pages Function testing.

## Source of truth

| Concern | Authoritative source |
| --- | --- |
| Static Contact route and metadata | `src/app/contact/page.tsx` |
| Wizard state, requests, retries, and acknowledgments | `src/components/contact/ContactForm.tsx` |
| Browser field validation | `src/components/contact/contactFormValidation.ts` |
| Turnstile widget options | `src/components/contact/TurnstileWidget.tsx` |
| Shared schemas, ticket, provider calls, and response headers | `functions/_shared/contact.ts` |
| Verification handler | `functions/api/contact/verify.ts` |
| Delivery handler | `functions/api/contact.ts` |
| Function route allowlist | `public/_routes.json` |
| Static response headers | `public/_headers` |
| Production and preview non-secret values | `wrangler.jsonc` |
| Contact-rate reservation schema | `migrations/` |
| Build-time site-key selection | `.github/workflows/ci.yml` |

Implementation and configuration are authoritative when prose differs from the current code.

## Request lifecycle

```mermaid
sequenceDiagram
    actor Visitor
    participant Browser
    participant Verify as /api/contact/verify
    participant Turnstile as Cloudflare Siteverify
    participant Deliver as /api/contact
    participant DNS as DNS resolver
    participant D1 as Cloudflare D1
    participant Resend

    Visitor->>Browser: Enter details, review, acknowledge, and select Send
    Browser->>Browser: Lock payload and execute prepared widget
    opt Cloudflare requires interaction
        Browser-->>Visitor: Show interaction-only challenge
        Visitor->>Browser: Complete challenge
    end
    Browser->>Verify: POST token and submission UUID
    Verify->>Turnstile: Validate token with operation UUID and optional IP
    Turnstile-->>Verify: Verification result
    opt Transient provider failure
        Verify->>Turnstile: Retry same token and operation UUID once
        Turnstile-->>Verify: Verification result
    end
    Verify->>Verify: Require success, action, hostname, and matching cdata
    Verify-->>Browser: 200 and signed HttpOnly ticket cookie
    Browser->>Deliver: POST contact JSON with same UUID and cookie
    Deliver->>Deliver: Validate body, timing, ticket, and binding
    Deliver->>DNS: Validate mail-domain routing
    DNS-->>Deliver: MX or address-routing result
    Deliver->>D1: Reserve one of two rolling 24-hour slots
    D1-->>Deliver: New or same-ID reservation
    Deliver->>Resend: Idempotent visitor confirmation
    Resend-->>Deliver: Accepted
    Deliver->>Resend: Idempotent owner notification
    Resend-->>Deliver: Accepted
    Deliver-->>Browser: 200 and clear cookie, or retryable failure
```

The two endpoint calls use `credentials: "same-origin"`, so the browser can accept and later send the host-only ticket cookie. Contact fields are not included in the verification request.

## Client experience

### Route and final-submit verification

`/contact` is static HTML with a hydrated client form. Its metadata is `noindex, follow`. The route reads `NEXT_PUBLIC_TURNSTILE_SITE_KEY` at build time. When the selected build has no site key, the widget is unavailable and the final Send action remains disabled.

The explicit Turnstile widget uses:

- action `portfolio_contact`;
- appearance `interaction-only`;
- execution `execute`;
- the current submission UUID as `cData`;
- flexible sizing;
- light widget styling only for the Light site theme, and dark styling for Navy and Dark;
- manual token refresh and retry behavior so the client controls recovery;
- no hidden Turnstile response field because the token is sent in explicit JSON.

The widget script loads from Cloudflare after hydration, and the widget is prepared while the review step is active. It executes only after all final fields and acknowledgments pass validation and the visitor selects <em>Send request</em>. The interaction-only appearance keeps it hidden unless Cloudflare requires visitor input. Expiry, timeout, widget, script, and unsupported-browser callbacks clear the token and fail closed. The reviewed values remain available, and the visitor explicitly selects Send again after recovery rather than entering an automatic verification loop.

Each new logical draft receives a cryptographically random submission UUID and a new form-start time. The form-start time is not reset after verification. The UUID binds the reviewed payload, Turnstile custom data, signed ticket, D1 retry identity, and Resend idempotency keys. When the executed widget supplies a fresh token, the browser posts only that UUID and token to `/api/contact/verify`. A verified response continues the same locked Send action to `/api/contact`.

### Three wizard steps

The progress UI uses steps `1` through `3`:

1. Enter required first and last names.
2. Enter a required email address and message, plus an optional phone number.
3. Review the request and accept all three required acknowledgments.

The acknowledgments cover permission to respond, the Terms and Privacy Notice, and confirmation that the inquiry is legitimate and contains no prohibited material. The Send request button remains disabled until all three values are true and the Turnstile widget is prepared, unless a still-valid ticket permits a same-payload delivery retry.

Draft contact values live only in React state. The contact form does not read or write local storage or session storage. The hidden `website` field is a honeypot. A direct `mailto:` link remains available when the form or delivery service cannot be used.

Successful delivery replaces the wizard with a standalone completion view. Its <em>Send another message</em> action creates a fresh draft identity and form-start time before returning to the first step.

### Submission and retry states

The browser validates and trims the visible fields, freezes the reviewed payload during verification and delivery, and sends the final JSON to `/api/contact` only after `/api/contact/verify` succeeds. It does not send the Turnstile token to the delivery endpoint.

The review Back button, repeat Send actions, and acknowledgment controls are locked while verification or delivery is active. A pre-delivery correction or service result can unlock the form because no email-provider request was made. After a provider or delivery-network failure makes the outcome ambiguous or partial, the browser keeps the reviewed payload locked for safe retry. It preserves the original submission UUID, `startedAt` value, acknowledgments, and byte-equivalent JSON payload. This matches Resend's requirement that a repeated idempotency key use the same request payload.

Client behavior depends on the response:

| Result | Client behavior |
| --- | --- |
| Verification succeeds | Retain the UUID and continue the same locked final Send action to delivery. |
| Challenge is invalid, expires, or cannot complete | Reset or recreate the widget, preserve the reviewed fields, remain on review, and require an explicit Send retry. |
| Verification is transiently unavailable after its bounded retry | Preserve the reviewed fields, remain on review, and show a retryable service notice. No delivery request starts. |
| Delivery returns `verification_required` before any ambiguous or partial delivery | Preserve the draft on review and require a fresh final-submit verification before a new delivery attempt. |
| Delivery returns `verification_required` after an ambiguous or partial delivery | Keep the reviewed payload locked and preserve the original UUID and `startedAt`. A fresh token refreshes only the ticket, and the later delivery retry reuses the UUID so both Resend idempotency keys and the request body remain unchanged. |
| Delivery returns `invalid_email` | Return to the editable details step and show the red correction notice. No quota slot or email is created. |
| Delivery returns `rate_limited` | Keep the form editable and show the red rolling-limit notice. Honor the response's `Retry-After` value. |
| DNS validation is temporarily unavailable | Keep the form editable and show a red retry notice. No quota slot or email is created. |
| Configuration or quota storage is unavailable | Show a red service failure notice and fail closed without email delivery. |
| Provider or delivery network failure | Stay on the locked review step and allow a same-payload retry with the current ticket and UUID. |
| Delivery succeeds | Clear the draft and verification state, then show the standalone green completion view including the submitted email address. Create a fresh draft only after the visitor selects <em>Send another message</em>. |

## Endpoint contract

Both handlers use the same request envelope rules:

- HTTP method must be `POST`. Other methods return `405` and `Allow: POST`.
- Required environment configuration is checked immediately after the method, before origin, media-type, or body validation.
- The media type, after removing parameters and normalizing case, must be `application/json`.
- The `Origin` header is mandatory and must exactly match a normalized configured origin. Missing, `null`, malformed, or unlisted origins are rejected. No wildcard and no CORS response are implemented.
- Both handlers enforce a 16,384-byte limit from `Content-Length` when present and from the bytes actually streamed. This happens before JSON parsing completes.
- The byte stream must be valid UTF-8 and valid JSON.
- A configured allowlist is valid only when every comma-separated entry is valid. One malformed origin or hostname makes the corresponding configuration check fail closed.

The handlers do not implement a request-body timeout, whole-request timeout, or client-side fetch timeout. Cloudflare platform limits still apply. Bounded timeouts apply to Siteverify, mail-domain DNS validation, and each Resend request.

### `POST /api/contact/verify`

The body must be a plain object with exactly these two keys:

| Field | Requirement |
| --- | --- |
| `submissionId` | Trimmed UUID with a supported UUID version and standard variant. |
| `turnstileToken` | Trimmed, non-empty string of at most 2,048 characters without unsafe control characters. |

The handler checks required Turnstile configuration before origin, media-type, and body validation. It sends the token as JSON to `https://challenges.cloudflare.com/turnstile/v0/siteverify` with:

- the server-only secret;
- the token;
- a separate Siteverify operation UUID as `idempotency_key`;
- `CF-Connecting-IP` as `remoteip` only when the header is non-empty, at most 64 characters, and free of unsafe control characters.

Each Siteverify attempt has a 5-second timeout. A network failure, timeout, HTTP `408`, HTTP `429`, HTTP `5xx`, provider `internal-error`, malformed JSON, or malformed provider response receives one bounded retry of the same token with the same operation UUID. The operation UUID is scoped to that verification operation and is not the submission identity. It is never reused for a new token. Provider configuration, request-contract, and unknown structured errors fail as unavailable without retrying an error that requires operator correction.

A ticket is issued only when the provider response is successful, parses as JSON, contains `success: true`, contains action exactly `portfolio_contact`, reports a hostname in the exact configured allowlist, and returns `cdata` exactly matching the submitted UUID. An invalid or duplicate challenge, or a successful response with an action, hostname, or custom-data mismatch, returns `400 verification_failed`. Exhausted transient failures and provider integration faults return `503 verification_unavailable`. The repository does not inspect `challenge_ts`.

Cloudflare documents Turnstile tokens as single-use, valid for five minutes, and limited to 2,048 characters. See [Turnstile server-side validation](https://developers.cloudflare.com/turnstile/get-started/server-side-validation/).

### `POST /api/contact`

The delivery handler allows only the following keys. Unknown keys are rejected. The client always sends every key; the server permits `phone` to be omitted and normalizes it to an empty string.

| Field | Server requirement |
| --- | --- |
| `submissionId` | Required trimmed UUID matching the signed ticket. |
| `firstName` | Required trimmed text, at most 80 characters. |
| `lastName` | Required trimmed text, at most 80 characters. |
| `email` | Required trimmed address, at most 254 characters. It must have one `@`, a valid local part of at most 64 characters, and a dot-bearing DNS-style domain. After ticket validation, the domain must also advertise a usable mail route through MX or the documented A/AAAA fallback. |
| `phone` | Optional string, trimmed, at most 40 characters. A non-empty value may use the supported international-friendly character set and must contain 7 to 20 digits. |
| `message` | Required text, normalized to line-feed newlines, trimmed, and at most 3,000 characters. |
| `contactConsent` | Must be boolean `true`. |
| `legalConsent` | Must be boolean `true`. |
| `legitimateConsent` | Must be boolean `true`. |
| `startedAt` | Required safe integer timestamp in milliseconds. |
| `website` | Required honeypot string, at most 200 characters, and empty after trimming for a legitimate submission. |

Names, phone numbers, messages, and tokens reject unsafe ASCII control characters. Tabs and line endings remain available where their field grammar otherwise permits them. Email addresses reject all whitespace.

The handler evaluates the honeypot and timing signals while parsing the payload, before ticket validation:

- a non-empty honeypot returns generic `200 {"ok":true}` without email delivery;
- completion in less than 1,200 milliseconds returns the same generic success without email delivery;
- a timestamp more than 30 seconds in the future or more than two hours old is invalid;
- normal browser sessions are also limited by the shorter 30-minute verification ticket lifetime.

The silent success response prevents these low-cost bot signals from becoming a tuning oracle. It also means `200` is intentionally not proof that a honeypot or implausibly fast request produced email.

For a normal verified request, the server performs bounded DNS validation before creating a quota reservation. An explicit nonexistent domain, null MX, or domain with neither usable MX nor address fallback returns `422 invalid_email`. A timeout, transient resolver failure, or indeterminate result returns `503 email_validation_unavailable`. DNS validation establishes domain routing only; it cannot prove that the mailbox exists, is deliverable, or belongs to the submitter.

## Verification ticket

Successful Siteverify validation sets `__Host-portfolio_contact_ticket`. The cookie has:

- `Path=/`;
- `Max-Age=1800`;
- `Secure`;
- `HttpOnly`;
- `SameSite=Strict`;
- no `Domain` attribute, making it host-only.

The ticket payload contains only schema version `1`, the submission UUID, an issued-at timestamp, and an expiry timestamp. It contains no contact fields. The payload is signed, not encrypted, but its contents are opaque identifiers and timing metadata rather than the message or contact details.

The signing key is derived from `TURNSTILE_SECRET_KEY` with domain-separated HKDF-SHA-256, then used for HMAC-SHA-256. No additional ticket secret is configured. The delivery endpoint rejects an absent ticket, duplicate cookie name, malformed or non-canonical encoding, oversized ticket, wrong signature size, invalid signature, wrong version, future-issued ticket beyond the 30-second allowance, altered lifetime, expired ticket, or mismatched submission UUID.

The application has no server-side ticket store, consumed-ticket record, or revocation list. The D1 quota row recognizes a submission UUID for same-address retries, but it is not a record of ticket consumption or final mail delivery. Successful delivery instructs the browser to clear the cookie. A failed delivery leaves it intact until expiry. Provider idempotency, the locked retry payload, exact origin enforcement, and the short lifetime limit duplicate-delivery risk; they do not turn the ticket itself into a database-backed single-use credential. Rotating `TURNSTILE_SECRET_KEY` invalidates outstanding tickets and changes the derived quota-hash key.

## Mail-domain validation and rolling quota

After payload and ticket validation, the handler validates only the domain portion of the normalized email address through bounded DNS lookups. It prefers MX records and falls back to A and AAAA only when the domain has no MX result. A null MX explicitly rejects mail. Resolver outages fail as a retryable service condition instead of treating the address as invalid.

Before calling Resend, the handler atomically reserves a slot in the `CONTACT_RATE_LIMIT_DB` D1 binding. The `contact_rate_reservations` table contains only:

| Column | Stored value |
| --- | --- |
| `submission_id` | Opaque submission UUID and primary key. |
| `email_hash` | HMAC-SHA-256 of `email.trim().toLowerCase()`. |
| `reserved_at` | Reservation time as Unix epoch seconds. |
| `expires_at` | Rolling-window expiry as Unix epoch seconds. |

The HMAC key is derived from `TURNSTILE_SECRET_KEY` with its own domain-separated HKDF context. No provider-specific dot removal or plus-alias rewriting occurs. D1 never receives the raw email address, name, phone number, or message.

Expired rows are removed during reservation cleanup. Fewer than two unexpired rows for an email hash permits a new reservation; a third returns `429 rate_limited` with `Retry-After` set to the remaining time until the earliest applicable expiry. Reusing the same submission UUID with the same email hash is a free retry. Reusing it with a different hash is rejected. A reservation is created before provider delivery and remains after a provider or network failure, while same-ID retries consume no additional slot. Missing or unavailable D1 configuration fails closed with `503 service_unavailable`.

## Email delivery and idempotency

After DNS validation and quota reservation, the handler makes up to two sequential `POST https://api.resend.com/emails` requests with server-only bearer authorization and bounded timeouts. It sends the visitor confirmation first and sends the owner notification only after Resend accepts the confirmation request:

| Message | Destination | Reply-to | Content |
| --- | --- | --- | --- |
| Visitor confirmation | Validated visitor email | Fixed public `CONTACT_REPLY_TO_EMAIL` | Professional navy receipt with submitted name, email, optional phone, message, correction instructions, and absolute Privacy and Terms links. |
| Owner notification | Private `CONTACT_RECIPIENT_EMAIL` | Validated visitor email | Compact name, clickable email, optional phone or “Not provided,” and message. |

Both messages use the configured `CONTACT_FROM_EMAIL` sender. The visitor subject is `I received your message!`; the owner subject is `New contact request from {FirstName} {LastName}` using already validated names. User-controlled HTML is escaped before it enters inline-styled, email-safe HTML, and both messages include plain-text alternatives. The visitor template contains no external images or tracking pixels. For the owner notification, the visitor controls only the validated `reply_to`; the sender, private owner destination, and remaining headers are fixed.

The visitor request uses `Idempotency-Key: portfolio-contact/visitor/<submissionId>` and the owner request uses `Idempotency-Key: portfolio-contact/owner/<submissionId>`. If the owner request fails after visitor acceptance, the browser keeps its locked payload and still-valid ticket; a retry repeats both calls, and the visitor key returns the original accepted result before the owner call is retried. If the ticket expires first, the browser refreshes verification with the original UUID and then repeats the same locked delivery request, preserving both provider keys and the byte-equivalent body. Resend currently documents a 24-hour idempotency window, returns the original result for an identical retry, and rejects reuse of the same key with a different payload. See [Resend idempotency keys](https://resend.com/docs/dashboard/emails/idempotency-keys).

Any network failure, timeout, or non-success provider response becomes `502 delivery_failed`. The handler reads only what it needs to establish provider acceptance and does not return provider response bodies or email identifiers. Acceptance is not mailbox verification: asynchronous rejection or bounce can still occur after the API call succeeds.

## Responses and headers

| Condition | Status | JSON error |
| --- | ---: | --- |
| Unsupported method | `405` | `method_not_allowed` |
| Missing or invalid required configuration | `503` | `service_unavailable` |
| Missing, malformed, or unlisted origin | `403` | `request_rejected` |
| Media type other than JSON | `415` | `unsupported_media_type` |
| Body over 16 KiB | `413` | `request_too_large` |
| Malformed JSON or invalid schema | `400` | `invalid_request` |
| Invalid Turnstile challenge or action, hostname, or custom-data mismatch | `400` | `verification_failed` |
| Exhausted transient Turnstile failure or provider integration fault | `503` | `verification_unavailable` |
| Missing, invalid, expired, or mismatched ticket | `401` | `verification_required` |
| Unroutable or null-MX email domain | `422` | `invalid_email` |
| Two active reservations for the normalized address | `429` | `rate_limited`, with `Retry-After` |
| DNS lookup unavailable or indeterminate | `503` | `email_validation_unavailable` |
| Resend failure or timeout | `502` | `delivery_failed` |
| Accepted verification or delivery | `200` | none; body is `{"ok":true}` |
| Honeypot or implausibly fast delivery request | `200` | none; body is `{"ok":true}` without provider delivery |

Every Function response sets:

- `Cache-Control: no-store, max-age=0`;
- `Content-Type: application/json; charset=utf-8`;
- `Referrer-Policy: no-referrer`;
- `X-Content-Type-Options: nosniff`.

Cloudflare Pages does not apply `public/_headers` rules to Function-generated responses. Static pages receive the broader Content Security Policy, Permissions Policy, HSTS, framing, referrer, and content-type protections declared there. See [Cloudflare Pages custom headers](https://developers.cloudflare.com/pages/configuration/headers/).

## Configuration

### Browser build values

| Variable | Exposure and behavior |
| --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Public and compiled into the browser bundle. A blank value makes the form unavailable. |
| `NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY` | GitHub repository variable used only by CI. The preview build maps it into `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; application code does not read the preview name directly. |

Pull-request builds receive neither deployment site key. Production and preview builds do not fall back to one another.

### Function values

| Variable | Storage | Required by |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Encrypted Cloudflare secret | Verification and ticket validation for delivery |
| `RESEND_API_KEY` | Encrypted Cloudflare secret | Delivery only |
| `CONTACT_RECIPIENT_EMAIL` | Encrypted Cloudflare secret | Delivery only |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Reviewed Wrangler variable | Verification only |
| `CONTACT_ALLOWED_ORIGINS` | Reviewed Wrangler variable | Both endpoints |
| `CONTACT_FROM_EMAIL` | Reviewed Wrangler variable | Delivery only |
| `CONTACT_REPLY_TO_EMAIL` | Reviewed Wrangler variable | Delivery only |
| `CONTACT_RATE_LIMIT_DB` | Environment-specific D1 binding | Delivery quota and retry identity only |

`/api/contact/verify` can issue a ticket when delivery configuration is unavailable because it requires only the Turnstile secret, valid hostname allowlist, and valid origin allowlist. `/api/contact` does not need the hostname allowlist after a ticket exists, but it still needs the Turnstile secret to verify the ticket signature.

The production Wrangler values allow the assigned Pages hostname, the apex custom hostname, and its `www` hostname with matching HTTPS origins. The preview override allows only the stable `develop` Pages hostname and its HTTPS origin. Production and preview declare separate reviewed D1 database names and live IDs. If either database is deliberately replaced, update only that environment's ID and apply its tracked migrations before deployment. Secret values are configured separately in Cloudflare and are not present in `wrangler.jsonc`, so the repository cannot prove that they exist or are correct in a live environment.

For local testing, copy the placeholder-only example into the ignored local environment file and follow [Local development](LOCAL_DEVELOPMENT.md#complete-contact-flow-development). Do not use production credentials locally.

## Abuse protection: enforced and external controls

### Enforced by repository code

- exact Function route allowlisting;
- POST-only JSON handlers;
- mandatory exact origin;
- streaming body-size and UTF-8/JSON validation;
- strict schemas and unknown-field rejection;
- required acknowledgments and field validation;
- honeypot and completion-time signals;
- one fresh server-side Turnstile validation per new logical message with exact action, hostname, and submission custom data;
- one bounded same-operation retry for transient Siteverify failure;
- signed, short-lived, submission-bound ticket;
- bounded mail-domain DNS validation;
- pseudonymous two-per-address rolling 24-hour D1 quota;
- separate provider idempotency keys and locked same-payload retries;
- generic, non-cacheable Function responses.

### External operator requirement

The D1 quota is address-based and therefore does not replace an IP- or network-based edge control. Production also requires an operator-managed Cloudflare rate-limit rule covering both exact paths, normally counted by source IP:

```text
http.request.uri.path in {"/api/contact/verify" "/api/contact"}
```

The live WAF state cannot be verified from this repository. Confirm the deployed rule, threshold, counting characteristic, mitigation timeout, action, and response through the Cloudflare dashboard and a controlled live test.

Do not place an interactive Managed Challenge on either JSON endpoint. The form already executes its interaction-only Turnstile widget during final Send, and an HTML challenge would add another gate and change the JSON API response contract.

The browser falls back to a generic failure message when an error response is not valid JSON. That fallback does not make an HTML challenge compatible with the endpoint contract.

Cloudflare documents custom JSON rate-limit block responses as a Pro-plan-or-higher feature. If JSON blocks are required, confirm that the active plan and selected Block action support them. Do not claim a custom JSON edge response on a plan that cannot configure one. See [Cloudflare rate-limit custom responses](https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/#configure-a-custom-response-for-blocked-requests).

## Privacy, storage, and logging

The browser holds the draft in memory. The signed cookie holds only the submission UUID and timing metadata. D1 stores the opaque submission UUID, keyed normalized-email hash, and reservation and expiry times; it stores no raw contact fields or message. Expired rows stop counting at expiry and are removed during later reservation cleanup. Cloudflare processes request metadata and the verification token; Siteverify also receives the optional Cloudflare-provided IP value. DNS resolution processes the email domain. Resend and the receiving mail systems process the complete email messages and delivery metadata. The visitor confirmation repeats the submitted contact details in email.

There are no explicit `console` calls or request-body logging in the two Functions. This repository-level absence does not disable Cloudflare, Resend, or mailbox-provider logs and retention. Do not add body, token, contact-field, provider-response, recipient, or credential logging. Coarse outcomes and non-sensitive timing are the maximum appropriate application telemetry if logging is added later.

The private recipient is never returned in an endpoint response or included in the browser bundle. The configured sender and fixed reply-to are intentionally public identities and are not substitutes for the private destination inbox.

The direct email link bypasses the two contact Functions, their ticket, and their form-specific validation. Messages sent that way are processed directly by the visitor's and recipient's mail systems.

## Verification coverage and limits

The automated tests cover the three-step browser flow, final-submit execution, interactive fallback, expiry and error recovery, repeated-click blocking, exact client request bodies, standalone completion, subsequent new messages, notices and locked retries, field validation, Turnstile widget callbacks, handler order, body and schema rejection, origin and configuration failure, action, hostname and custom-data binding, bounded Siteverify retry, ticket signing and tamper checks, DNS outcomes, D1 reservation and concurrency behavior, sequential provider calls, email escaping, idempotent partial-failure retry, route allowlisting, and legal-page disclosures.

Deployment smoke testing performs unauthenticated `GET` requests to both Function paths and requires `405` JSON responses. This proves that both routes are deployed and reject the wrong method. It does not prove live Turnstile validation, cookie acceptance, D1 migration state, DNS behavior, WAF state, Resend delivery, sender-domain verification, recipient correctness, or mailbox receipt.

Useful focused verification:

```powershell
npx --no-install vitest run functions/api/contact/verify.test.ts functions/api/contact.test.ts src/app/contact/contact.test.tsx src/components/contact/TurnstileWidget.test.tsx src/components/contact/contactFormValidation.test.ts
npm run docs:check
```

For a release preview, inspect the three steps, final Send status, interaction fallback, completion layout, responsive behavior, and accessibility states without selecting the final Send action. This confirms the deployed interface without consuming a Turnstile token, D1 quota slot, or email delivery. Complete end-to-end activation still requires a separately authorized controlled live test on each allowed hostname without printing tokens, contact bodies, recipient values, or provider responses.

## Change rules

When changing either endpoint or the client contract:

1. Update browser and server schemas together.
2. Preserve exact route scoping in `public/_routes.json`.
3. Reassess origin, body, timing, ticket, privacy, logging, and rate-limit behavior.
4. Keep secrets server-only and public site keys environment-specific.
5. Add tests for success, failure, retry, timeout, and generic responses.
6. Update this guide, [Security](SECURITY.md), [Deployment](DEPLOYMENT.md), and the [Security checklist](SECURITY_CHECKLIST.md).
7. Verify the active Cloudflare and Resend configuration separately from repository tests.
