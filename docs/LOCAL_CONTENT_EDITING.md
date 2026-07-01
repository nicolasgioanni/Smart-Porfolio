# Local Content Editing

## Source files

Local CSV templates are in:

```text
src/content/templates
```

Generated JSON is written to:

```text
src/content/generated/portfolio.generated.json
```

Do not edit generated JSON directly unless debugging. Edit CSV templates or the Google Sheet source, then regenerate content.

## Regenerate content

```powershell
npm run generate:content
```

Then view changes locally:

```powershell
npm run dev:smart
```

## Required profile fields

The profile sheet must provide:

- `full_name`
- `headline`
- `location`
- `email`
- `short_bio`

## Pipe-delimited lists

Use pipe characters for list fields:

```text
Python|TypeScript|Next.js
```

The recommendations sheet uses pipe-delimited `skills` in the same format.

## Link formatting

Use either simple URLs or label and URL pairs:

```text
https://example.com|GitHub=https://github.com/username|Demo=https://example.com
```

## Boolean formatting

Accepted values:

- `true`
- `false`
- `yes`
- `no`
- `1`
- `0`

## Ordering fields

- `home_order` controls Home page order.
- `detail_order` controls detail page order.
- `order` controls generic display order.

Missing order values are allowed and sort after ordered items.

## show_on_home and featured

Home selection uses this priority:

1. Rows with `show_on_home=true`.
2. If none exist, featured rows.
3. If none exist, first sorted rows.

Featured rows sort before non-featured rows.

## Asset placement

Place assets in these folders:

- Portrait images: `public/images/profile/`
- Project images: `public/images/projects/`
- Research images: `public/images/research/`
- Favicon files: `public/favicon/`
- Resume PDF files: `public/resume/`

## Valid local paths

```text
/images/profile/portrait.png
/favicon/favicon.ico
/resume/Nicolas-Gioanni-Resume.pdf
```

## Valid external links

```text
https://github.com/username
https://www.linkedin.com/in/username
mailto:name@example.com
```

Recommendation `source_url` and `linkedin_url` values must be HTTPS URLs. Do not paste private LinkedIn data into the app; the spreadsheet text is the source of truth and links are only for verification/navigation.

## Google Sheets versus local templates

Local templates are enough for local development. Google Sheets CSV URLs can be added through `.env.local`, but they are not required.

If `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true`, missing CSV URL environment variables will fail content generation.

## Recommendations

Local recommendations live in `src/content/templates/recommendations.csv`. Keep template rows blank unless there is explicit public-safe recommendation text to include. Required fields are `id`, `recommender_name`, and `full_quote`.

Home uses `home_quote` when present. If it is blank, the build uses a safe excerpt from `full_quote`.

Use `show_empty_recommendations=false` in `site_settings` when the navigation should hide the Recommendations route until there is at least one recommendation row.

## Footer settings

Footer owner, license, and repository data can come from `site_settings`:

```text
copyright_owner
license_name
license_url
repository_url
```

If no license is configured, the footer uses `All rights reserved`. Do not guess a license without confirmation.

## Demo placeholder assets

The local templates reference demo-safe placeholder files so a fresh clone can render without 404s:

- `/images/profile/portrait-placeholder.png`
- `/images/projects/project-placeholder.png`
- `/images/research/research-placeholder.png`
- `/favicon/favicon.png`
- `/resume/demo-resume.pdf`

These files are generic local development assets. Replace them with Nicolas-specific files later by either overwriting the public files or by updating the matching CSV values to new root-relative paths. Keep custom assets under `public` so static export can serve them without a backend.
