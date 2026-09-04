# Content Mapping

This document maps normalized portfolio content to selectors, routes, and visible UI. It describes current consumers, not the input schema. See [Content Sheet Schema](CONTENT_SHEET_SCHEMA.md) for exact columns and validation, [Content Pipeline](CONTENT_PIPELINE.md) for generation and hashing, and [Local Content Editing](LOCAL_CONTENT_EDITING.md) for the author workflow.

## Render boundary

`src/lib/content/getPortfolioContent.ts` statically imports `src/content/generated/portfolio.generated.json` and validates it before pages use it. Components receive normalized camel-case objects from that import. They do not fetch the workbook or parse CSV in the browser.

Spreadsheet content owns portfolio facts, summaries, dates, external destinations, and asset references. Components still own stable interface copy, section headings, internal routes, accessibility labels, layout, and empty-state text. The spreadsheet is therefore the source of portfolio content, not every literal string rendered by the application.

## Shared Home selection

Research, projects, experience, and education use this candidate rule:

1. If at least one row has `show_on_home=true`, use only those rows.
2. Otherwise, if at least one row has `featured=true`, use only featured rows.
3. Otherwise, use all rows.

Candidates then sort by:

1. featured rows first;
2. `home_order`, with blank values last;
3. `start_date` in descending lexicographic order;
4. `title`, then `institution`, then `id`, depending on the item type.

Research and projects are limited by `max_home_research_items` and `max_home_project_items`. Experience and education intentionally receive no Home limit. `max_home_experience_items` is normalized but has no current selector effect. A missing, zero, or negative Home limit uses the selector fallback rather than hiding the section.

Skills use the same `show_on_home`, then featured, then all candidate rule, but use generic ordering. Recommendations use their own date and limit behavior described below.

## Detail selection

The Research, Projects, and Experience routes use every row in their collection. They sort featured rows first, then `detail_order`, then `start_date` descending, then display name or ID.

When Recommendations are enabled, their detail selector uses every recommendation row and sorts by featured, `detail_order`, `recommendation_date` descending, then recommender name or ID. When disabled, that selector returns an empty array. There is no Education detail route even though an education detail selector remains available in the content library.

## Home composition

The Home page renders in this order:

1. profile hero and overview;
2. Experience;
3. Education;
4. Research;
5. Projects;
6. Skills;
7. Recommendations, when enabled and eligible;
8. global footer.

## Profile and overview

### Identity and role

- The greeting name is `preferred_name`, or the first whitespace-delimited word of `full_name`.
- The header mark uses the first character of `preferred_name`, then `full_name`, and uses `favicon_image` with a component fallback.
- `role_engineer_prefixes`, `role_engineer_suffix`, and `role_alternate` produce the rotating Home role only when the complete validated set is present. Otherwise Home uses `headline`.
- About uses `short_bio`. The helper can fall back to `long_bio`, but valid generated content always has the required non-empty `short_bio`.
- Root metadata uses `site_title` with `full_name` as fallback, `site_description` with `short_bio` as fallback, and `favicon_image` when present.

### Current Work

Only experience rows whose `end_date` is blank, `Present`, or `Current`, case-insensitively, qualify as current.

1. `current_experience_id` wins only when it references a qualifying current row.
2. Otherwise current rows use the shared Home candidate and ordering rule.
3. If no current row exists, `current_title` and `current_company` provide the compact fallback.

The selected row supplies title, organization, dates, `home_summary`, and organization logo. `previous_experience_id` is validated compatibility data and has no current UI consumer.

### Education overview

`primary_education_id` selects its exact education row when populated. Otherwise education uses the shared Home candidate and ordering rule. If no row exists, the profile education fields can still provide a compact fallback.

Non-blank profile values for `university`, `degree`, `field_of_study`, and `graduation` override the selected row's matching visible values. The row can still supply concentration, dates, and logo. The view model retains row location, but the current compact panel does not display location or the start date. It displays institution, the combined degree and field, concentration, and a graduation label. Its logo is decorative in that context.

### Research overview

The compact profile Research panel uses a distinct selector:

1. If any research row has `show_on_home=true`, use the first such row after Home sorting.
2. Otherwise, use `featured_research_id` when it resolves.
3. Otherwise, use the first row after Home sorting.

