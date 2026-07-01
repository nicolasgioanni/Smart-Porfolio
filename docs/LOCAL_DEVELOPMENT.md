# Local Development

## Prerequisites

- Node.js 20 or newer is recommended.
- npm is required.
- PowerShell is recommended on Windows.

The project uses npm, Next.js App Router, static export, and a build-time CSV content generator. No backend, database, authentication, or runtime Google Sheets request is required for local development.

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
- Warns when Node is older than 20.
- Uses `npm ci` when `package-lock.json` exists.
- Uses `npm install` when `package-lock.json` is missing.
- Skips install when dependencies and setup hashes are current.
- Creates `.env.local` from `.env.local.example` only when safe.
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
- `.env.local`

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

## Testing production static export locally

Build the static export:

```powershell
npm run build
```

The static output is written by Next.js static export. Use a static file server if you want to inspect the generated output manually.

## Troubleshooting

### node not found

Install Node.js 20 or newer and open a new terminal.

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

Use `https://`, `http://`, `mailto:`, or a root-relative path such as `/resume/resume.pdf`.

### build failure

Run `npm run verify:local` and inspect the first failing command.

### PowerShell execution policy

Use the package scripts or run scripts with:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/setup-local.ps1
```

## What scripts do not do

- They do not create a backend.
- They do not fetch Google Sheets at runtime.
- They do not overwrite `.env.local`.
- They do not delete templates, public assets, or `.env.local`.
- They do not modify portfolio content except by running the existing generator.