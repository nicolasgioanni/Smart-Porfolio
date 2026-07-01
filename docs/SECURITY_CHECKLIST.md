# Security Checklist

## Static surface

- Confirm there are no API routes, route handlers, middleware endpoints, server actions, or serverless functions.
- If an endpoint is ever added, document input validation, authentication needs, abuse cases, logging, and rate limiting before implementation.
- Do not add an endpoint solely to support content rendering.

## Content safety

- Spreadsheet data is public-safe.
- Generated JSON is not used for secrets.
- Spreadsheet text renders as plain React text.
- `dangerouslySetInnerHTML` is not used for spreadsheet content.

## URL safety

- General links are limited to `https://`, `http://`, valid `mailto:`, or safe root-relative paths.
- Root-relative paths reject traversal such as `..`.
- Recommendation `source_url` and `linkedin_url` values are HTTPS only.
- LinkedIn links are outbound verification links only.

## Environment

- `.env.local` remains local-only.
- `.env.local.example` contains examples only.
- Private values are not exposed through public environment variables.

## Dependencies

- Run `npm audit`.
- Classify advisories as production runtime, build-time, or development-tooling risk.
- Do not force major dependency upgrades without checking compatibility.