It displays `home_title` with `title` fallback. When `profile_byline` or `profile_labs` is present, those structured values suppress narrative summary copy. Otherwise summary falls back from `profile_summary` to `home_summary` to `detail_summary`.

Published `links` with valid labels and URLs are shown. `pending_links` are trimmed, deduplicated case-insensitively, and omitted when their label matches a published link. Pending items are disabled labels, not destinations. The compact organization logo is decorative.

### Identity links

The profile identity list is assembled in this fixed order:

1. location;
2. timezone;
3. email;
4. portfolio or website;
5. LinkedIn;
6. GitHub.

Link matching uses the declared `kind` and an inferred kind from label or URL. Email falls back to `profile.email`. Other link kinds selected for general Home use do not appear in this identity list.

## Links

General Home links first select rows where any of `is_primary`, `show_on_home`, or `show_in_header` is true. If none match, they fall back to all links. They use generic ordering and are capped at six before the profile identity mapper filters to supported identity kinds.

Header links use only `show_in_header=true`, use generic ordering, and are capped at four. The same selected set appears as persistent desktop header actions and follows the route links inside the mobile dock rail while remaining outside the route-navigation landmark.

Footer resources include GitHub and LinkedIn rows whose `show_in_footer` value is true, preserving generic link order. Other footer resource links come from `site_settings`, with one exception: if `repository_url` is blank, the footer can use the first link whose kind is `repository`, `source`, or `github_repository`. That repository fallback does not consult `show_in_footer`. `icon` is normalized but has no current footer consumer.

## Experience

The page introduction uses the optional profile `experience_summary` value, with component fallback copy when the value is absent.

Home shows the complete selected experience set and groups it by `organization.trim().toLowerCase()`. Organization capitalization and surrounding whitespace therefore do not create separate groups. The first available logo in a group is reused for the group, with generated initials as the no-logo fallback.

Home displays organization, title, date range, location, and organization logo. It does not display type, summaries, bullets, or skills.

The Experience route displays every row as its own logo-led card with title, organization, date range, location, type, and current-role state. It does not render the Home grouping or the internal `featured` flag.

Known role IDs use the curated plain-language and technical narratives in `src/lib/content/experienceNarratives.ts`. Each view supplies a summary plus role-specific evidence chapters; technical tools are attached to the chapter where they were used instead of appearing as one undifferentiated stack. The page-level selector changes every card together. Unknown IDs fall back to the row's Home/detail summaries, bullets, and skills, while rows with no published detail render identity metadata and `Details not yet available.`

## Education

Home displays every selected education row. It uses institution, logo or generated initials, degree and field, concentration, date range, location, and bullets.

