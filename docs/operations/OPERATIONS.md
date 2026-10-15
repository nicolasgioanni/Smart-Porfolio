# Operations

This runbook covers recurring deployment, monitoring, incident response, and rollback for the Smart Portfolio Cloudflare Pages service. Complete the environment setup in [Deployment](DEPLOYMENT.md) before using these procedures. The checked-in workflow graph and repository evidence boundary are defined in [CI input and evidence contracts](../quality/CI_CONTRACTS.md); this runbook does not prove a hosted deployment completed.

## Service map

| Surface | Address or path | Expected role |
| --- | --- | --- |
| Public site | `https://nicolasmgioanni.dev` | Primary visitor domain |
| Assigned production site | `https://smart-portfolio-bds.pages.dev` | CI polling and production smoke target |
| Stable preview | `https://develop.smart-portfolio-bds.pages.dev` | `develop` deployment and smoke target |
| Content metadata | `/content-version.json` | Active normalized content hash and commit SHA |
| Artifact metadata | `/artifact-integrity.json` | Published static artifact inventory |
| Verification Function | `/api/contact/verify` | Turnstile verification and ticket issuance |
| Delivery Function | `/api/contact` | Validated email delivery |
| Production quota database | `smart-portfolio-contact-rate-limit-production` | Pseudonymous rolling 24-hour reservations |
| Preview quota database | `smart-portfolio-contact-rate-limit-preview` | Isolated preview reservations |

HTTP checks on 2026-08-27 observed successful responses from the custom domain and both assigned-domain targets. This observation is point-in-time evidence only; current domain, DNS, certificate, and Pages state remains external and unverified by repository checks. CI uses only the assigned `pages.dev` hostnames, so custom-domain verification is a separate operator responsibility.

## Sources of truth

Use the narrowest authoritative source for each question:

| Question | Source of truth |
| --- | --- |
| What source revision is deployed? | `commitSha` in the live `content-version.json` |
| What canonical normalized content subset is active? | `contentHash` in the live `content-version.json` |
| What static files were uploaded? | Live `artifact-integrity.json` and the corresponding workflow artifact |
| What workflow logic ran? | `.github/workflows/ci.yml` at the candidate SHA |
| What non-secret Pages values were reviewed? | `wrangler.jsonc` at the candidate SHA |
| What D1 schema should be active? | Numbered SQL under `migrations/` at the candidate SHA |
| Which D1 migrations are actually active? | The selected database's D1 migration ledger in Cloudflare |
| Which static requests invoke Functions? | Sealed `out/_routes.json`, emitted after validation against reviewed `public/_routes.json`, at the candidate SHA |
| Which static headers are intended? | Sealed `out/_headers`, generated from reviewed `public/_headers`, at the candidate SHA |
| Do required secrets, WAF, domains, DNS, and branch rules match the intended state? | Verify the external, repository-unverified state in the Cloudflare and GitHub dashboards |

Do not infer a successful source deployment from the content hash alone. Code-only revisions can share the same hash.

## Routine deployment paths

### Preview a branch change

