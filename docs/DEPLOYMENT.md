# Deployment

## Deployment ownership

GitHub Actions is the only production deployment path. Keep Cloudflare Pages Git integration disconnected, and disable Vercel automatic deployments after the Cloudflare cutover. A provider-dashboard upload or deploy hook would bypass the repository's green gate and is not part of this design.

The stable required job is named `verify`:

| Event | Content source | Verification | Deployment |
| --- | --- | --- | --- |
| Pull request into `main` or `develop` | Checked-in templates | Full suite and static build | Never |
| Push to `develop` | One strict XLSX download | Full suite and static build | Preview branch only |
| Push to `main` | One strict XLSX download | Full suite and static build | Production only |
| Daily `17 13 * * *` | One strict XLSX download | Only when deployed hash differs | Production only when changed |
| Manual dispatch | Latest `main`, one strict XLSX download | Always when forced; otherwise only when changed | Production only |

`force_deploy` is a boolean that defaults to `true`. It may bypass only the unchanged-content optimization. It never bypasses workbook validation, lint, typecheck, footer regression tests, the full test suite, build, artifact integrity, the latest-`main` check, Cloudflare's result, or smoke tests.

Manual and scheduled jobs explicitly check out current `main`, regardless of the branch displayed in the GitHub UI. Production concurrency cancels stale candidates. The deploy job re-fetches `main` immediately before upload and refuses to deploy when the tested SHA is no longer current.

## One-fetch, exact-artifact pipeline

A deployable candidate follows this sequence:

```text
Download workbook once
-> parse and validate once
-> generate JSON once
-> run the complete verification suite
-> build from that same JSON
-> write public deployment metadata
-> create and upload an integrity-checked out/ artifact
-> check out the exact tested commit for functions/ and Wrangler config
-> verify the downloaded artifact
-> deploy from repository root
-> smoke-test the resulting deployment
```

`npm run build:generated` runs Next.js directly against the existing generated JSON and does not invoke content generation. The deploy jobs do not rebuild and do not download the workbook. Running locally installed Wrangler from the repository root ensures `functions/api/contact.ts`, its shared modules, `wrangler.jsonc`, `_routes.json`, and the tested static output all come from the intended revision.

The Actions artifact is named `cloudflare-pages-build` and contains the contents of `out/`. `out/artifact-integrity.json` records SHA-256 values used to reject a modified, incomplete, or wrong-revision artifact before Wrangler runs.

## Deployed content manifest

Every candidate build creates `out/content-version.json`:

```json
{
  "schemaVersion": 1,
  "contentHash": "<sha256>",
  "commitSha": "<GitHub commit SHA>",
  "generatedAt": "<generated content timestamp>",
  "deployedAt": "<build timestamp>"
}
```

It contains no workbook URL or identifier, worksheet ID, email address, secret name or value, or runner detail. `public/_headers` gives `/content-version.json` a specific `Cache-Control: no-store` rule.

Production's active manifest is the source of truth for the last successful content deployment. Scheduled and non-forced manual checks request it with `Cache-Control: no-cache`, `Pragma: no-cache`, and a cache-busting query. A `404` is treated as a first deployment; other inaccessible or malformed responses fail closed instead of guessing. If tests, build, artifact verification, or Wrangler fails, the previous deployment and manifest remain active, so the next scheduled run retries.

Generated content and deployment state are not committed after deployment.

## GitHub configuration

Repository variables:

- `CLOUDFLARE_PAGES_PROJECT_NAME`: `smart-portfolio`.
- `CLOUDFLARE_PAGES_DOMAIN`: `smart-portfolio-bds.pages.dev`, the exact domain assigned by Cloudflare. Do not derive it from the project name.
- `NEXT_PUBLIC_TURNSTILE_SITE_KEY`: the production public widget key.
- `NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY`: optional public key for the `develop` preview. There is no production-key fallback.

Actions secrets:

- `PORTFOLIO_WORKBOOK_URL`: the anonymously downloadable HTTPS XLSX URL. It is public-read-only configuration stored as a secret solely so GitHub automatically redacts it from runner logs. It grants no Google account or Drive access, and the workflow never injects it into pull-request steps.
- `CLOUDFLARE_API_TOKEN`: a restricted token with Pages Edit only.
- `CLOUDFLARE_ACCOUNT_ID`: the target account identifier.

The Cloudflare secrets are used only by deployment jobs.

