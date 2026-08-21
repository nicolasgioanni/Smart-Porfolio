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

Generation validates and normalizes the CSV data, then rewrites `src/content/generated/portfolio.generated.json`. Review and commit the source CSV and regenerated JSON together; never maintain the generated file by hand.

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

- Greeting: `Hi, I’m {greetingName}`, where `greetingName` comes from `profile.preferred_name` or the first word of `profile.full_name`
- Animated role source keys: `role_engineer_prefixes`, `role_engineer_suffix`, and `role_alternate`
- Static role and résumé fallback: `profile.headline`
- About: `profile.short_bio`, with a concise `profile.long_bio` fallback
- Current work: a current `experience.csv` row, optionally identified by `profile.current_experience_id`; `profile.current_title` and `profile.current_company` are used only when no suitable current row exists
- Research: one `research.csv` row selected from `show_on_home`, `featured`, and `home_order`; a valid `profile.featured_research_id` is the explicit fallback when no row is marked for Home
- Education row: `profile.primary_education_id`, with deterministic education fallback when blank
- Location: `profile.location`
- Timezone: `profile.timezone`
- Portrait: `profile.portrait_image`
- Contact links: GitHub, LinkedIn, Email, Resume, and Portfolio or Website rows from `links.csv`
- Education display overrides and fallbacks: `profile.university`, `profile.degree`, `profile.field_of_study`, and `profile.graduation`

Use `location` for the final wording you want shown, such as `Greater Seattle Area` or `Bothell, WA`. Use `timezone` for a stable display string such as `Pacific Time (UTC-07:00)`.

The three animated-role fields are an optional complete set. Use a pipe-delimited prefix value such as `Software|AI|Security`, a shared suffix such as `Engineer`, and a complete alternate such as `Research Scientist`. Leave all three blank or omit them to show `profile.headline` statically. If any one is populated, all three must be non-empty or generation fails; a prefix value containing only empty pipe segments also fails. Generated JSON stores these as `roleEngineerPrefixes`, `roleEngineerSuffix`, and `roleAlternate`. Keep `headline` concise and accurate because résumé surfaces and the static fallback still use it.

Keep the right-side detail hierarchy in this order: greeting H1, role, About, Current Work, then a coordinated Education and Research row. Current Work is full width; its `View experience` link sits in the panel header. Research owns `View research` in its header. These links use an overlaid action slot so their hit areas do not make Current Work or Research headers taller than Education. Do not add a detached supporting-link row below the panels. On desktop, Education and Research split the row evenly, stretch to the same outer height, and align their bottom graduation/resource footer rows. Center the Research resources within that footer. On mobile, Education stacks before Research. The inner summaries use subtle surfaces without timeline dots, vertical rails, repeated organization badges, or heavy nested glass effects.

Current Work accepts a row as current when its `end_date` is blank, `Present`, or `Current` according to normalization. When multiple current rows are available, keep the intended row Home-visible and use `featured` plus `home_order` to make its priority clear. The selected row supplies title, organization, dates, `home_summary`, and optional `organization_logo`. Use `current_title` and `current_company` as fallback text only when there is no suitable current experience row.

Previous experience data stays in `experience.csv` and continues to appear on the Experience page. The Home profile card intentionally ignores `previous_experience_id` and never renders a Previous Work block, even if that reference remains populated for compatibility or editorial bookkeeping.

The Education panel prefers `primary_education_id`, then the Home-visible/featured/ordered education fallback. Non-blank profile university, degree, field, and graduation values override the corresponding row display values; the row still supplies concentration, dates, and optional `institution_logo`. Keep `profile.degree=Bachelor of Science` and `profile.field_of_study=Computer Science`; the shared formatter presents them as `Degree: Bachelor of Science in Computer Science`. Keep the row's concentration as `Concentration: Information Assurance & Cybersecurity`. The panel presents the completion date compactly as `Graduated Jun 2025` rather than repeating the full enrollment range. Education location is not repeated because the left profile rail already supplies geographic context.

For Research, mark intended candidates with `show_on_home=true`; featured candidates sort first, followed by `home_order`. If none are marked for Home, `featured_research_id` is used when it resolves to a research row, followed by the established featured/ordered fallback. Use optional `home_title` for a concise display title on both the profile-overview panel and the separate Home Research card; leave it blank to use `title`. Research detail and résumé surfaces continue to use the formal `title`. For an Education-style compact profile panel, put separate pipe-delimited facts in `profile_contributions` and `profile_labs`; the panel displays `role` as Position and omits narrative copy. When both structured fields are blank, legacy copy resolves from `profile_summary`, then `home_summary`, then `detail_summary`. The larger Home Research card continues to use `home_summary` and never consumes the profile-only fields. The compact panel also consumes valid `links`, `organization_logo`, and `pending_links`; it does not repeat organization text or dates. Published resource links are centered button-like controls with no underline: they remain transparent while idle and reveal a surface and border on hover or keyboard focus. A pending resource may appear there only as a native disabled, non-interactive button. The separate Home Research cards omit label-only pending resources.