1. Open or update a pull request targeting `main` or `develop`.
2. Confirm the `verify` job accepted the template snapshot, full quality and unit suites, assigned Chromium, visual, Firefox, and WebKit browser coverage, the sealed candidate, export/runtime check, and every applicable source-security receipt.
3. Merge or push the reviewed change to `develop`.
4. Confirm the workflow selected `deploy_target=preview`, validated the preview D1 binding, applied pending preview migrations, and deployed the current `develop` SHA.
5. Review `https://develop.smart-portfolio-bds.pages.dev` manually. Complete the visible gate, observe its automatic transition or use Continue, and confirm the three data-entry steps, two acknowledgments, 500-character limit, responsive behavior, focus, and error states without selecting Send request. The gate may consume a Turnstile token, but this no-delivery inspection must not call `/api/contact`, reserve D1 quota, or send email. Confirm the standalone completion layout through verified component coverage.
6. Confirm the preview workflow and the pull-request verification workflow both pass for the exact candidate before merge. The automated smoke check covers only the scope listed in [Deployment](DEPLOYMENT.md#exact-automated-smoke-scope).

The preview build receives only `NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY`. If that variable is blank, the contact form remains unavailable instead of using the production key. The key should identify a Managed Turnstile widget restricted to the preview hostname; visible upfront rendering is controlled by the client.

### Release source changes to production

1. Merge the reviewed green change into `main` through the repository's approved change flow.
2. Confirm the push workflow resolves the current `main` SHA.
3. Confirm strict workbook generation produces one accepted snapshot before full validation.
4. Confirm `verify` accepts every required job result and original producer receipt or artifact rather than a rerun substitute.
5. Confirm the deploy job restores the sealed candidate and verifies its archive digest; the trusted workflow creates provenance/SBOM attestations, then the deployment command performs its bounded read-only Direct Upload Pages-project preflight and cryptographically verifies those attestations before branch freshness, D1 migration, or upload.
6. Confirm the production D1 target check and pending migrations succeed before Pages upload.
7. Confirm the unique deployment-host smoke, exact identity check, and stable assigned-domain smoke pass.
8. Verify the public custom domain, key static routes, security headers, and the contact page manually. Completing the gate is permitted, but do not select Send request.
9. Record the active `contentHash`, `commitSha`, workflow run, D1 migration result, and any manual checks in the release record.

### Publish workbook content

The daily schedule at `13:17 UTC` checks the current `main` source against one newly downloaded and validated workbook snapshot.

An exact-candidate check still resolves the trusted candidate, prepares one strict workbook snapshot, validates target-specific public inputs, and reads no-cache deployed identity. It stops before application validation, release packaging, and deployment only when the current v2 identity has the same target, content hash, candidate commit SHA, target-specific public-build input digest, and trusted GitHub Actions producer kind. Source-security jobs still run and write receipts for every no-op.

Valid but non-equivalent metadata, legacy metadata, or an explicit missing-metadata HTTP 404 selects the complete production path. Malformed metadata, failed requests and unavailable observations fail preparation; they do not select a no-op or authorize deployment. Editing workbook formatting or data outside the canonical content subset does not intentionally trigger deployment unless another compared input changes.

### Run a manual content check

Use the `CI` workflow dispatch input:

- `force_deploy=true`, the default, runs full verification and production deployment even when the validated v2 deployment identity is equivalent.
- `force_deploy=false` uses the same target, content-hash, candidate-commit, public-build-input, and trusted GitHub Actions producer-kind comparison as the schedule and stops early only when the current v2 identity is equivalent.

Use a forced run for a first deployment, an intentional rebuild, an immediate retry, or recovery after correcting external configuration. Force does not skip any quality or integrity gate. The daily schedule automatically retries an undeployed code-only `main` revision because its commit SHA differs from production.

## Post-deployment verification

### Inspect public metadata

On PowerShell:

```powershell
$productionOrigin = 'https://smart-portfolio-bds.pages.dev'
Invoke-RestMethod "$productionOrigin/content-version.json"
Invoke-RestMethod "$productionOrigin/artifact-integrity.json"
```

On a POSIX shell:

```bash
production_origin='https://smart-portfolio-bds.pages.dev'
curl --fail --silent --show-error "$production_origin/content-version.json"
curl --fail --silent --show-error "$production_origin/artifact-integrity.json"
```

Confirm:

- `schemaVersion` is `2` for a current release. A v1 document is legacy metadata and must not be used to prove a no-op or producer ordering decision.
- `contentHash` is 64 lowercase hexadecimal characters.
- `commitSha` is the intended 40-character source revision.
- `target`, `publicBuildInputDigest`, and the producer `runId`, `runNumber`, and `attempt` match the verified candidate. The public digest is a fingerprint, not a public-key value.
- `generatedAt` and `deployedAt` are parseable timestamps.
- The artifact manifest uses `sha256`, carries the same commit SHA, and contains file records.

Both metadata endpoints should return explicit no-store and no-cache headers.

### Verify static routes

The automated deployment smoke compares the assigned alias against the sealed release for `/`, `robots.txt`, `sitemap.xml`, both metadata documents, and safe Function method rejections, including their exact scoped headers. It does not cover every static route or the custom domain. For a release, use the current route registry and check the exported portfolio, contact, and legal routes manually. At minimum, include:

- `/`
- `/experience`
- `/research`
- `/projects`
- `/recommendations`
- `/contact`
- `/privacy`
- `/terms`
- `/security`

Check both the assigned production domain and the primary custom domain. Confirm navigation, theme switching, responsive layout, reduced-motion behavior, and expected page content.

### Verify static response headers

On representative static pages, confirm the Cloudflare response includes the intended policy from sealed `out/_headers`, generated from reviewed `public/_headers`:

- `Content-Security-Policy`
- `Permissions-Policy`
- `Referrer-Policy`
- `Strict-Transport-Security`
- `X-Content-Type-Options`
- `X-Frame-Options`

The assigned-alias smoke compares the root response headers against sealed `out/_headers`; manually confirm representative routes and the custom domain as well.

### Verify contact routing without delivery

A safe method check does not consume Turnstile or send email:

```bash
curl --include 'https://smart-portfolio-bds.pages.dev/api/contact/verify'
curl --include 'https://smart-portfolio-bds.pages.dev/api/contact'
```

Both GET requests should return HTTP `405`, `application/json`, and this body:

```json
{
  "ok": false,
  "error": "method_not_allowed"
}
```

Repeat against the custom domain when validating its routing. An end-to-end contact check requires an authorized test destination, a valid Turnstile session, and review of downstream delivery. Do not run it as an unattended synthetic test.

### Verify contact delivery and quota

Use only an owned test mailbox and non-sensitive fixture text. In preview first, then production:

1. Inspect Resend logs and the suppression list for earlier visitor-confirmation attempts before assuming the old template failed to generate a second message.
2. Complete the visible gate, allow its automatic transition or use Continue, complete all three data-entry steps and both acknowledgments, then select Send request once.
3. Confirm the standalone green completion view includes the entered address and offers <em>Send another message</em>.
4. Confirm Resend accepted the visitor confirmation before the owner notification and recorded the expected separate idempotency keys.
5. Inspect both HTML and plain-text messages. Confirm the visitor copy, correction instructions, absolute Privacy and Terms links, owner reply-to, and compact owner summary.
6. Select <em>Send another message</em>, complete the new gate, then submit a second fresh request with the same normalized address. Confirm it receives a new submission UUID and Turnstile token and succeeds.
7. Submit a third new message and confirm HTTP `429`, JSON error `rate_limited`, a valid `Retry-After` header, a red in-page limit notice, and no Resend request.
8. Check D1 only through bounded aggregate or redacted queries. Confirm no raw email, name, phone, or message columns exist; do not copy hashes or UUIDs into tickets or logs.

Resend API acceptance is not proof of mailbox delivery. Confirm receipt or provider delivery status, then check bounce and suppression state. Do not use an address belonging to another person to exercise the quota.

### Verify external controls

Repository checks cannot prove these controls. The live WAF state is unverified until an operator checks the active account and exercises the edge response. Confirm in the provider dashboards:

- Both contact endpoints are covered by the intended WAF rate limit.
- The active plan supports the required response behavior. Cloudflare custom rate-limit responses require Pro or higher, but plan eligibility alone does not satisfy the prerequisite.
- On Pro or higher, both endpoint actions are explicitly configured to return the required JSON rather than an interactive challenge, and a live edge check verifies the response status, content type, and body.
- On Free, record that the baseline rate limit cannot guarantee the JSON API contract, then upgrade or use another provider-compatible control before treating the prerequisite as satisfied.
- Production and preview secrets are present in the correct environments.
- Production and preview `CONTACT_RATE_LIMIT_DB` bindings point to distinct non-placeholder IDs and report the expected migration as applied.
- Turnstile hostname restrictions match each environment.
- The Resend sending identity remains verified, suppression and bounce state is understood, and SPF, DKIM, and DMARC remain correct for the sender domain.
- The custom-domain and `www` behavior, DNS, and certificates are correct.
- Cloudflare Pages Git integration and legacy automatic deployment paths remain disabled.

## Monitoring the daily schedule

The schedule starts the candidate/content path and independent source-security jobs, plus `develop-schedule-heartbeat`. `verify` accepts the required receipts and deploys only when the prepared plan is full; security still runs when a snapshot is unchanged or branch revision is obsolete.

The heartbeat does not depend on the verify result and does not deploy. It writes only after 30 days without newer activity on `main` or `develop`, and only after confirming remote `develop` already exists. It accepts only the `.github/schedule-heartbeat` path, rechecks the remote `develop` SHA before a normal non-force push, and fails rather than overwriting a concurrent update. Its `contents: write` permission is intentionally isolated from the verification and deployment jobs. The checked-in workflow is coded and guarded to update only `develop`; that source-level constraint does not make other refs impossible for every possible token or future workflow change. The tracked [permanent-branch ruleset](../../.github/rulesets/protect-permanent-branches.json) protects both permanent refs from deletion and non-fast-forward updates while allowing this guarded fast-forward. It supplements the retained classic `main` governance target; inspect the live GitHub configuration separately after policy changes.

An exact-candidate check is a successful no-op, not a skipped or failed schedule. It requires matching production content and commit metadata. Investigate a missing scheduled run through GitHub Actions state rather than assuming the workbook or source has not changed.

## Failure triage

Use the first failing stage to decide whether production could have changed:

| Failure stage | Production impact | First action |
| --- | --- | --- |
| Candidate marked obsolete | None | Review the newer branch run |
| Target or content validation | None | Correct configuration or workbook data |
| Source-security, documentation, lint, typecheck, test, browser, or export receipt | None | Fix the reported repository failure or evidence mismatch |
| Static build, sealed package, or artifact transfer | None | Inspect original-producer artifact identity and candidate SHA |
| Branch recheck | No Pages upload after the failed check | Review the newer branch run |
| D1 target validation | None | Restore the reviewed database ID or correct environment isolation before retrying |
| D1 migration | The failing migration is rolled back; an earlier migration may already be active | Inspect the selected database and migration ledger before retrying |
| Wrangler | Usually prior deployment remains active | Check Cloudflare deployment history before retrying |
| Unique-host or stable-target post-Wrangler smoke | Candidate deployment exists and may already serve through the stable alias; the failed job does not roll it back | Inspect live metadata and Cloudflare history immediately |

## Rollback

There is no automatic rollback in `.github/workflows/ci.yml`.

### Provider rollback

When the intended prior deployment is still present in Cloudflare Pages history:

1. Confirm the target deployment's commit and content metadata before changing production.
2. Use the authorized Cloudflare rollback or promotion control.
3. Verify the assigned domain, custom domain, metadata files, static routes, headers, and contact method contracts.
4. Open a repository or content fix so the next normal deployment does not restore the faulty state.

Provider rollback procedures and retention are external Cloudflare behavior and should be confirmed against the active account before an incident.

A Pages rollback does not revert D1 migrations. Before rolling back to older Function code, confirm that the active schema remains backward compatible. Database restoration or destructive corrective SQL is a separate operation that requires explicit review and should not be inferred from a Pages rollback.

### Local recovery-drill evidence

`scripts/quality/recoveryDrill.test.mjs` uses only temporary directories, a credential-free child environment, and `wrangler d1 --local`. It applies the checked-in migrations through `0003_contact_delivery_rendering.sql`, exports a fixture reservation, rebuilds a fresh local database, and verifies that the pseudonymous reservation fields restore unchanged. It also verifies that a tampered v2 sealed envelope is rejected and can be replaced only by its previously verified local fixture; the sealed fixture contains no audit collector input.

This is a repository-level drill, not a Cloudflare D1 backup, retention, export, import, or restore procedure. It does not establish a durable release archive or authorize production database recovery. Any provider recovery remains a separately reviewed operation against verified provider state.

### Forward recovery

When provider rollback is unavailable or a corrected release is preferable:

1. Restore the intended repository source or workbook content.
2. Run local verification.
3. Merge the source correction to `main` when needed.
4. Dispatch the workflow with `force_deploy=true`.
5. Complete all post-deployment checks.

The Actions artifact is retained for three days and is not a durable release archive. Production workbook snapshots are transient build inputs, so repository history alone may not reproduce an earlier content deployment.

## Secret and configuration rotation

When rotating a contact or Cloudflare credential:

1. Create the replacement with the narrowest practical scope.
2. Update only the correct GitHub or Cloudflare environment.
3. Run a preview check when the provider supports isolated preview credentials.
4. Perform a forced green production deployment if the browser build value changed.
5. Validate the contact flow with an authorized test.
6. Revoke the superseded credential after the new path is confirmed.
7. Do not print values in logs, issues, screenshots, or documentation.

Changes to `NEXT_PUBLIC_TURNSTILE_SITE_KEY` or its preview counterpart require a new static build. Changes to server-only Pages secrets do not alter the static artifact, but still require runtime verification.

Rotating `TURNSTILE_SECRET_KEY` also changes the verification-ticket signing key and the domain-separated address and payload HMAC keys. Outstanding tickets become invalid, and reservations made with prior derived keys will not match new submissions even though they remain until expiry cleanup. Schedule the rotation with abuse monitoring and accept that the address quota may temporarily allow new slots during the overlap.

## Operational limits

- CI validates only the assigned `pages.dev` aliases, not the custom domain.
- Automated smoke checks do not exercise valid POST requests, D1 queries, DNS validation, or downstream delivery.
- Live D1 binding and migration state, WAF, Cloudflare plan, DNS, TLS, custom-domain, provider-secret, and branch-protection state are external and unverified by repository tests.
- For scheduled checks and non-forced manual dispatches, preparation can recognize an equivalent active v2 identity only when target, candidate commit SHA, content hash, target-specific public-build-input digest, and GitHub Actions producer kind match. Under the deployment lock, smoke-only execution separately requires the exact deployed identity, while run-number/attempt ordering rejects older or conflicting generations before mutation. Neither comparison proves that a prior post-upload smoke test or external runtime configuration succeeded.
- A successful Wrangler upload creates the candidate deployment before smoke runs. A later smoke failure does not undo or automatically roll back that deployment.
- The repository has no continuous hosted uptime, performance, or deployed-site browser monitor. Packaged-runtime and browser receipts are release validation, not ongoing monitoring.
- GitHub's three-day artifact retention is not a long-term recovery mechanism.

## Related guides

- [Deployment](DEPLOYMENT.md)
- [Testing](../quality/TESTING.md)
- [Troubleshooting](../development/TROUBLESHOOTING.md)
- [Security](../security/SECURITY.md)