The workflow hard-codes `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true` for `main`, `develop`, scheduled, and manual deployment candidates. Pull requests never receive Cloudflare credentials. Verification jobs use `contents: read`; deployment jobs add only the deployment permission they require. No job uses `pull_request_target`, `always()` as a failure bypass, `continue-on-error` for a required step, a deploy hook, a test-skipping passcode or commit message, a personal token, or a privileged PR-head checkout.

## Workbook setup without Google account access

The automation performs one anonymous HTTPS download. It does not request Google Drive access, install a connector, call the Drive or Sheets APIs, use an API key, hold OAuth tokens, use a service account, or authenticate as the owner.

1. In your own browser session, create one Google Sheets workbook. Do not grant this project or an automation tool access to Drive.
2. Manually import the nine matching CSV templates from `src/content/templates` as worksheets named `profile`, `links`, `research`, `projects`, `experience`, `recommendations`, `education`, `skills`, and `site_settings`. Never import `resume.csv`.
3. Preserve row-one field names and text formatting where automatic conversion would alter identifiers, dates, URLs, booleans, or multiline text.
4. Review every value and workbook property for anonymous public release.
5. Configure a Google Sheets URL that returns the complete workbook as XLSX without login or permission prompts as the `PORTFOLIO_WORKBOOK_URL` GitHub Actions secret. Secret storage is used only for automatic runner-log redaction; the URL remains an anonymous download and is not a Google credential.

The workbook must contain exactly those nine visible worksheets and nothing else. Worksheet matching uses `worksheetName.trim().toLowerCase()`: capitalization and physical order are ignored, but internal spaces, hyphens, and spelling changes are not aliases. A missing, duplicate-normalized, unexpected, `resume`, hidden, or very-hidden worksheet fails generation. HTML/login responses, invalid ZIP/XLSX data, an oversized response, timeout, invalid headers, malformed rows, uncached formula results, or schema violations also fail without template fallback.

The URL is public configuration, not a credential. Anyone able to retrieve it can read the workbook, so keep private resume content, recipient inboxes, credentials, unpublished recommendations, and sensitive personal data out of all worksheets and workbook metadata.

## Semantic change detection

Generated metadata contains a deterministic SHA-256 `contentHash` of canonical normalized rendered content. Volatile metadata is excluded. Worksheet order and capitalization, XLSX author or modified time, download time, equivalent line endings, harmless trailing blank rows or columns, and `generatedAt` do not affect the hash. A visible normalized content edit does.

When a newly generated hash matches the existing generated JSON, generation preserves its `generatedAt`. Generation reports machine-readable `content_changed`, `content_hash`, and `generated_at` outputs. Scheduled deployment decisions compare `content_hash` with the active production manifest, not with a repository commit.

There is intentionally no remote resume source. `src/content/templates/resume.csv` remains the empty, header-only local compatibility file.

## Production and preview isolation

Production deploys with branch `main`. A green `develop` push uses:

```bash
wrangler pages deploy out \
  --project-name=smart-portfolio \
  --branch=develop \
  --commit-hash="$GITHUB_SHA"
```

The project name remains `smart-portfolio`, while Cloudflare's assigned Pages domain is `smart-portfolio-bds.pages.dev`. Production uses `https://smart-portfolio-bds.pages.dev`, and the stable preview alias is `https://develop.smart-portfolio-bds.pages.dev`. The workflow uses the explicit `CLOUDFLARE_PAGES_DOMAIN` variable for polling and smoke tests instead of assuming that a project name always equals its assigned hostname. The preview cannot update the production branch or production aliases. Preview builds receive only `NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY`; when that variable is blank, the contact form is visibly unavailable instead of using the production key.

`wrangler.jsonc` is the reviewed Pages configuration source of truth. It pins the compatibility date and static output directory and carries only non-secret production and preview variables for exact hostnames, exact origins, sender, and fixed reply-to. Keep `TURNSTILE_SECRET_KEY`, `RESEND_API_KEY`, and `CONTACT_RECIPIENT_EMAIL` as encrypted Cloudflare secrets, configured separately for production and preview as appropriate.

## Contact runtime configuration

Encrypted Cloudflare secrets:

- `TURNSTILE_SECRET_KEY`
- `RESEND_API_KEY`
- `CONTACT_RECIPIENT_EMAIL`

Reviewed non-secret Wrangler values:

- `TURNSTILE_ALLOWED_HOSTNAMES`: comma-separated exact hostnames, without wildcards.
- `CONTACT_ALLOWED_ORIGINS`: comma-separated exact HTTPS origins.
- `CONTACT_FROM_EMAIL`: sender identity authorized by the verified Resend domain.
- `CONTACT_REPLY_TO_EMAIL`: fixed public reply-to for visitor confirmations.

The owner notification still replies to the visitor's validated address. The Function continues using Turnstile Siteverify with exact action and hostname validation, exact origin validation, Resend batch sending, submission-scoped idempotency, the existing body-size limit, strict schema validation, honeypot and timing checks, generic error responses, and no sensitive request-body logging.

Before production activation, configure a Cloudflare WAF rate-limit rule matching only:

```text
http.request.uri.path eq "/api/contact"
```

Count by source IP. On a compatible Free plan, start with 5 requests per 10 seconds and a 10-second block, then adjust only from non-sensitive aggregate evidence.

## Branch protection and heartbeat

Protect `main` with:

1. Pull-request-based changes and zero mandatory human approvals.
2. The strict required `verify` status check, with the branch required to be up to date.
3. Force-push and deletion blocked.
4. No GitHub Actions bypass for `main`.

Production automation does not write generated content or deployment state to `main`. To preserve GitHub's public-repository schedule, the scheduled workflow may make one bot heartbeat after 30 days without relevant activity. It writes only `.github/schedule-heartbeat` on the isolated `automation-heartbeat` branch with `github-actions[bot]`; it never modifies `main`, never deploys, and does not require a branch-protection bypass. This heartbeat job is the sole narrow exception that needs `contents: write`. A `GITHUB_TOKEN` push does not recursively trigger another workflow.

GitHub may still display the human account associated with the scheduled workflow as its actor. The workflow execution, deployment, and isolated heartbeat are owned by Actions; do not replace them with a personal access token.

## First deployment and domain cutover

1. Keep the existing Direct Upload project named `smart-portfolio`; it was created with production branch `main` and assigned `smart-portfolio-bds.pages.dev`. Do not run project creation again or enable Git integration. Local Cloudflare administration requires Node.js 22.13 or newer, `npm ci`, and `npx --no-install wrangler login`.
2. Configure the GitHub variables and secrets, encrypted Cloudflare production/preview secrets, Wrangler non-secret variables, exact Turnstile hostnames, Resend domain, and WAF rule.
3. Manually run the workflow with `force_deploy=true`. A forced first run skips only the deployed-hash comparison because no live manifest exists yet; it still performs workbook validation, every check, build, artifact verification, exact-SHA protection, deployment, and smoke tests. Verify `https://smart-portfolio-bds.pages.dev`, static routing, security headers, `/content-version.json`, artifact/commit values, and `/api/contact`. Test Turnstile and end-to-end Resend delivery.
4. Push a safe change to `develop`; confirm only `https://develop.smart-portfolio-bds.pages.dev` changes and its contact form is unavailable when no preview key is configured.
5. Run a non-forced manual check and confirm an unchanged workbook stops before lint, tests, build, artifact upload, or deployment.
6. Make one safe visible workbook edit. Confirm one green deployment and a changed manifest hash, with no generated-content commit. A second non-forced run should be unchanged.
7. Attach `nicolasmgioanni.dev` and `www` to Pages, replace the current Vercel DNS targets, wait for valid TLS, and repeat routing, Turnstile, manifest, contact-delivery, sender, and reply-to tests on every allowed hostname.
8. Disable Vercel automatic deployments only after the Cloudflare domains are healthy. Retain the previous DNS values until rollback is no longer needed.

Changing the workbook never calls Cloudflare directly. GitHub Actions polls, validates, green-gates, and performs Direct Upload. The deployed browser does not fetch the workbook at runtime.

## Pre-deployment verification

Run locally:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:footer
npm run test
npm run build
```

Before enabling production, confirm that no real secret or workbook URL is tracked; no Google authentication dependency exists; the deploy job uses the tested artifact and exact commit's `functions/`; a red `verify` blocks both production and preview; `develop` cannot update production; and `main` needs no Actions bypass.

Every file under `public/` is anonymously deployed. Keep private resume files outside `public/`, generated JSON, `out/`, artifacts, and repository history. Static export also means dynamic Next.js server features require an explicit architecture change; `/api/contact` remains a Cloudflare Pages Function rather than a Next.js API route.
