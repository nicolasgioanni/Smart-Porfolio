# Troubleshooting

Use this guide to diagnose local setup, content generation, quality-gate, Cloudflare Pages, and contact-flow failures. Start with the exact failing command or workflow step. Do not print environment values, workbook URLs, provider responses containing user data, or contact request bodies while investigating.

## Fast diagnostic sequence

From the repository root, run:

```powershell
node --version
npm --version
git status --short --branch
npm run docs:check
npm run generate:content
npm run lint
npm run typecheck
npm run test
npm run build
```

Stop at the first failure and use the matching section below. `npm run verify` runs the same documentation, lint, typecheck, test, and normal-build sequence after dependencies are ready.

## Local setup

### Node.js is missing or too old

The project requires Node.js 22.13 or newer. `.nvmrc` and CI select Node.js 22.

Confirm:

```powershell
node --version
```

Install or select a compatible Node.js release, reopen the terminal, and run `npm run setup:local` again.

### npm is missing

Install npm with Node.js or repair the Node.js installation. The local helpers stop before changing dependencies when npm cannot be found.

### Dependencies are missing or stale

Run:

```powershell
npm run setup:local
```

The helper compares package and setup hashes, validates an existing install, and runs `npm ci` when the lockfile is available. Use the force option only when a clean locked reinstall is intentional:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1 -ForceInstall
```

### PowerShell blocks a helper

Run the checked-in wrapper with a process-scoped policy:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```

Alternatively, use the cross-platform Node commands such as `npm run setup:local:node` and `npm run verify:local:node`.

### The requested development port is occupied

`npm run dev:smart` searches for another port. To select a different starting port:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Port 3005
```

The helper prints the selected local URL before starting Next.js.

## Documentation validation

### A relative link does not resolve

`npm run docs:check` reports the Markdown file, line, and target. Confirm:

- The target exists.
- Filename and directory capitalization exactly match the filesystem.
- The relative path is based on the Markdown file's own directory.
- The link does not enter `.next`, `out`, or `coverage`.
- The link does not point to a local environment file.

### A document has the wrong H1 count

Each Markdown document must have exactly one top-level `#` heading outside fenced code. Convert any additional top-level headings to the appropriate depth.

### A code fence is unclosed

Match every opening backtick or tilde fence with a closing fence of the same character and at least the same length. Give command fences an appropriate language such as `bash`, `powershell`, `json`, or `text`.

### The validator reports a privacy or placeholder pattern

Remove the value or unresolved marker. Documentation may name supported environment variables, but it must not include a workbook URL, local user path, local environment link, or placeholder that could be mistaken for completed documentation.

## Content generation

### Generated content is missing or stale

Run:

```powershell
npm run generate:content
```

With no workbook URL and strict mode disabled, the generator uses checked-in templates. `npm run setup:local` also regenerates when a template is newer than the generated file.

### Strict mode reports a missing workbook URL

`PORTFOLIO_REQUIRE_REMOTE_CONTENT=true` requires `PORTFOLIO_WORKBOOK_URL`. Production candidates set strict mode in the workflow. Check the secret name and environment assignment without printing its value.

### The workbook download fails

The generator fails closed for HTTP errors, timeouts, oversized responses, HTML or permission pages, invalid ZIP signatures, and malformed XLSX data.

Confirm the source is an anonymously downloadable HTTPS workbook and returns the file without authentication. Do not replace strict mode with a template fallback to make production pass.

### A worksheet is missing, unexpected, duplicated, or hidden

The workbook must contain exactly the expected visible worksheets. Matching trims the title and compares it case-insensitively. Internal spaces, punctuation, and spelling still matter. Remove extra tabs, make required tabs visible, and correct duplicate normalized titles.

### A header or row is invalid

The workbook and local templates require exact header sets. Common causes include:

- A renamed or missing header.
- An extra non-empty column.
- A required key row that is absent.
- A duplicate ID or key.
- An unknown profile or site-setting key.
- An invalid boolean, number, date, list, or URL.
- A formula without a cached displayed result.

Use the sheet and row context from the generator error, correct the source, and rerun generation.

### The hash did not change after an edit

The hash covers the canonical normalized content subset. Formatting, workbook metadata, equivalent line endings, trailing blank cells, generation time, and compatibility fields outside that subset do not change it.

Confirm the edited field is mapped into the current UI. See [Content Pipeline](CONTENT_PIPELINE.md) and [Content Mapping](CONTENT_MAPPING.md).

### The hash changed unexpectedly

Regenerate once more from an unchanged source. Compare normalized generated JSON rather than XLSX metadata or formatting. Validate dates, line endings, list separators, visible cell text, and any field that affects rendering.

## Lint, typecheck, and tests

### ESLint fails

