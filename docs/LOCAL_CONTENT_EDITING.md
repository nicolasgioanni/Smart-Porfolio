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

## Home profile overview

The Home profile card is driven by generated content:

- Name: `profile.full_name`
- Headline: `profile.headline`
- About: `profile.short_bio`, with a concise `profile.long_bio` fallback
- Current work: a current `experience.csv` row, optionally identified by `profile.current_experience_id`; `profile.current_title` and `profile.current_company` are used only when no suitable current row exists
- Selected research: one `research.csv` row selected from `show_on_home`, `featured`, and `home_order`; a valid `profile.featured_research_id` is the explicit fallback when no row is marked for Home
- Education row: `profile.primary_education_id`, with deterministic education fallback when blank
- Location: `profile.location`
- Timezone: `profile.timezone`
- Portrait: `profile.portrait_image`
- Contact links: GitHub, LinkedIn, Email, Resume, and Portfolio or Website rows from `links.csv`
- Education display overrides and fallbacks: `profile.university`, `profile.degree`, `profile.field_of_study`, and `profile.graduation`

Use `location` for the final wording you want shown, such as `Greater Seattle Area` or `Bothell, WA`. Use `timezone` for a stable display string such as `Pacific Time (UTC-07:00)`.

Keep the right-side detail hierarchy in this order: Headline, About, Current Work, a coordinated Education and Selected Research row, then `View full experience` and `Explore research`. Current Work is full width. On desktop, Education uses roughly 40 percent and Selected Research roughly 60 percent of their row. On mobile, Selected Research stacks before Education. The inner summaries use subtle surfaces without timeline dots, vertical rails, repeated organization badges, or heavy nested glass effects.

Current Work accepts a row as current when its `end_date` is blank, `Present`, or `Current` according to normalization. When multiple current rows are available, keep the intended row Home-visible and use `featured` plus `home_order` to make its priority clear. The selected row supplies title, organization, dates, `home_summary`, and optional `organization_logo`. Use `current_title` and `current_company` as fallback text only when there is no suitable current experience row.

Previous experience data stays in `experience.csv` and continues to appear on the Experience page. The Home profile card intentionally ignores `previous_experience_id` and never renders a Previous Work block, even if that reference remains populated for compatibility or editorial bookkeeping.

The Education panel prefers `primary_education_id`, then the Home-visible/featured/ordered education fallback. Non-blank profile university, degree, field, and graduation values override the corresponding row display values; the row still supplies concentration, dates, and optional `institution_logo`. It presents the completion date compactly as `Graduated Jun 2025` rather than repeating the full enrollment range. Education location is not repeated in this compact panel because the left profile rail already supplies geographic context.

For Selected Research, mark intended candidates with `show_on_home=true`; featured candidates sort first, followed by `home_order`. If none are marked for Home, `featured_research_id` is used when it resolves to a research row, followed by the established featured/ordered fallback. Keep `home_summary` concise because it is preferred over `detail_summary` here. The compact panel consumes only the selected title, summary, and valid `links`; it does not repeat research role, organization, logo, or dates. Missing URLs and label-only pending resources do not produce disabled actions.

All displayed personal facts remain spreadsheet-derived. Component code owns only stable section labels, the two internal route destinations, and decorative structure. It must not duplicate names, organizations, titles, programs, dates, summaries, external URLs, or asset paths. Content is normalized into generated JSON before the static build; the browser never requests Google Sheets at runtime.

## Pipe-delimited lists

Use pipe characters for list fields:

```text
Python|TypeScript|Next.js
```

The recommendations sheet uses pipe-delimited `skills` in the same format.

## Link formatting

Use either simple URLs or label and URL pairs:

```text
https://example.com|GitHub=https://github.com/username|Live site=https://cytocv2.uwb.edu
```

Research `pending_links` is a separate pipe-delimited list of labels without URLs:

```text
Manuscript|Dataset
```

Pending resources do not create disabled links in the compact Home profile card. When a resource is published, remove its label from `pending_links` and add a labelled verified URL to `links`. If a renderer supports publication status metadata, use explicit wording such as `Manuscript in preparation` rather than a button-shaped placeholder.

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
- Shared organization and institution logos: `public/images/organizations/`
- Education logos: `public/images/education/`
- Project images: `public/images/projects/`
- Research images: `public/images/research/`
- Favicon files: `public/favicon/`
- Resume PDF files: `public/resume/`

## Valid local paths

```text
/images/profile/portrait.png
/images/organizations/uw-logo.svg
/images/education/uw-logo.svg
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

Experience and research `organization_logo` values and education `institution_logo` values should point to approved real local public assets when possible. Prefer the shared `/images/organizations/` path for new marks, then place that validated root-relative path in the corresponding CSV field. Leave the field blank until an approved asset is available; compact Home panels omit the mark rather than inventing a placeholder. Use the corresponding `_logo_alt` field when the asset needs explicit alternative text.

Keep education `field` and `concentration` separate. For example, use `Computer Science & Software Engineering` as the field and `Information Assurance & Cybersecurity` as the concentration. Education `location` is optional: populate it to show a separate location line, or leave it blank to hide it.

## Google Sheets versus local templates

Local templates are enough for local development. Google Sheets CSV URLs can be added through `.env.local`, but they are not required.

If `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true`, missing CSV URL environment variables will fail content generation.

Published spreadsheet CSVs are build-time sources, not live browser data. After editing a remote sheet, run `npm run generate:content` for local verification and rebuild/redeploy the static site so the profile overview receives the updated values.

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
