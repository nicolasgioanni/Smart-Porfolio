# Security

## Static-only architecture

This portfolio is built as a static export. Content is fetched from public CSV sources at build time, normalized into generated JSON, and rendered into static pages.

The deployed site does not need a backend, database, authentication, serverless functions, or runtime Google Sheets requests to render core portfolio pages.

## Endpoints and rate limiting

There are currently no API routes, route handlers, server actions, middleware endpoints, or serverless functions in the app. Because there are no request-handling endpoints, rate limiting is not currently applicable.

If future work adds an endpoint, document its purpose, input validation, authentication needs, abuse cases, logging, and rate limiting before implementation.

## Spreadsheet data rules

Google Sheets CSV URLs are treated as public content sources. Do not store secrets, private recommendation text, credentials, unpublished contact details, or sensitive personal data in spreadsheet rows.

Generated JSON is a build artifact. Edit CSV templates or remote sheets, then run `npm run generate:content`.

## URL rules

Accepted general content URLs are:

- `https://`
- `http://`
- valid `mailto:`
- safe root-relative paths such as `/resume/resume.pdf`

Root-relative paths must not contain traversal segments such as `..`. Recommendation `source_url`, `linkedin_url`, and `full_quote_link_url` values must be HTTPS URLs.

## External links

External links that open in a new tab must use:

```text
target="_blank"
rel="noopener noreferrer"
```

LinkedIn recommendation links are verification/navigation links only. Do not scrape LinkedIn, call the LinkedIn API, or fetch recommendation content from LinkedIn at runtime.

## Rendering spreadsheet content

Spreadsheet text should render as plain React text. Do not use `dangerouslySetInnerHTML` for spreadsheet-provided content. A recommendation's optional inline link is the only structured exception: generation validates its paired label and HTTPS URL, and the component composes ordinary text nodes with one escaped anchor. Do not parse HTML or Markdown, and do not auto-link raw URLs from recommendation copy.

## Environment variables

CSV URL environment variables are public content locations, not secrets. `.env.local` is ignored by Git, and `.env.local.example` should contain examples only.

Do not expose private values through `NEXT_PUBLIC_` variables. The current app does not require private environment variables.

## Repository publication

Before changing repository visibility, scan tracked files and every reachable Git object for credentials, private contact information, unpublished assets, oversized artifacts, and unsafe configuration. Commit author and committer metadata is part of the public history and must use only approved addresses. Do not expose repository or license links in production until the audit passes and both anonymous HTTPS destinations resolve successfully. Rewriting published history and force-pushing are separate destructive operations that require explicit authorization.

## Dependency audit workflow

Run:

```powershell
npm audit
```

Classify findings as production runtime, static-build, or development tooling risk. Do not run `npm audit fix --force` without explicit approval because it can introduce major dependency upgrades.