Run `npm run lint` and fix every reported error or warning. The command uses `--max-warnings=0`, so warnings fail the gate.

### TypeScript fails

Run `npm run typecheck`. Check the first type error, especially after content schema, Function environment, or component prop changes. The project uses strict mode and emits no files.

### Vitest fails

Run the reported file directly. For example:

```powershell
npx --no-install vitest run functions/api/contact.test.ts
```

Use the full suite after the focused failure passes:

```powershell
npm run test
```

Tests use jsdom and mocks. A behavior that passes unit tests can still fail in Wrangler, a browser, or an external provider, so reproduce at the narrowest real boundary when necessary.

### Footer tests fail only in the focused CI step

Run:

```powershell
npm run test:footer
```

The focused step and full suite execute the same footer files. A difference usually indicates timing, cleanup, shared global state, or an incomplete concurrent change rather than different test code.

## Build and static export

### `npm run build` fails during `prebuild`

The normal build regenerates content first. Diagnose it as a content-generation failure before investigating Next.js.

### `npm run build:generated` fails

This command assumes generated JSON already exists and is valid. In CI it must follow the explicit candidate generation step. Locally, run `npm run generate:content` first.

### `content-version.json` is missing or invalid

The writer requires a valid content hash and generation timestamp in the generated JSON. In CI, `DEPLOYMENT_COMMIT_SHA` must be a 40-character Git SHA. Rebuild only after the source metadata is valid.

### Static pages work but contact requests return the page shell or 404

`next dev` and a plain static file server do not run Cloudflare Pages Functions. Build and start Wrangler:

```powershell
npm run dev:pages
```

Confirm `out/_routes.json` includes only `/api/contact/verify` and `/api/contact`.

## Local contact flow

### The contact form is unavailable

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` must exist before the build. Rebuild after setting it because Next.js compiles public values into the browser bundle. A blank preview key intentionally leaves the preview form unavailable and does not fall back to production.

### Turnstile never becomes ready

Confirm:

- The browser can load `https://challenges.cloudflare.com`.
- The widget key permits the exact browser hostname.
- The Content Security Policy still permits the required script, frame, and connection origins.
- A browser extension or network policy is not blocking the widget.

### `/api/contact/verify` returns HTTP 400

Use a fresh token and confirm the site key, secret, exact `portfolio_contact` action, and `TURNSTILE_ALLOWED_HOSTNAMES` agree. Turnstile tokens are single-use and short-lived. Cloudflare dummy tokens use action `test` and intentionally fail this contract.

### `/api/contact/verify` returns HTTP 403

The browser origin must exactly match one entry in `CONTACT_ALLOWED_ORIGINS`, including scheme and port. The local example expects Wrangler's default port. Do not add a wildcard.

### `/api/contact/verify` returns HTTP 503

Required verification configuration is missing or malformed. Check `TURNSTILE_SECRET_KEY`, allowed hostnames, and allowed origins without printing values. No separate ticket-signing secret exists.

### Verification succeeds but the form does not advance

Inspect the verification response and confirm the browser accepted the signed cookie. The cookie is `Secure`; use the documented Wrangler or preview setup and check browser cookie policy. The Continue control remains available as a fallback after successful verification.

### `/api/contact` returns `verification_required`

The final request must include the signed cookie and exact submission ID used during verification. The ticket expires after 30 minutes, is bound to one ID, and the browser is instructed to clear it after successful delivery. Enforcement is stateless: restart verification when the ticket cookie is missing, cleared, expired, invalid, or mismatched with the submission ID.

### `/api/contact` returns HTTP 400

Check the exact JSON schema, shared field limits, all acknowledgements, and `startedAt` value. Unknown fields and implausible or expired timestamps are rejected. Honeypot and implausibly fast requests intentionally receive a generic success response without delivery, so they do not explain an HTTP 400.

### Either endpoint returns HTTP 403

Both Functions apply the exact same origin allowlist. Match the browser origin, including scheme and port, and keep production, preview, and local origins separated.

### `/api/contact` returns HTTP 502

Validation succeeded but provider delivery failed. Check the restricted Resend key, verified sending identity, fixed sender configuration, and controlled recipient in the provider dashboard. Do not log the message or recipient value. A still-valid ticket is retained so the same submission can be retried with the same idempotency key.

### Either endpoint returns HTTP 429 or an HTML challenge

WAF rate limiting is external Cloudflare configuration, and its live state is unverified by repository tests. Cloudflare custom rate-limit responses require Pro or higher, but plan eligibility alone does not satisfy the prerequisite. On Pro or higher, explicitly configure both endpoint actions with the required JSON response, then verify the live edge status, content type, and body. A Free-plan baseline can rate-limit requests but cannot guarantee the required JSON response, so treat a non-JSON response as a known plan-level compatibility gap and upgrade or use another provider-compatible control. Remove any interactive Managed Challenge from these paths because it violates the client contract and adds an unintended second human-verification step.

