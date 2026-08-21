# Local Development

## Prerequisites

- Node.js 22.13 or newer is required. Node.js 22 LTS matches GitHub Actions and `.nvmrc`.
- npm is required.
- PowerShell is recommended on Windows.

The project uses npm, Next.js App Router, static export, a build-time CSV/XLSX content generator, and one Cloudflare Pages Function for contact delivery. Core pages need no runtime server, database, authentication, or runtime Google Sheets request. Run Wrangler when testing the complete `/contact` flow.

## Clone and enter the project

```powershell
git clone <repository-url>
cd <repository-folder>
```

If the folder is not a Git repository, the local scripts still work as long as `package.json` is present.

## Smart Windows setup

```powershell
npm run setup:local
```

This command:

- Finds the project root.
- Checks Node and npm.
- Prints detected versions.
- Stops before installation when Node is older than 22.13.
- Uses `npm ci` when `package-lock.json` exists.
- Uses `npm install` when `package-lock.json` is missing.
- Skips install when dependencies and setup hashes are current.
- Creates `.env` from `.env.example` only when safe.
- Generates content when generated JSON is missing or stale.

Cross-platform Node alias:

```bash
npm run setup:local:node
```

## Smart dev startup

```powershell
npm run dev:smart
```

This starts the dev server after checking dependencies and generated content. It prints the local URL before starting.

PowerShell options:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Port 3000
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -Verify
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -ForceInstall
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -ForceGenerate
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/start-dev.ps1 -NoOpen
```

`-NoOpen` is accepted for compatibility. The script prints the URL and does not open a browser by default.

If the requested port is busy, the script tries the next available port up to `3010` for the default range.

Cross-platform Node alias:

```bash
npm run dev:smart:node
```

`npm run dev:smart` serves the exported-page application through Next.js development mode. It is useful for UI work, but it does not run `functions/api/contact.ts`; submissions to `/api/contact` will not work in that mode.

## Full contact-flow development

Local development uses one ignored `.env` file for both the browser build and the Pages Function. `.env.example` is the tracked, placeholder-only reference and enumerates every supported content, Turnstile, Resend, recipient, hostname, and origin variable.

1. Copy `.env.example` to `.env` if setup has not already done so, then replace the placeholders needed for the flow you are testing. Never commit `.env`.
2. Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` to a separate development widget's public key. It is the only value intentionally compiled into browser code; every other key and recipient remains server-only.
3. Configure that development Turnstile widget for the exact local hostname you will use. Keep production widget credentials separate and do not allow `localhost` on the production widget.
4. Use a restricted development Resend key and a controlled inbox for `CONTACT_RECIPIENT_EMAIL`. Never use a visitor's address as the recipient setting.
5. Build and serve both the static output and Pages Function:

```powershell
npm run setup:local
npm run dev:pages
```

The equivalent direct Wrangler command is:

```powershell
npm run build
npx --no-install wrangler pages dev out --env-file .env
```

Wrangler serves the project at `http://localhost:8788` by default. The checked-in example therefore allows `localhost` and `127.0.0.1` as Turnstile hostnames and lists both matching port-8788 origins. Remove any origin you do not use. Rebuild after changing `NEXT_PUBLIC_TURNSTILE_SITE_KEY` because Next.js compiles public values into the browser bundle.

Cloudflare's dummy Turnstile response uses the action `test`. This application deliberately requires `portfolio_contact`, so use a development widget that returns the configured action for end-to-end local testing; do not weaken production action validation to accommodate a dummy token. A Pages preview with its own `NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY`, hostname, origin, and runtime secret is another safe end-to-end option. When that preview key is blank, the preview contact form remains unavailable rather than using production credentials.

Wrangler receives local Function values explicitly through `--env-file .env`; Next.js and the build-time content generator read the same file. The package script pins the Wrangler version for reproducible local behavior. This consolidation is local-only. Production build-time public values normally use GitHub repository variables; the anonymous workbook URL uses an Actions secret solely for automatic runner-log redaction. The direct-upload credential is also held in GitHub Actions secrets, and Pages Function runtime values are configured separately in Cloudflare with sensitive values stored as encrypted secrets. See Cloudflare's [Pages local-development](https://developers.cloudflare.com/pages/functions/local-development/) and [bindings/secrets](https://developers.cloudflare.com/pages/functions/bindings/) documentation.

