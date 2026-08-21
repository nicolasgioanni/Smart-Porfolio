# Static-first Smart Portfolio

A static-first personal portfolio built with Next.js App Router, TypeScript, and a spreadsheet-compatible content pipeline. Portfolio content is normalized from one public XLSX workbook into generated JSON at build time, then rendered as static pages and deployed to Cloudflare Pages by GitHub Actions.

The app does not require a backend, database, authentication, serverless content API, or runtime Google Sheets requests for the core portfolio pages.

## Quick start on Windows

```powershell
npm run setup:local
npm run dev:smart
```

`setup:local` installs dependencies only when needed and generates content from local CSV templates if the public workbook URL is not configured.

## Cross-platform aliases

```bash
npm run setup:local:node
npm run dev:smart:node
npm run verify:local:node
npm run clean:local:node
```

## Regular npm commands

```bash
npm run dev
npm run generate:content
npm run lint
npm run typecheck
npm run test
npm run build
npm run build:generated
npm run verify
```

`build:generated` is the CI-only static build that consumes the existing generated JSON without fetching the workbook again. Use normal `build` locally when content should be regenerated first.

## Local automation commands

```bash
npm run setup:local
npm run dev:smart
npm run verify:local
npm run clean:local
```

## Content editing overview

Local content templates are in `src/content/templates`. Generated content is written to `src/content/generated/portfolio.generated.json`.

Edit the local CSV templates, or configure the one public Google Sheets workbook, then run:

```bash
npm run generate:content
```

Local development can run without a Google Sheets URL because the generator falls back to local CSV templates. Production automation uses strict remote mode and never falls back to demo content.

The workbook must contain exactly nine visible tabs: `profile`, `links`, `research`, `projects`, `experience`, `recommendations`, `education`, `skills`, and `site_settings`. Matching uses each trimmed lowercase title, so capitalization and physical order do not matter. Unexpected, duplicate-normalized, hidden, very-hidden, and `resume` tabs are rejected.

No Google Drive connector, Google API credential, service account, OAuth grant, or account access is used. In your own browser, create one workbook and manually import the nine checked-in CSV templates from `src/content/templates` into their matching tabs. After reviewing it for public safety, set General access to `Anyone with the link` and the role to `Viewer`, then configure its anonymous XLSX export URL as `PORTFOLIO_WORKBOOK_URL`. Each production candidate performs one anonymous HTTPS download and parses the complete workbook locally. It never calls the Drive or Sheets APIs.

## Testing

Run the full quality gate:

```bash
npm run verify
```

For local setup plus verification:

```bash
npm run verify:local
```

## Production deployment overview

GitHub Actions is the only production deployment path. Pull requests run verification without deploying. A green `develop` push deploys only the protected `develop.smart-portfolio-bds.pages.dev` preview; a green `main` push, a forced manual run, or a daily `13:17 UTC` check that detects meaningful workbook changes can deploy the Next.js static export and `/api/contact` Pages Function to production at Cloudflare's assigned `smart-portfolio-bds.pages.dev` domain.

Daily checks compare normalized rendered content with the successfully deployed `/content-version.json` manifest rather than spreadsheet formatting, XLSX metadata, or generation timestamps. An unchanged workbook is a successful no-op: it does not run lint, tests, build, artifact upload, or deployment. A changed workbook must pass lint, typecheck, footer tests, the full test suite, and the static build before GitHub Actions uploads the exact tested artifact.

Generated workbook content and deployment state are never committed after deployment. Cloudflare's active `/content-version.json` is the source of truth, so a failed validation, test, build, or upload leaves the old hash active and the next scheduled run retries. A non-deploying bot heartbeat on the isolated `automation-heartbeat` branch after 30 inactive days keeps the schedule alive without writing to `main` or bypassing its protection.

See [Deployment](docs/DEPLOYMENT.md) for the GitHub variables and secrets, Cloudflare runtime secrets, workbook publication steps, branch protection, and staged `pages.dev` to custom-domain rollout.

## Documentation

- [Local development](docs/LOCAL_DEVELOPMENT.md)
- [Local content editing](docs/LOCAL_CONTENT_EDITING.md)
- [Content sheet schema](docs/CONTENT_SHEET_SCHEMA.md)
- [Content replacement checklist](docs/CONTENT_REPLACEMENT_CHECKLIST.md)
- [Quality checklist](docs/QUALITY_CHECKLIST.md)
- [Performance checklist](docs/PERFORMANCE_CHECKLIST.md)
- [Security checklist](docs/SECURITY_CHECKLIST.md)
- [Engineering standards](docs/ENGINEERING_STANDARDS.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Maintenance](docs/MAINTENANCE.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Design system](docs/DESIGN_SYSTEM.md)
- [Security](docs/SECURITY.md)