All displayed personal facts remain spreadsheet-derived. Component code owns only the greeting format, stable section labels, the two internal route destinations, and decorative structure. It must not duplicate names, roles, organizations, titles, programs, dates, summaries, external URLs, or asset paths. Content is normalized into generated JSON before the static build; the browser never requests Google Sheets at runtime.

## Pipe-delimited lists

Use pipe characters for list fields:

```text
Python|TypeScript|Next.js
```

The recommendations sheet uses pipe-delimited `skills` in the same format.

Project `home_skills` entries pair a visible label with a lowercase icon key:

```text
Next.js=nextdotjs|TypeScript=typescript|OpenAI API=openai
```

Keep exactly three verified `home_skills` on every published Home project; content validation rejects a fourth entry. The Skills sheet stores one exact skill per row; use `category_order` for the six broad-card order and `icon` for the shared brand or semantic icon key. The published Home layout expects six skills in each of six categories.

Project tool explanations use ordered column pairs that match the `home_skills` positions:

```text
home_skill_1_summary: Next.js powers the project's web interface and routing.
home_skill_1_details: The precise technical paragraph describing how Next.js is used.
```

Repeat the pattern through `home_skill_3_summary` and `home_skill_3_details`. Fill both fields for a position or leave both blank; a one-sided pair fails content validation. A numbered pair also fails when there is no skill at that position in `home_skills`. Existing rows with no explanation fields remain compatible.

## Link formatting

Use either simple URLs or label and URL pairs:

```text
https://example.com|GitHub=https://github.com/username|Live site=https://cytocv.uwb.edu
```

Research `pending_links` is a separate pipe-delimited list of labels without URLs:

```text
Manuscript|Dataset
```

Pending resources have no URL. The compact Home profile Research panel may expose one as a native disabled, non-interactive unpublished button, such as `Manuscript`, while the separate Home Research cards omit it. Do not emulate this state with an actionable link or click handler. When a resource is published, remove its label from `pending_links` and add a labelled verified URL to `links`; never leave both entries populated for the same resource.

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

Keep education `degree`, `field`, and `concentration` separate. For the current row, use `Bachelor of Science` as the degree, `Computer Science` as the field, and `Information Assurance & Cybersecurity` as the concentration. The shared formatter produces `Bachelor of Science in Computer Science` wherever the Home program is shown. Education `location` is optional: populate it to show a separate location line, or leave it blank to hide it.

## Google Sheets versus local templates

Local templates are enough for local development. Google Sheets CSV URLs can be added through `.env.local`, but they are not required.

If `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true`, missing CSV URL environment variables will fail content generation.

Published spreadsheet CSVs are build-time sources, not live browser data. After editing a remote sheet, run `npm run generate:content` for local verification and rebuild/redeploy the static site so the profile overview receives the updated values.

## Recommendations

Local recommendations live in `src/content/templates/recommendations.csv`. Keep template rows blank unless there is explicit public-safe recommendation text to include. Required fields are `id`, `recommender_name`, and `full_quote`.

Both Home and the Recommendations page display the unchanged `full_quote`. Home shows the first three rows selected by `show_on_home` and `home_order`; the detail route shows all rows by `detail_order`. Detail cards and single-card Home rows use a four-line `Show more`/`Show less` preview. Multi-card Home rows automatically reduce a taller-header card to three quote lines when needed for a level collapsed row; this is a display treatment and does not shorten the stored quote. `home_quote` remains accepted only for compatibility and is not the current display source.

To link one phrase inside a quote, set both `full_quote_link_label` and `full_quote_link_url`. For example, use `CytoCV` and `https://github.com/BrentLagesse/CytoCV`; the case-sensitive label must occur exactly once in `full_quote`, and the URL must use HTTPS. Leave both fields blank when no inline link is needed. Keep `full_quote` as plain text rather than adding a raw URL, HTML, or Markdown link syntax.

Use `show_empty_recommendations=false` in `site_settings` when the navigation should hide the Recommendations route until there is at least one recommendation row.

## Footer and legal settings

Footer identity, legal, hosting, license, and repository data come from `site_settings`:

```text
copyright_owner
license_name
license_url
repository_url
legal_contact_email
legal_effective_date
hosting_provider_name
hosting_privacy_url
```

Use an ISO `YYYY-MM-DD` legal effective date and HTTPS repository, license, and hosting privacy URLs. `license_name=MIT` records the software license choice, but leave `repository_url` and `license_url` blank until the repository passes its exposure audit, is publicly accessible, and both anonymous links have been verified. Blank repository resources are omitted cleanly. The compact copyright statement reserves portfolio content except where another notice, such as the software license, states otherwise.

## Demo placeholder assets

The local templates reference demo-safe placeholder files so a fresh clone can render without 404s:

- `/images/profile/portrait-placeholder.png`
- `/images/projects/project-placeholder.png`
- `/images/research/research-placeholder.png`
- `/favicon/favicon.png`
- `/resume/demo-resume.pdf`

These files are generic local development assets. Replace them with Nicolas-specific files later by either overwriting the public files or by updating the matching CSV values to new root-relative paths. Keep custom assets under `public` so static export can serve them without a backend.