## GitHub Actions candidate selection

### The run says the candidate is stale

A newer commit reached the same branch after the workflow checked out its candidate. The run intentionally skips artifact creation and deployment. Review the workflow for the newer branch tip.

### The Pages target validation fails

The repository variables must exactly match:

- Project name: `smart-portfolio`
- Assigned domain: `smart-portfolio-bds.pages.dev`

The domain value must be a lowercase `pages.dev` hostname without a scheme or path. Do not derive it from the project name.

### A scheduled or non-forced run stops before quality checks

Inspect the `Compare the validated snapshot with production` and decision steps. When `deployed_content_matches=true`, stopping before documentation, lint, tests, build, artifact upload, and deploy is the intended successful no-op.

### A code change needs redeployment but a non-forced run is unchanged

The comparison considers only normalized content. Dispatch with `force_deploy=true` to verify and deploy the current `main` source even when its content hash matches production.

### The production manifest returns 404

The comparison treats 404 as no existing deployment metadata and selects deployment. Other HTTP failures and malformed JSON fail closed. Do not substitute a guessed hash.

## Artifact integrity

### Manifest creation fails

Confirm `out/` exists, is a directory, contains `content-version.json`, and has no symbolic links or unsupported filesystem entries. The content-version commit and hash must be valid.

### Verification reports a commit mismatch

The manifest, content-version file, and expected candidate must use the same 40-character SHA. Do not regenerate only one metadata file. Rebuild the candidate from its verified source.

### Verification reports a file-count or digest mismatch

The artifact changed after manifest creation or transferred incompletely. Do not bypass the check. Recreate the artifact from the candidate, verify it before upload, and confirm the deploy job downloaded the artifact from the same workflow run.

### A hidden export file is missing after download

The upload step uses `include-hidden-files: true`. Confirm the current workflow retains that option and that the artifact was not repackaged outside GitHub Actions.

## Wrangler and deployment

### The branch recheck refuses deployment

The verified SHA is no longer the branch tip. This is an intentional stale-candidate guard. Review the newer run instead of forcing the old artifact through Wrangler.

### Wrangler authentication or project lookup fails

Confirm `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are present in GitHub Actions and that the token has access to the intended Pages project. Confirm the project variable is still `smart-portfolio`. Do not replace the restricted token with a personal token.

### Wrangler succeeds but the smoke step fails

Wrangler has successfully created the candidate deployment before smoke testing begins. The candidate may already serve through the stable alias, and a failed smoke does not undo or roll back the upload. Inspect Cloudflare deployment history and these assigned-domain endpoints immediately:

- `/`
- `/content-version.json`
- `/artifact-integrity.json`
- `/api/contact/verify`
- `/api/contact`

The smoke helper retries 10 times with 5-second gaps and 20-second request timeouts. Persistent failure can indicate alias propagation, stale metadata, a wrong commit, an altered manifest, Function routing failure, or a changed JSON method contract.

There is no automatic rollback. Follow [Operations](OPERATIONS.md#rollback) after identifying the active deployment.

### The assigned domain works but the custom domain fails

CI intentionally validates `smart-portfolio-bds.pages.dev`, not the custom domain. Check the Cloudflare custom-domain binding, DNS records, redirect behavior, certificate status, and production hostname or origin allowlists. These are external controls.

### The custom domain works but CI polling fails

Do not point `CLOUDFLARE_PAGES_DOMAIN` at the custom domain. CI requires the reviewed assigned hostname. Check the Pages project, assigned alias, repository variable, and Cloudflare deployment state.

## Schedule and heartbeat

### The daily workflow did not run

Confirm the workflow exists on the default branch, Actions is enabled, and GitHub has not disabled scheduled workflows after repository inactivity. The cron expression is `17 13 * * *`, which is 13:17 UTC.

### The heartbeat did not create a commit

This is expected when `main` or `automation-heartbeat` has activity within the previous 30 days. The job also fails closed if any path other than `.github/schedule-heartbeat` changes or is staged.

### The heartbeat succeeded while verification failed

The schedule starts independent `verify` and `automation-heartbeat` jobs. Heartbeat success does not mean content verification or deployment succeeded.

## Escalation record

For a deployment incident, record only non-sensitive evidence:

- UTC timestamp.
- Workflow run and attempt.
- Candidate branch and commit SHA.
- Expected and observed content hashes.
- Failing step and sanitized error.
- Assigned-domain and custom-domain status.
- Cloudflare deployment identifier when safe to share internally.
- Whether Wrangler had completed before failure.
- Recovery or rollback action and verification result.

Do not include secrets, workbook URLs, request bodies, visitor data, cookies, tokens, or recipient configuration.