## Verification

```powershell
npm run verify:local
```

This prepares dependencies if needed, regenerates content, and runs `npm run verify`.

Regular quality commands:

```powershell
npm run lint
npm run typecheck
npm run test
npm run build
npm run verify
```

## Cleaning local artifacts

Default cleanup removes `.next` and `out` if present:

```powershell
npm run clean:local
```

PowerShell options:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -GeneratedContent
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -NodeModules
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -All
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/clean-local.ps1 -All -Force
```

The cleanup script never deletes:

- `src/content/templates`
- `public` assets
- `.env`

It asks for confirmation before deleting `node_modules` unless `-Force` is used.

## Editing local CSV templates

Templates live in `src/content/templates`. After editing templates, run:

```powershell
npm run generate:content
```

Then start the app:

```powershell
npm run dev:smart
```

## Testing the production static export locally

Build the static export:

```powershell
npm run build
```

The static output is written to `out/` by Next.js. A plain static file server is sufficient for page-only inspection. Use `npm run dev:pages` (or `npx --no-install wrangler pages dev out --env-file .env`) when the test must include `/api/contact`; it also exercises the checked-in `_routes.json` and `_headers` deployment files.

## Troubleshooting

### node not found

Install Node.js 22.13 or newer and open a new terminal. Node.js 22 LTS matches GitHub Actions.

### npm not found

Install npm with Node.js or repair the Node installation.

### node_modules missing

Run `npm run setup:local`.

### package-lock changed

Run `npm run setup:local`. The script detects hash changes and reinstalls.

### port 3000 in use

Run `npm run dev:smart`. The script automatically tries the next available port in the default range.

### generated content missing

Run `npm run generate:content` or `npm run setup:local`.

### invalid CSV value

Read the error from `npm run generate:content`. It usually identifies the sheet and field.

### duplicate IDs

Each collection sheet requires unique `id` values. Update the relevant CSV row.

### invalid URL

Use `https://`, `http://`, `mailto:`, or a safe root-relative path such as `/images/profile/portrait.png`. A valid root-relative path under `public/` is still publicly retrievable; keep private resume files and URLs out of public assets and content sources.

### build failure

Run `npm run verify:local` and inspect the first failing command.

### contact verification never becomes ready

Confirm `NEXT_PUBLIC_TURNSTILE_SITE_KEY` was present before the most recent build, that the development widget permits the browser hostname, and that `https://challenges.cloudflare.com` is not blocked by the browser, an extension, or a locally modified CSP.

### contact endpoint returns 400

Use a fresh token and confirm the Turnstile key pair, exact `portfolio_contact` action, and `TURNSTILE_ALLOWED_HOSTNAMES` value agree. Tokens are single-use and expire quickly. Cloudflare dummy tokens report the action `test` and therefore intentionally fail this application's production-equivalent action check.

### contact endpoint returns 403

Make the browser origin match one exact entry in `CONTACT_ALLOWED_ORIGINS`, including scheme and port. Do not add a wildcard to bypass the check.

### contact endpoint returns 503 or 502

`503` indicates missing or invalid required Function configuration. `502` indicates delivery failed after validation; verify the Resend key, verified sending domain, and controlled recipient without printing secret values or message bodies.

### PowerShell execution policy

Use the package scripts or run scripts with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```

## What scripts do not do

- They do not start the Cloudflare Pages Function unless you run Wrangler explicitly.
- They do not create Cloudflare Turnstile widgets, Resend credentials, Pages secrets, or WAF rules.
- They do not fetch Google Sheets at runtime.
- They do not overwrite an existing `.env`.
- They do not delete templates, public assets, or `.env`.
- They do not modify portfolio content except by running the existing generator.
