# Local Development

Smart Portfolio uses Node.js, npm, Next.js App Router, a build-time CSV or XLSX content generator, and Cloudflare Pages Functions. The core portfolio routes render as a static export. The complete contact flow requires Wrangler because Next.js development mode does not run Pages Functions.

## Prerequisites

- Node.js 22.13 or newer. Node.js 22 matches `.nvmrc` and GitHub Actions.
- npm.
- PowerShell for the Windows convenience commands, or Node.js for the cross-platform equivalents.
- Chromium installed through Playwright when running browser navigation regressions.

Clone the repository with its current slug:

```powershell
git clone https://github.com/nicolasgioanni/Smart-Porfolio.git
cd Smart-Porfolio
```

## Automated setup

### Windows

```powershell
npm run setup:local
```

### Cross-platform

```bash
npm run setup:local:node
```

Setup performs the following work:

1. Finds the project root and checks Node.js and npm.
2. Stops when Node.js is older than 22.13.
3. Creates `.env` from `.env.example` only when `.env` does not exist.
4. Reuses a valid dependency installation when the package and setup hashes match.
5. Runs `npm ci` when the lockfile exists and installation is required.
6. Generates content when the generated JSON is missing or older than a template.

An existing `.env` is never overwritten.

Useful setup flags:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1 -ForceInstall
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1 -ForceGenerate
```

The Node entry point accepts the equivalent `--force-install` and `--force-generate` flags.

## Environment configuration

`.env.example` is the complete placeholder reference. Copy only development values into the ignored `.env` file.

| Group | Variables | Used by |
| --- | --- | --- |
| Content | `PORTFOLIO_WORKBOOK_URL`, `PORTFOLIO_REQUIRE_REMOTE_CONTENT` | Content generator |
| Browser build | `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Contact page bundle |
| Preview build reference | `NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY` | GitHub preview build selection, not local fallback |
| Turnstile runtime | `TURNSTILE_SECRET_KEY`, `TURNSTILE_ALLOWED_HOSTNAMES` | Verification Function |
| Delivery runtime | `RESEND_API_KEY`, `CONTACT_RECIPIENT_EMAIL`, `CONTACT_FROM_EMAIL`, `CONTACT_REPLY_TO_EMAIL` | Delivery Function |
| Origin control | `CONTACT_ALLOWED_ORIGINS` | Both contact Functions |
| Address quota | `CONTACT_RATE_LIMIT_DB` from `wrangler.jsonc` | Local D1 emulation; no environment variable |

Leave `PORTFOLIO_WORKBOOK_URL` blank and `PORTFOLIO_REQUIRE_REMOTE_CONTENT=false` to use checked-in templates. A configured workbook URL is still an anonymous public download. Do not place production provider credentials or production contact secrets in the local file.

## Static UI development

### Smart startup

Windows:

```powershell
npm run dev:smart
```

Cross-platform:

```bash
npm run dev:smart:node
```

The startup helper checks dependencies and generated content, chooses the requested port or the next available port, prints the URL, and starts `next dev`.

PowerShell options:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Port 3000
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Verify
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -ForceInstall
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -ForceGenerate
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -NoOpen
```

`-NoOpen` is accepted for compatibility. The helper prints the URL and does not open a browser. With the default port request, it searches through port `3010` when necessary.

For direct Next.js development:

```bash
npm run dev
```

These Next.js modes support portfolio UI work, the desktop header and mobile bottom dock, themes, motion, and client-side form rendering. Requests to `/api/contact/verify` and `/api/contact` require the Wrangler mode below.

## Content generation

Templates live under `src/content/templates`. Generate normalized content with:

```bash
npm run generate:content
```

The command validates the selected source and writes `src/content/generated/portfolio.generated.json`. Edit the templates or workbook, not the generated JSON.

`npm run build` has a `prebuild` lifecycle step and therefore regenerates content before Next.js runs. `npm run build:generated` skips that lifecycle fetch and consumes the existing generated JSON. The latter is the CI build command after the workflow has already fetched and validated its one candidate snapshot.

See [Local Content Editing](LOCAL_CONTENT_EDITING.md), [Content Pipeline](CONTENT_PIPELINE.md), and [Content Sheet Schema](CONTENT_SHEET_SCHEMA.md) for authoring rules.

## Complete contact-flow development

The full flow needs a development Turnstile widget, development provider credentials, an exact local origin, and Wrangler.

1. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` before building. Next.js compiles it into the browser bundle.
2. Configure the matching development widget for the exact local hostname. Do not add local hosts to the production widget.
3. Set `TURNSTILE_SECRET_KEY` and `TURNSTILE_ALLOWED_HOSTNAMES` for that widget.
4. Set both local origins in `CONTACT_ALLOWED_ORIGINS` only if both are used. Scheme and port are part of the comparison.
5. Use restricted development delivery credentials and a controlled test destination.
6. Keep the tracked `preview_database_id: contact-rate-limit-local`; do not substitute either remote D1 ID for local development.
7. Build, migrate the local D1 database, and serve the static output plus Functions:

```bash
npm run dev:pages
```

The package command runs:

```bash
npm run build
npm run db:migrate:local
npx --no-install wrangler pages dev out --env-file .env
```

Wrangler normally serves at `http://localhost:8788`. It reads local Function values from `.env`; Next.js and the content generator use the same file during the preceding build. D1 data persists under the ignored `.wrangler/` local state and does not contact production or preview unless a command explicitly requests remote mode.

The flow is split across two same-origin endpoints:

1. The browser sends a fresh Turnstile token and opaque submission ID to `/api/contact/verify`.
2. The Function verifies the exact `portfolio_contact` action and allowed hostname, then sets a 30-minute signed, `HttpOnly`, `Secure`, `SameSite=Strict`, host-only ticket cookie bound to the submission ID.
3. The browser submits the reviewed contact fields and the same ID to `/api/contact`.
4. The delivery Function validates the signed ticket, checks the mail domain, and reserves one of two rolling 24-hour local D1 slots without calling Siteverify again.
5. It asks Resend to accept the visitor confirmation first and then the owner notification, using separate idempotency keys.
6. Successful delivery clears the ticket. A delivery failure retains a still-valid ticket and reservation for a safe same-ID retry.

Cloudflare dummy tokens report the action `test`, while the application requires `portfolio_contact`. Use a development widget that returns the configured action. Do not weaken action validation for local convenience.

Wrangler local mode exercises the checked-in `_routes.json`, `_headers`, D1 binding, and migrations. It does not prove remote D1 bindings or migration state, production DNS and WAF behavior, custom-domain configuration, provider secrets, or mailbox delivery.

## Verification

Run the normal local quality gate:

```bash
npm run verify
```

`verify` runs documentation integrity, lint, typecheck, the full Vitest suite, and a production build. The build regenerates content through `prebuild`.

Run the focused navigation unit and browser regressions separately:

```bash
npm run test:navigation
npx playwright install chromium
npm run test:e2e:navigation
```

The Playwright command starts Next.js on port `3100` by default. Set `PLAYWRIGHT_PORT` to choose another port. Browser artifacts are written to ignored `test-results/` and `playwright-report/` directories. The normal `verify` command does not install Chromium or run Playwright.

The smart local wrapper prepares dependencies when needed, explicitly regenerates content, and then runs the same gate:

```powershell
npm run verify:local
```

Cross-platform:

```bash
npm run verify:local:node
```

Because `verify` ends with the normal build, the wrapper's explicit generation is followed by the build lifecycle generation. CI avoids a second remote fetch by using `build:generated` instead.

Use [Testing](TESTING.md) for the command matrix, test inventory, and CI coverage.

## Inspecting the static export

Build the export:

```bash
npm run build
```

Next.js writes static HTML, route payloads, assets, `_headers`, `_routes.json`, and `content-version.json` to `out/`. A plain static server is sufficient for page-only inspection. Use `npm run dev:pages` when the test includes either contact Function.

Do not treat ignored local `out/` files as a verified deployment artifact. CI creates and validates `artifact-integrity.json` only for deployable candidates.

## Cleaning local artifacts

Default cleanup removes `.next` and `out`. Playwright output directories are ignored but are not removed by the cleanup helpers:

```powershell
npm run clean:local
```

Cross-platform:

```bash
npm run clean:local:node
```

Optional PowerShell commands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -GeneratedContent
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -NodeModules
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -All
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -All -Force
```

Removing `node_modules` requires confirmation unless `-Force` is supplied. Cleanup preserves templates, public assets, and `.env`.

## Next steps

- [Troubleshooting](TROUBLESHOOTING.md)
- [Testing](TESTING.md)
- [Deployment](DEPLOYMENT.md)
- [Operations](OPERATIONS.md)
