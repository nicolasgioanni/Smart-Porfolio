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
https://example.com|GitHub=https://github.com/example|Live site=https://cytocv2.uwb.edu
```

Simple URLs receive a generic label. Label and URL pairs preserve the label.

## Sheet details

### profile

Fields:

- `key`: required profile key.
- `value`: profile value.

Example keys include `full_name`, `preferred_name`, `headline`, `current_title`, `current_company`, `current_experience_id`, `previous_experience_id`, `featured_research_id`, `primary_education_id`, `location`, `timezone`, `email`, `pronouns`, `university`, `degree`, `field_of_study`, `graduation`, `short_bio`, `long_bio`, `portrait_image`, `favicon_image`, `resume_url`, `resume_download_label`, `primary_cta_label`, and `secondary_cta_label`.

The four Home profile-overview reference keys point to exact IDs in their matching sheets:

- `current_experience_id`: an `experience.id`.
- `previous_experience_id`: an `experience.id`.
- `featured_research_id`: a `research.id`.
- `primary_education_id`: an `education.id`.

Blank or omitted `current_experience_id`, `featured_research_id`, and `primary_education_id` values use the deterministic current/featured/first fallback. Previous Work is intentionally explicit-only: a blank or omitted `previous_experience_id` hides that section. Any populated reference that does not match a row is a content error and must fail generation rather than silently choosing different content.

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
- `organization_logo`: optional static path or URL for the organization mark.
- `organization_logo_alt`: optional alt text. If blank, the UI derives text from `organization`.
- `home_summary`: short Home page summary.
- `detail_summary`: longer Research page summary.
- `impact`: optional impact statement.
- `bullets`: pipe-delimited detail bullets.
- `skills`: pipe-delimited skills.
- `links`: pipe-delimited links.
- `pending_links`: pipe-delimited display labels for resources that are not published yet. These render as disabled controls and do not accept URLs.
- `image`: optional static path or URL.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

The selected Home profile-overview research row owns its title, role, organization, summary, logo, verified links, and pending resource labels. Its profile summary uses `home_summary`, with `detail_summary` as a fallback. Research dates remain available to the Research detail page but are not shown in the Home profile overview. Use descriptive verified-link labels such as `Live site`, `Source code`, or `Manuscript`. Put an unpublished resource label such as `Manuscript` in `pending_links` so it renders as disabled rather than pointing to a placeholder URL.

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
- `organization_logo`: optional static path or URL for the organization mark.
- `organization_logo_alt`: optional alt text. If blank, the UI derives text from `organization`.
- `type`: optional type such as `professional`, `research`, `teaching`, `internship`, `leadership`, or `volunteer`.
- `location`, `start_date`, `end_date`: optional context.
- `home_summary`: Home page summary.
- `detail_summary`: detail page summary.
- `bullets`: pipe-delimited bullets.
- `skills`: pipe-delimited skills.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

The Home Experience section renders every row with `show_on_home=true`, grouped by the exact `organization` text. It displays only `title`, `organization`, `organization_logo`, `start_date`, `end_date`, and `location`. Keep organization spelling consistent across rows that should share one company group. Blank logo fields use derived initials.

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
- `institution_logo`: optional static path or URL for an institution mark.
- `institution_logo_alt`: optional alt text for the institution logo. If blank, the UI may derive safe alt text from the institution name.
- `degree`: required degree.
- `field`, `concentration`, `location`, `start_date`, `end_date`: optional context.
- `home_summary`, `detail_summary`: optional summaries.
- `bullets`: pipe-delimited bullets.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

Use `concentration` for a formal concentration or specialization instead of appending it to `field`. A non-blank `location` remains an optional rendered line; leave it blank to hide location from the profile overview.

On Home, every Education row selected by `show_on_home` and the standard Home ordering is rendered in the Education list. The list shows the institution logo or initials fallback, institution, degree and field, dates, optional location and concentration, `home_summary`, and each `bullets` entry as plain text. Put grade, activities, honors, Dean's List, or other concise supporting facts in `home_summary` or `bullets`; those facts are never hard-coded by the component.

Place organization and institution marks in the shared `public/images/organizations/` directory and reference them with root-relative paths such as `/images/organizations/uw-logo.svg`. Leave logo fields blank when no approved asset is available; the Hero renders compact organization initials instead. The older `public/images/education/` path remains valid for existing assets.

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

`max_home_experience_items` remains accepted for compatibility with existing sheets, but the Home work-history list intentionally displays every experience row enabled with `show_on_home`.

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

The Home page is the complete high-level overview. After the profile overview, it presents full-width skills, experience, education, research, and projects sections before the global footer.

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