`home_summary`, `detail_summary`, and `detail_order` have no current UI consumer. They are also intentionally excluded from `contentHash`; see [Content Pipeline](CONTENT_PIPELINE.md#content-hash).

## Research

Home Research cards display:

- `home_title` with `title` fallback;
- organization, date range, and location;
- `home_summary` with `detail_summary` fallback;
- at most one inferred GitHub action labelled `Source code`;
- at most one inferred publication action labelled `Manuscript`;
- at most one inferred website action labelled `Live demo`.

Those actions always appear in the order above. Home cards ignore `pending_links`, role, impact, bullets, skills, profile-only fields, image, and organization logo.

The Research route displays formal `title`, role, featured status, organization, date range, location, `detail_summary` with Home fallback, impact, bullets, skills, and every link. The current detail card does not render `image` or organization logo fields.

## Projects

Home Project cards display `title`, optional `subtitle`, `home_summary` with detail fallback, up to three ordered `home_skills`, and at most one action each for inferred GitHub and website links. The fixed action labels and order are `Source code`, then `Live demo`.

A Home skill with complete summary and details opens its evidence dialog. A skill without those optional fields remains a static badge. Generation guarantees at most three skills and validates numbered explanation pairs against their positions.

The Projects route displays title, subtitle, detail summary with Home fallback, problem, solution, impact, image, full stack, and every link. `featured` affects ordering but is not displayed as a chip on project cards.

## Skills

Skills use the `show_on_home`, then featured, then all candidate rule. They sort by `priority`, `order`, category, then name. `max_home_skill_items` limits the selected flat list when it is a positive value.

Selected skills are grouped by the exact normalized `category` string. Categories sort by `category_order`, then category name. Skills within each category use generic ordering. The schema does not require a fixed category count or a fixed number of skills per category.

The Home badge displays `name` and `icon`. The complete `proficiency`, `summary`, and `where_used` set enables the skill dialog; generation rejects a partial set.

## Recommendations

The Home section and navigation item appear only when `enable_recommendations` is not false and either at least one recommendation exists or `show_empty_recommendations=true`. The static `/recommendations` route still exists when hidden; its detail selector returns no rows when Recommendations are disabled.

Home candidates use `show_on_home`, then featured, then all. They sort by featured, `home_order`, `recommendation_date` descending, then recommender name or ID. A positive `max_home_recommendation_items` sets the limit. A missing, zero, or negative value falls back to three.

Home and detail cards both display the unchanged `full_quote`, recommender name, title, organization, recommendation date, relationship, and optional inline full-quote link. `linkedin_url` is the recommender-profile destination exposed as `View profile`; `source_url` is the published-recommendation destination exposed through the provenance link and `View recommendation`. The provenance link reads `Verified` on Home and `Verified on LinkedIn` on the detail route. Home actions remain text-only, while detail actions may pair their visible labels with a decorative LinkedIn icon. Quote expansion and line clamping affect presentation only.

`home_quote`, `context`, and recommendation `skills` are normalized but have no current UI consumer.

## Site settings

| Setting | Current effect |
| --- | --- |
| `site_title` | Metadata title, with profile full name fallback. |
| `site_description` | Default metadata description, with short bio fallback. |
| `default_theme` | Initial `navy`, `light`, or `dark` theme; unsupported values resolve to `navy`. |
| `enable_skeletons` | Loading fallback behavior. |
| `enable_scroll_motion` | Page and section motion behavior. |
| `enable_glass_effects` | `data-glass-effects` value on the site shell. |
| `enable_recommendations` | Recommendations Home section, detail content, and route eligibility. |
| `show_empty_recommendations` | Allows an empty Recommendations section and route. |
| `max_home_research_items` | Positive Home Research limit. |
| `max_home_project_items` | Positive Home Projects limit. |
| `max_home_experience_items` | Normalized compatibility setting with no current selector effect. |
| `max_home_recommendation_items` | Positive Home Recommendations limit; otherwise three. |
| `max_home_skill_items` | Positive flat skill limit before grouping. |
| `recommendations_nav_label` | Header navigation label only. |
| `copyright_owner` | Footer owner, with profile full name fallback. |
| `license_name`, `license_url` | Footer license resource when both are populated. |
| `repository_url` | Preferred footer source-code destination. |
| `legal_contact_email` | Footer contact email, with profile email fallback. |
| `legal_effective_date` | Privacy, security, and terms notice content. |
| `hosting_provider_name`, `hosting_privacy_url` | Privacy and hosting notice content. |

The footer's notice labels, internal notice routes, descriptive text, and closing statement are component-owned. The footer always includes the contact form, adds contact email when available, and conditionally adds repository and license resources.

## Compatibility fields without a current UI consumer

These accepted fields should not be treated as display controls:

- profile: `previous_experience_id`, `primary_cta_label`, `secondary_cta_label`;
- links: `icon`, `show_in_footer`;
- research: `image`;
- recommendations: `home_quote`, `context`, `skills`;
- education: `home_summary`, `detail_summary`, `detail_order`;
- site settings: `max_home_experience_items`.

## Authoritative implementation

| Concern | Source |
| --- | --- |
| Home and detail selection | `src/lib/content/selectHomeContent.ts` |
| Shared ordering | `src/lib/content/sortPortfolioContent.ts` |
| Profile overview fallbacks | `src/lib/content/profileOverview.ts` |
| Home composition | `src/components/portfolio/HomeOverview.tsx` |
| Header link selection and navigation | `src/components/layout/BlobHeader.tsx`, `src/components/navigation/navigationItems.ts` |
| Footer resources | `src/components/layout/BlobFooter.tsx` |
| Collection renderers | `src/components/portfolio/` |
| Route consumers | `src/app/` |
