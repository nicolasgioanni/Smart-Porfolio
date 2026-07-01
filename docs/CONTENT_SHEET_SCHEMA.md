# Content Sheet Schema

This portfolio uses public-safe spreadsheet content as the source of truth. Each logical sheet can be exported as CSV and converted into typed JSON during the build.

## Required sheets

- `profile`: global key-value profile facts.
- `links`: external and local links used across the site.
- `research`: research work and research context.
- `projects`: project summaries and detail content.
- `experience`: professional, research, teaching, internship, leadership, or volunteer experience.
- `recommendations`: professional recommendations and verification links.
- `education`: education entries used on Home and Resume.
- `skills`: grouped skills for Home and Resume.
- `resume`: resume-specific custom text and ordering helpers.
- `site_settings`: safe UI and selection configuration.

## Field rules

- Required profile keys are `full_name`, `headline`, `location`, `email`, and `short_bio`.
- Collection sheets with an `id` field require unique non-empty IDs.
- Optional fields may be blank.
- Invalid URLs fail validation.
- Accepted URL values are `http`, `https`, valid `mailto`, and safe root-relative paths such as `/resume/resume.pdf`.
- Root-relative paths must not contain traversal segments such as `..`.
- Date values should use `YYYY`, `YYYY-MM`, `YYYY-MM-DD`, or clear text such as `Present`.

## Boolean formatting

Accepted boolean values are:

- `true`
- `false`
- `yes`
- `no`
- `1`
- `0`

Booleans are normalized to real `true` and `false` values in generated JSON.

## List formatting

Pipe-delimited fields use this form:

```text
Python|TypeScript|Django|Next.js
```

Blank list fields become empty arrays.

## Link list formatting

List-style link fields support simple URLs or label and URL pairs:

```text
https://example.com|GitHub=https://github.com/example|Demo=https://example.com
```

Simple URLs receive a generic label. Label and URL pairs preserve the label.

## Sheet details

### profile

Fields:

- `key`: required profile key.
- `value`: profile value.

Example keys include `full_name`, `preferred_name`, `headline`, `current_title`, `current_company`, `location`, `email`, `pronouns`, `university`, `degree`, `field_of_study`, `graduation`, `short_bio`, `long_bio`, `portrait_image`, `favicon_image`, `resume_url`, `resume_download_label`, `primary_cta_label`, and `secondary_cta_label`.

### links

Fields:

- `id`: required unique ID.
- `label`: required display label.
- `url`: required URL.
- `icon`: optional icon key.
- `kind`: optional kind such as `github`, `linkedin`, `email`, `resume`, `website`, `portfolio`, `publication`, or `external`.
- `is_primary`: boolean.
- `show_on_home`: boolean.
- `show_in_header`: boolean.
- `show_in_footer`: boolean.
- `order`: numeric display order.

### research

Fields:

- `id`: required unique ID.
- `title`: required title.
- `role`, `organization`, `location`, `start_date`, `end_date`: optional context.
- `home_summary`: short Home page summary.
- `detail_summary`: longer Research page summary.
- `impact`: optional impact statement.
- `bullets`: pipe-delimited detail bullets.
- `skills`: pipe-delimited skills.
- `links`: pipe-delimited links.
- `image`: optional static path or URL.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

### projects

Fields:

- `id`: required unique ID.
- `title`: required title.
- `subtitle`, `home_summary`, `detail_summary`, `problem`, `solution`, and `impact`: optional content.
- `stack`: pipe-delimited technologies.
- `links`: pipe-delimited links.
- `image`: optional static path or URL.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

### experience

Fields:

- `id`: required unique ID.
- `title`: required title.
- `organization`: required organization.
- `type`: optional type such as `professional`, `research`, `teaching`, `internship`, `leadership`, or `volunteer`.
- `location`, `start_date`, `end_date`: optional context.
- `home_summary`: Home page summary.
- `detail_summary`: detail page summary.
- `bullets`: pipe-delimited bullets.
- `skills`: pipe-delimited skills.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

### recommendations

Fields:

- `id`: required unique ID.
- `recommender_name`: required display name.
- `recommender_title`: optional recommender title.
- `recommender_organization`: optional recommender organization.
- `relationship`: optional relationship context.
- `recommendation_date`: optional display-safe date.
- `source`: optional source label such as `LinkedIn`, `Email`, `Letter`, `Professor`, `Manager`, `Peer`, or `Other`.
- `source_url`: optional HTTPS source URL.
- `linkedin_url`: optional HTTPS LinkedIn recommendation/profile URL.
- `home_quote`: optional short quote for Home.
- `full_quote`: required full recommendation text.
- `context`: optional context note.
- `skills`: pipe-delimited skills or tags.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

The spreadsheet is the source of truth for recommendation text. LinkedIn links are only verification/navigation links; the site does not scrape LinkedIn, use the LinkedIn API, or fetch recommendation content at runtime.

### education

Fields:

- `id`: required unique ID.
- `institution`: required institution.
- `degree`: required degree.
- `field`, `location`, `start_date`, `end_date`: optional context.
- `home_summary`, `detail_summary`: optional summaries.
- `bullets`: pipe-delimited bullets.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

### skills

Fields:

- `id`: required unique ID.
- `category`: required category.
- `name`: required skill name.
- `priority`: numeric priority.
- `featured`, `show_on_home`: booleans.
- `order`: numeric display order.

### resume

Fields:

- `section`: required resume section key.
- `key`: required item key.
- `value`: required text value.
- `order`: numeric order.

The resume sheet supports resume-specific summaries, headings, or custom ordering. It does not need to duplicate all content from other sheets.

### site_settings

Fields:

- `key`: setting key.
- `value`: setting value.

Supported defaults include `site_title`, `site_description`, `default_theme`, `enable_skeletons`, `enable_scroll_motion`, `enable_glass_effects`, `enable_recommendations`, `show_empty_recommendations`, `max_home_research_items`, `max_home_project_items`, `max_home_experience_items`, `max_home_recommendation_items`, `max_home_skill_items`, `recommendations_nav_label`, `license_name`, `license_url`, `copyright_owner`, and `repository_url`.

Recommendation visibility settings:

- `enable_recommendations=false` hides recommendation selections and removes the navigation item.
- `show_empty_recommendations=false` keeps the navigation item hidden when the sheet has no rows.
- `show_empty_recommendations=true` keeps the static Recommendations page discoverable even when the sheet has no rows.

## Ordering behavior

- `home_order` controls Home page ordering.
- `detail_order` controls deeper page ordering.
- `order` controls generic ordering.
- Featured Home items appear before non-featured Home items.
- Missing order values are safe and sort after ordered items.

## Home page versus detail pages

The Home page is the complete high-level overview. It includes profile, links, skills, experience, research, projects, education, and a resume call to action in summarized form.

Detail pages contain longer explanations, full bullets, technical context, impact details, and supporting links.

## How `featured` and `show_on_home` work

- `show_on_home=true` makes an item eligible for the Home page.
- `featured=true` prioritizes an eligible item above non-featured items.
- Home page item counts are limited by `site_settings` values.

## Publishing Google Sheets as CSV

1. Create one tab per logical sheet.
2. Use the field names in this document as the header row.
3. Select `File`, then `Share`, then `Publish to web`.
4. Choose the tab and CSV output.
5. Copy the published CSV URL.
6. Store the URL in the matching environment variable.

## Environment variables

- `PORTFOLIO_PROFILE_CSV_URL`
- `PORTFOLIO_LINKS_CSV_URL`
- `PORTFOLIO_RESEARCH_CSV_URL`
- `PORTFOLIO_PROJECTS_CSV_URL`
- `PORTFOLIO_EXPERIENCE_CSV_URL`
- `PORTFOLIO_RECOMMENDATIONS_CSV_URL`
- `PORTFOLIO_EDUCATION_CSV_URL`
- `PORTFOLIO_SKILLS_CSV_URL`
- `PORTFOLIO_RESUME_CSV_URL`
- `PORTFOLIO_SITE_SETTINGS_CSV_URL`
- `PORTFOLIO_REQUIRE_REMOTE_CONTENT`

When `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true`, missing CSV URLs fail the content generation step. This helps prevent accidental demo-content deployments.

## Updating the portfolio

1. Edit the Google Sheet.
2. Keep the CSV publish link public and accessible.
3. Redeploy the site on Vercel.
4. The build fetches the CSV files and writes generated JSON.
5. The static pages render from generated JSON with no runtime spreadsheet request.
