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
https://example.com|GitHub=https://github.com/example|Live site=https://cytocv.uwb.edu
```

Simple URLs receive a generic label. Label and URL pairs preserve the label.

## Sheet details

### profile

Fields:

- `key`: required profile key.
- `value`: profile value.

Example keys include `full_name`, `preferred_name`, `headline`, `role_engineer_prefixes`, `role_engineer_suffix`, `role_alternate`, `current_title`, `current_company`, `current_experience_id`, `previous_experience_id`, `featured_research_id`, `primary_education_id`, `location`, `timezone`, `email`, `pronouns`, `university`, `degree`, `field_of_study`, `graduation`, `short_bio`, `long_bio`, `portrait_image`, `favicon_image`, `resume_url`, `resume_download_label`, `primary_cta_label`, and `secondary_cta_label`.

The Home role configuration is an optional complete set:

- `role_engineer_prefixes`: pipe-delimited non-empty prefixes such as `Software|AI|Security`.
- `role_engineer_suffix`: the shared suffix, such as `Engineer`.
- `role_alternate`: the complete alternate role, such as `Research Scientist`.

When all three keys are omitted or blank, Home displays the required `headline` as its static role and older sheets remain compatible. If any role key is populated, all three must be present and non-empty, and `role_engineer_prefixes` must produce at least one non-empty item; partial configurations fail content generation. Keep `headline` accurate because it remains the static fallback and is used by résumé surfaces.

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
- `home_title`: optional concise title used everywhere the row appears on Home. When blank, Home falls back to `title`; Research detail and résumé surfaces continue to use `title`.
- `role`, `organization`, `location`, `start_date`, `end_date`: optional context.
- `organization_logo`: optional static path or URL for the organization mark.
- `organization_logo_alt`: optional alt text. If blank, the UI derives text from `organization`.
- `home_summary`: short summary for the larger Home Research card.
- `profile_summary`: optional extra-compact summary used only by the Home profile-overview Research panel. When blank, that panel falls back to `home_summary`, then `detail_summary`.
- `detail_summary`: longer Research page summary.
- `impact`: optional impact statement.
- `bullets`: pipe-delimited detail bullets.
- `skills`: pipe-delimited skills.
- `links`: pipe-delimited links.
- `pending_links`: pipe-delimited display labels for resources that are not published yet. They do not accept URLs. The compact profile-overview Research panel may render them as disabled unpublished controls; the separate Home Research cards omit them.
- `image`: optional static path or URL.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

The Home profile-overview Research panel uses `home_title` with `title` as its fallback, plus the selected row's summary, verified links, `organization_logo`, and pending resource labels. Its summary resolves in the order `profile_summary`, `home_summary`, then `detail_summary`; `profile_summary` is never used by the larger Home Research cards. Research role, organization text, and dates remain available to detail contexts but are not shown in this compact panel. Its resource row is centered. Published resources use button-like link controls that are transparent at rest, reveal their surface and border on hover or keyboard focus, and never underline their labels. Pending resources such as `Manuscript` remain native disabled buttons and are non-interactive until published.

The separate Home Research section shows up to `max_home_research_items` enabled rows in `home_order`. Its cards display `home_title` with `title` fallback, organization, formatted dates, location, and a one-line `home_summary` with `detail_summary` fallback; they do not consume `profile_summary`, display Featured, or add a `Learn more` action. Verified `links` are categorized in the fixed order `Source code`, `Manuscript`, `Live demo`; resources listed only in `pending_links` are omitted until they have a public URL. Use descriptive verified-link labels such as `Live site`, `Source code`, or `Manuscript`.

### projects

Fields:

- `id`: required unique ID.
- `title`: required title.
- `subtitle`, `home_summary`, `detail_summary`, `problem`, `solution`, and `impact`: optional content.
- `home_skills`: up to three `Skill name=icon-key` pairs separated by pipes, for example `Next.js=nextdotjs|TypeScript=typescript|OpenAI API=openai`. Generation rejects rows with more than three entries.
- `home_skill_1_summary` through `home_skill_3_summary`: optional plain first-sentence descriptions for the corresponding ordered `home_skills` entry.
- `home_skill_1_details` through `home_skill_3_details`: optional technical paragraphs explaining how the corresponding tool is used in that project.
- `stack`: pipe-delimited technologies.
- `links`: pipe-delimited links.
- `image`: optional static path or URL.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

Each skill's summary and details form an optional pair: provide both fields for that position or leave both blank. Generation rejects partial pairs and explanation fields whose numbered position has no matching `home_skills` entry. Legacy rows with neither field remain valid.

Home project cards render the title, plain-text subtitle, product-focused `home_summary`, the first three `home_skills`, and verified actions in the order `Source code`, then `Live demo`. Each normalized Home skill can also expose its spreadsheet-owned summary and technical details in an interactive explanation. Featured and subtitle chips are intentionally omitted. The Projects detail route retains the longer summary, problem/solution context, complete stack, and all links.

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
- `home_quote`: legacy optional short quote; current recommendation cards use `full_quote` on both surfaces.
- `full_quote`: required full recommendation text.
- `context`: optional context note.
- `skills`: pipe-delimited skills or tags.
- `featured`, `show_on_home`: booleans.
- `home_order`, `detail_order`: numeric ordering fields.

The spreadsheet is the source of truth for recommendation text. LinkedIn links are only verification/navigation links; the site does not scrape LinkedIn, use the LinkedIn API, or fetch recommendation content at runtime.

When enabled, Home places Recommendations after the Skills cards and links to the detail route with a compact top-right button. Home selects the first configured rows through `show_on_home`, `home_order`, and `max_home_recommendation_items`; the detail page includes all rows. Both surfaces show the unchanged `full_quote` and provide an accessible `Show more`/`Show less` control with reduced-motion support. Detail cards and single-card Home rows clamp long text to four lines; a taller header in a multi-card Home row may use three quote lines so the collapsed row remains level. If no rows are published and empty display is enabled, both surfaces show an honest empty state rather than fabricated recommendation content.

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

The compact profile-overview Education panel uses the profile `degree` and `field_of_study` overrides when present. The shared formatter joins both values with `in`; the current compact values therefore render as `Degree: Bachelor of Science in Computer Science` and `Concentration: Information Assurance & Cybersecurity`. The larger Home Education card applies the same formatting to its selected education row.

On Home, every Education row selected by `show_on_home` and the standard Home ordering is rendered in the Education list. The list shows the circular institution logo or initials fallback, institution, degree and field, concentration directly beneath the degree, dates, optional location, and each `bullets` entry as a visible bullet list. `home_summary` remains available to other renderers but is omitted from this Home list. Put GPA, activities, honors, Dean's List, relevant coursework, or other concise supporting facts in `bullets`; those facts are never hard-coded by the component.

Place organization and institution marks in the shared `public/images/organizations/` directory and reference them with root-relative paths such as `/images/organizations/uw-logo.svg`. Leave logo fields blank when no approved asset is available; the Hero renders compact organization initials instead. The older `public/images/education/` path remains valid for existing assets.

### skills

Fields:

- `id`: required unique ID.
- `category`: required category.
- `category_order`: numeric order for the broad category card.
- `name`: required skill name.
- `icon`: lowercase icon key used by the shared brand/semantic icon renderer.
- `priority`: numeric priority.
- `featured`, `show_on_home`: booleans.
- `order`: numeric display order.

Home renders six broad category cards in a two-column desktop grid, with exactly six primary skills per category in the published template. Skill names and icon keys remain spreadsheet-owned; the component does not hard-code Nicolas-specific tools.

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

Supported defaults include `site_title`, `site_description`, `default_theme`, `enable_skeletons`, `enable_scroll_motion`, `enable_glass_effects`, `enable_recommendations`, `show_empty_recommendations`, `max_home_research_items`, `max_home_project_items`, `max_home_experience_items`, `max_home_recommendation_items`, `max_home_skill_items`, `recommendations_nav_label`, `license_name`, `license_url`, `copyright_owner`, `repository_url`, `legal_contact_email`, `legal_effective_date`, `hosting_provider_name`, and `hosting_privacy_url`.

Footer/legal settings:

- `legal_contact_email`: valid public contact email used by the footer and all notices.
- `legal_effective_date`: real ISO `YYYY-MM-DD` date rendered in long form on each notice.
- `hosting_provider_name`: public host name used by the Privacy Notice.
- `hosting_privacy_url`: HTTPS privacy-notice URL for the hosting provider.
- `repository_url`: HTTPS public source repository. Leave blank until an exposure audit passes and anonymous access succeeds.
- `license_name` and `license_url`: software license label and HTTPS repository license URL. The footer emits a license link only when both are present.

The progressive footer behavior is functional and does not depend on `enable_scroll_motion`; that setting continues to control decorative content reveals only.

`max_home_experience_items` remains accepted for compatibility with existing sheets, but the Home work-history list intentionally displays every experience row enabled with `show_on_home`.

Recommendation visibility settings:

- `enable_recommendations=false` hides recommendation selections and removes the navigation item.
- `show_empty_recommendations=false` keeps the navigation item hidden when the sheet has no rows.
- `show_empty_recommendations=true` keeps the Home Recommendations card, navigation item, and static Recommendations page discoverable with honest empty states even when the sheet has no rows.

## Ordering behavior

- `home_order` controls Home page ordering.
- `detail_order` controls deeper page ordering.
- `order` controls generic ordering.
- Featured Home items appear before non-featured Home items.
- Missing order values are safe and sort after ordered items.

## Home page versus detail pages

The Home page is the complete high-level overview. After the profile overview, it presents full-width Experience, Education, Research, and Projects sections, then six spreadsheet-driven Skills category cards and Recommendations before the global footer. Experience, Research, Projects, and Recommendations use compact top-right buttons to open their detail routes.

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

1. Edit the local CSV templates or the published Google Sheet.
2. Keep configured remote CSV publish links public and accessible.
3. Run `npm run generate:content`; validation and normalization write `src/content/generated/portfolio.generated.json`.
4. Review and commit the source and regenerated JSON together, then rebuild or redeploy.
5. Static pages render from generated JSON with no runtime spreadsheet request. Never maintain generated JSON by hand.
