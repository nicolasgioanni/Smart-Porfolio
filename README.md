# Static-first Smart Portfolio

A static-first personal portfolio built with Next.js App Router, TypeScript, and a spreadsheet-compatible content pipeline. Portfolio content is normalized from CSV into generated JSON at build time, then rendered as static pages.

The app does not require a backend, database, authentication, serverless content API, or runtime Google Sheets requests for the core portfolio pages.

## Quick start on Windows

```powershell
npm run setup:local
npm run dev:smart
```

`setup:local` installs dependencies only when needed and generates content from local CSV templates if remote CSV URLs are not configured.

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
npm run verify
```

## Local automation commands

```bash
npm run setup:local
npm run dev:smart
npm run verify:local
npm run clean:local
```

## Content editing overview

Local content templates are in `src/content/templates`. Generated content is written to `src/content/generated/portfolio.generated.json`.

Edit CSV templates or Google Sheets source data, then run:

```bash
npm run generate:content
```

Local development can run without Google Sheets URLs because the generator falls back to local CSV templates.

## Testing

Run the full quality gate:

```bash
npm run verify
```

For local setup plus verification:

```bash
npm run verify:local
```

## Vercel deployment overview

The project uses Next.js static export through `next.config.mjs`. Vercel can run:

```bash
npm run build
```

Remote CSV URLs can be configured as environment variables. Set `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true` in production if demo fallback content should never deploy.

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
