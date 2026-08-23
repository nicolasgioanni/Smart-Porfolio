# Content Sheet Schema

This document defines the exact CSV and XLSX row contract accepted by the content generator. It is a field reference, not an editing procedure. See [Content Pipeline](CONTENT_PIPELINE.md) for source modes and failure behavior, [Content Mapping](CONTENT_MAPPING.md) for UI consumers, and [Local Content Editing](LOCAL_CONTENT_EDITING.md) for the author workflow.

## Source layout

The public workbook must contain exactly nine visible tabs:

1. `profile`
2. `links`
3. `research`
4. `projects`
5. `experience`
6. `recommendations`
7. `education`
8. `skills`
9. `site_settings`

The local template directory contains matching CSV files for the nine public sheets plus `resume.csv`, a required header-only compatibility template. The generator reads that local file in both source modes and fails if it contains a data row. It is never imported into the public workbook.

Workbook titles are matched with `title.trim().toLowerCase()`. Case, surrounding whitespace, and physical order do not matter. Internal spaces, hyphens, punctuation, and spelling are not aliases. Every tab must be visible, and the workbook must contain no extra tabs. A `resume` worksheet is explicitly invalid even though the application has a `/resume` request route.

## Shared rules

### Exact headers

Each sheet must contain its exact header set. Header order may change, but names are trimmed, case-sensitive, unique, and lowercase. A missing, duplicate, or extra header fails generation.

### Required values and IDs

- Required fields must contain non-whitespace text after trimming.
- IDs are case-sensitive and must be unique within their collection.
- Profile reference values must exactly match an ID in the target collection.
- Blank optional text is omitted from generated JSON.
- Blank list fields become empty arrays.

### Booleans

Boolean fields accept these case-insensitive values:

```text
true
false
yes
no
1
0
```

A blank collection-row boolean defaults to `false`. Any other non-blank value fails generation.

### Numbers

Numeric fields accept any finite JavaScript number, including decimals and negative values. Blank values become absent. The normalizer does not enforce integers, non-negative values, or maximum values, so authors must use sensible positive integers for display limits and ordering.

### Lists

Pipe-delimited fields use this form:

```text
Python|TypeScript|Django|Next.js
```

Each item is trimmed and empty items are removed. Duplicate list values are not removed during normalization.

### Link lists

Research and project `links` fields accept bare URLs or `label=url` pairs separated by pipes:

```text
https://example.com|Source code=https://github.com/example/project|Live site=https://example.com/demo
```

Only the first `=` separates the label from the URL. A bare URL receives an inferred label: `Email` for `mailto`, the final segment for a root-relative path, the hostname for a valid absolute URL, or `Link` as the final fallback.

### URL policy

The general content URL validator accepts:

- `http://` and `https://` absolute URLs;
- a valid `mailto:name@example.com` value;
- a safe root-relative path beginning with one `/`.

Values cannot contain whitespace. Root-relative paths cannot contain backslashes, null bytes, protocol-relative `//`, or decoded `..` path segments.

Field-specific restrictions are stricter:

- Recommendation `source_url`, `linkedin_url`, and `full_quote_link_url` require HTTPS.
- `license_url`, `repository_url`, and `hosting_privacy_url` require HTTPS.
- Organization and institution logo fields allow root-relative or HTTP(S) values, but not `mailto`.
- Workbook download configuration has its own anonymous HTTPS-only rule.

Profile email is required as non-empty text but is not syntax-validated by the content validator. Use a valid public email address. Image fields use the general validator, so authors must still use an actual root-relative or HTTP(S) image destination rather than another technically accepted URL form.

### Dates

Most date fields remain trimmed strings. The UI formats `YYYY`, `YYYY-MM`, and `YYYY-MM-DD` values and otherwise displays the supplied text. These general date fields are not calendar-validated during generation.

`legal_effective_date` is the exception. It must normalize to a real ISO `YYYY-MM-DD` date. A valid displayed `M/D/YYYY` or `MM/DD/YYYY` value is converted to ISO first.

## `profile`

Canonical header:

```csv
key,value
```

Each row maps one snake-case key to its string value. Required keys are:

- `full_name`
- `headline`
- `location`
- `email`
- `short_bio`

Both source modes require those key rows to exist, and normalization requires each value to be non-empty. Use these documented public authoring keys:

| Key | Normalized field | Rule or consumer |
| --- | --- | --- |
| `full_name` | `fullName` | Required identity and metadata fallback. |
| `preferred_name` | `preferredName` | Optional Home greeting and header initial. |
| `headline` | `headline` | Required static role fallback. |
| `role_engineer_prefixes` | `roleEngineerPrefixes` | Optional pipe-delimited role prefixes. Requires the complete role set. |
| `role_engineer_suffix` | `roleEngineerSuffix` | Optional shared suffix. Requires the complete role set. |
| `role_alternate` | `roleAlternate` | Optional alternate role. Requires the complete role set. |
| `current_title` | `currentTitle` | Current-work fallback when no current experience row is available. |
| `current_company` | `currentCompany` | Current-work fallback when no current experience row is available. |
| `current_experience_id` | `currentExperienceId` | Must reference an `experience.id` when populated. |
| `previous_experience_id` | `previousExperienceId` | Must reference an `experience.id`; compatibility metadata with no current UI consumer. |
| `featured_research_id` | `featuredResearchId` | Must reference a `research.id` when populated. |
| `primary_education_id` | `primaryEducationId` | Must reference an `education.id` when populated. |
| `location` | `location` | Required profile location. |
| `timezone` | `timezone` | Optional timezone label. |
| `time_zone` | `timezone` | Accepted alias for `timezone`. Do not provide both. |
| `email` | `email` | Required public contact fallback. |
| `pronouns` | `pronouns` | Optional profile identity text. |
| `university` | `university` | Optional compact education override. |
| `degree` | `degree` | Optional compact education override. |
| `field_of_study` | `fieldOfStudy` | Optional compact education override. |
| `graduation` | `graduation` | Optional compact graduation override. |
| `short_bio` | `shortBio` | Required Home About copy. |
| `long_bio` | `longBio` | Optional extended biography. |
| `portrait_image` | `portraitImage` | Optional public image path or URL. |
| `favicon_image` | `faviconImage` | Optional favicon and header mark path or URL. |
| `primary_cta_label` | `primaryCtaLabel` | Compatibility field with no current UI consumer. |
| `secondary_cta_label` | `secondaryCtaLabel` | Compatibility field with no current UI consumer. |

The three role fields are all-or-nothing. If any is non-empty, all three must be non-empty and `role_engineer_prefixes` must contain at least one non-empty pipe-delimited item.

Workbook profile rows reject duplicate keys and keys outside the generator allowlist. The local CSV parser currently permits unknown or duplicate profile keys, but authors should not rely on that difference because strict remote generation rejects them.

## `links`

Canonical header:

```csv
id,label,url,icon,kind,is_primary,show_on_home,show_in_header,show_in_footer,order
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | Yes | Unique row ID. |
| `label` | Yes | Display and accessible label. |
| `url` | Yes | General supported URL. |
| `icon` | No | Compatibility field with no current component consumer. |
| `kind` | No | Defaults to `external`; used for icon and destination classification. |
| `is_primary` | No | Boolean used by Home link candidate selection. |
| `show_on_home` | No | Boolean used by Home link candidate selection. |
| `show_in_header` | No | Boolean controlling compact header and mobile links. |
| `show_in_footer` | No | Boolean controlling GitHub and LinkedIn profile links in footer resources. |
| `order` | No | Generic numeric order. |

Header links are selected only by `show_in_header`; see [Content Mapping](CONTENT_MAPPING.md) for the separate Home and footer selectors.

## `research`

Canonical header:

```csv
id,title,home_title,role,organization,organization_logo,organization_logo_alt,location,start_date,end_date,home_summary,profile_summary,profile_byline,profile_labs,detail_summary,impact,bullets,skills,links,pending_links,image,featured,show_on_home,home_order,detail_order
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | Yes | Unique row ID. |
| `title` | Yes | Formal detail title and Home fallback title. |
| `home_title` | No | Concise title for both Home research surfaces. |
| `role` | No | Detail-card role chip. |
| `organization` | No | Research affiliation text. |
| `organization_logo` | No | Root-relative or HTTP(S) mark for the compact profile panel. |
| `organization_logo_alt` | No | Normalized alt text; the compact profile mark is currently decorative. |
| `location` | No | Home card and detail metadata. |
| `start_date` | No | Display string and selection tie-breaker. |
| `end_date` | No | Display string. |
| `home_summary` | No | Home card summary and fallback copy. |
| `profile_summary` | No | Legacy compact-profile summary fallback. |
| `profile_byline` | No | Structured compact-profile byline. |
| `profile_labs` | No | Pipe-delimited compact-profile lab list. |
| `detail_summary` | No | Research detail summary and Home fallback. |
| `impact` | No | Detail impact statement. |
| `bullets` | No | Pipe-delimited detail bullets. |
| `skills` | No | Pipe-delimited detail skill chips. |
| `links` | No | Pipe-delimited general content links. |
| `pending_links` | No | Pipe-delimited labels without destinations. |
| `image` | No | Validated compatibility field with no current research renderer. |
| `featured` | No | Boolean selection and sort priority. |
| `show_on_home` | No | Boolean Home eligibility. |
| `home_order` | No | Numeric Home order. |
| `detail_order` | No | Numeric detail order. |

The compact profile panel removes pending labels that duplicate a published link label, case-insensitively, and deduplicates repeated pending labels for that view. Generated JSON preserves the original normalized list.

## `projects`

Canonical header:

```csv
id,title,subtitle,home_summary,home_skills,home_skill_1_summary,home_skill_1_details,home_skill_2_summary,home_skill_2_details,home_skill_3_summary,home_skill_3_details,detail_summary,problem,solution,impact,stack,links,image,featured,show_on_home,home_order,detail_order
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | Yes | Unique row ID. |
| `title` | Yes | Home and detail title. |
| `subtitle` | No | Home and detail subtitle. |
| `home_summary` | No | Home summary and detail fallback. |
| `home_skills` | No | Up to three pipe-delimited `name=icon-key` entries. |
| `home_skill_1_summary` | No | Popup summary for Home skill position 1. |
| `home_skill_1_details` | No | Popup details for Home skill position 1. |
| `home_skill_2_summary` | No | Popup summary for Home skill position 2. |
| `home_skill_2_details` | No | Popup details for Home skill position 2. |
| `home_skill_3_summary` | No | Popup summary for Home skill position 3. |
| `home_skill_3_details` | No | Popup details for Home skill position 3. |
| `detail_summary` | No | Detail summary and Home fallback. |
| `problem` | No | Detail problem statement. |
| `solution` | No | Detail solution statement. |
| `impact` | No | Detail impact statement. |
| `stack` | No | Pipe-delimited detail technologies. |
| `links` | No | Pipe-delimited general content links. |
| `image` | No | Detail-card image path or URL. |
| `featured` | No | Boolean selection and sort priority. |
| `show_on_home` | No | Boolean Home eligibility. |
| `home_order` | No | Numeric Home order. |
| `detail_order` | No | Numeric detail order. |

Each `home_skills` entry is split at its first `=`. The name is required. An icon key is optional, lowercased, and must match `^[a-z0-9][a-z0-9-]*$`.

For each numbered position, summary and details must both be present or both blank. Popup copy cannot exist for a missing skill position. More than three Home skills fails generation.

## `experience`

Canonical header:

```csv
id,title,organization,organization_logo,organization_logo_alt,type,location,start_date,end_date,home_summary,detail_summary,bullets,skills,featured,show_on_home,home_order,detail_order
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | Yes | Unique row ID. |
| `title` | Yes | Role title. |
| `organization` | Yes | Organization display and Home grouping value. |
| `organization_logo` | No | Root-relative or HTTP(S) mark. |
| `organization_logo_alt` | No | Explicit alt text for Home organization logos. |
| `type` | No | Detail-card type chip. |
| `location` | No | Home and detail metadata. |
| `start_date` | No | Display string and sort tie-breaker. |
| `end_date` | No | Display string and current-work classification. |
| `home_summary` | No | Compact current-work and detail fallback summary. |
| `detail_summary` | No | Detail summary. |
| `bullets` | No | Pipe-delimited detail bullets. |
| `skills` | No | Pipe-delimited detail skill chips. |
| `featured` | No | Boolean selection and sort priority. |
| `show_on_home` | No | Boolean Home eligibility. |
| `home_order` | No | Numeric Home order. |
| `detail_order` | No | Numeric detail order. |

An experience is considered current only when `end_date` is blank, `Present`, or `Current`, after trim and case normalization.

## `recommendations`

Canonical header:

```csv
id,recommender_name,recommender_title,recommender_organization,relationship,recommendation_date,source,source_url,linkedin_url,home_quote,full_quote,full_quote_link_label,full_quote_link_url,context,skills,featured,show_on_home,home_order,detail_order
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | Yes | Unique row ID. |
| `recommender_name` | Yes | Recommender display name. |
| `recommender_title` | No | Position metadata. |
| `recommender_organization` | No | Organization metadata. |
| `relationship` | No | Relationship metadata. |
| `recommendation_date` | No | Display string and sort tie-breaker. |
| `source` | No | Label for a distinct source link. |
| `source_url` | No | HTTPS source destination. |
| `linkedin_url` | No | HTTPS LinkedIn destination. |
| `home_quote` | No | Compatibility field; current cards use `full_quote`. |
| `full_quote` | Yes | Full plain-text quote on both surfaces. |
| `full_quote_link_label` | No | One exact inline label within `full_quote`. |
| `full_quote_link_url` | No | HTTPS destination paired with the inline label. |
| `context` | No | Normalized compatibility field with no current card consumer. |
| `skills` | No | Normalized compatibility list with no current card consumer. |
| `featured` | No | Boolean selection and sort priority. |
| `show_on_home` | No | Boolean Home eligibility. |
| `home_order` | No | Numeric Home order. |
| `detail_order` | No | Numeric detail order. |

The two inline-link fields must both be blank or both be present. The label match is case-sensitive and must occur exactly once in `full_quote`. Quotes remain plain text; the renderer replaces only that exact label with a link.

## `education`

Canonical header:

```csv
id,institution,institution_logo,institution_logo_alt,degree,field,concentration,location,start_date,end_date,home_summary,detail_summary,bullets,featured,show_on_home,home_order,detail_order
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | Yes | Unique row ID. |
| `institution` | Yes | Institution name. |
| `institution_logo` | No | Root-relative or HTTP(S) mark. |
| `institution_logo_alt` | No | Explicit alt text for the Home education list. |
| `degree` | Yes | Degree label. |
| `field` | No | Field of study. |
| `concentration` | No | Concentration or specialization. |
| `location` | No | Home education-list metadata. |
| `start_date` | No | Home display and sort tie-breaker. |
| `end_date` | No | Home and compact graduation display. |
| `home_summary` | No | Normalized but excluded from the current hash and UI. |
| `detail_summary` | No | Normalized but excluded from the current hash and UI. |
| `bullets` | No | Pipe-delimited Home education details. |
| `featured` | No | Boolean selection and sort priority. |
| `show_on_home` | No | Boolean Home eligibility. |
| `home_order` | No | Numeric Home order. |
| `detail_order` | No | Normalized but excluded from the current hash and UI. |

The compact profile panel can use the row for identity, concentration, dates, and its decorative mark. Profile-level university, degree, field, and graduation values override the corresponding compact values when non-empty. The larger Home education list displays row location; the compact profile panel does not.

## `skills`

Canonical header:

```csv
id,category,category_order,name,icon,proficiency,summary,where_used,priority,featured,show_on_home,order
```

| Field | Required | Rule |
| --- | --- | --- |
| `id` | Yes | Unique row ID. |
| `category` | Yes | Group key and displayed category source. |
| `category_order` | No | Numeric category order. |
| `name` | Yes | Skill label. |
| `icon` | No | Lowercase icon key matching `^[a-z0-9][a-z0-9-]*$`. |
| `proficiency` | No | Dialog context. Requires the complete popup set. |
| `summary` | No | Dialog summary. Requires the complete popup set. |
| `where_used` | No | Dialog evidence. Requires the complete popup set. |
| `priority` | No | Primary generic sort key. |
| `featured` | No | Boolean Home fallback selection. |
| `show_on_home` | No | Boolean Home eligibility. |
| `order` | No | Secondary generic sort key. |

If any popup field is present, all three must be present. The schema does not require a fixed number of categories or skills per category.

## `site_settings`

Canonical header:

```csv
key,value
```

Required key rows in both source modes are:

- `site_title`
- `site_description`
- `default_theme`

These rows must exist, but blank values leave the built-in defaults in place. The complete workbook key allowlist is:

| Key | Normalized field | Built-in default or rule |
| --- | --- | --- |
| `site_title` | `siteTitle` | `Portfolio` |
| `site_description` | `siteDescription` | Generic professional portfolio description. |
| `default_theme` | `defaultTheme` | `navy`; unsupported values resolve to `navy` in the theme resolver. |
| `enable_skeletons` | `enableSkeletons` | `true` |
| `enable_scroll_motion` | `enableScrollMotion` | `false` |
| `enable_glass_effects` | `enableGlassEffects` | `true` |
| `enable_recommendations` | `enableRecommendations` | `true` |
| `show_empty_recommendations` | `showEmptyRecommendations` | `false` |
| `max_home_research_items` | `maxHomeResearchItems` | `2` |
| `max_home_project_items` | `maxHomeProjectItems` | `3` |
| `max_home_experience_items` | `maxHomeExperienceItems` | `3`; compatibility setting ignored by current Home selection. |
| `max_home_recommendation_items` | `maxHomeRecommendationItems` | `3` |
| `max_home_skill_items` | `maxHomeSkillItems` | `12` |
| `recommendations_nav_label` | `recommendationsNavLabel` | `Recommendations`; changes the navigation label only. |
| `license_name` | `licenseName` | Optional text. |
| `license_url` | `licenseUrl` | Optional HTTPS URL. |
| `copyright_owner` | `copyrightOwner` | Optional text; footer falls back to profile name. |
| `repository_url` | `repositoryUrl` | Optional HTTPS URL. |
| `legal_contact_email` | `legalContactEmail` | Optional validated email address. |
| `legal_effective_date` | `legalEffectiveDate` | Optional real ISO date after normalization. |
| `hosting_provider_name` | `hostingProviderName` | Optional text. |
| `hosting_privacy_url` | `hostingPrivacyUrl` | Optional HTTPS URL. |

Workbook setting keys are unique and restricted to this table. The local CSV parser currently permits unknown or duplicate setting keys, but strict remote generation does not.

The maximum-item settings use positive values as limits. A zero, negative, missing, or otherwise non-positive normalized value does not mean "show none" in the selectors. It activates that selector's fallback count. Use the relevant enable setting to hide an optional surface.

## Validation checklist

Before publishing a workbook change, confirm:

- exactly nine visible tabs with normalized names matching the required set;
- exact headers with no extra columns;
- required profile and setting key rows;
- unique workbook profile and setting keys;
- unique collection IDs and valid profile references;
- complete grouped role, project-skill, skill-popup, and quote-link fields;
- only public-safe values and destinations;

Run `npm run generate:content`, review the generated diff, then run `npm run verify`. See [Content Replacement Checklist](CONTENT_REPLACEMENT_CHECKLIST.md) for the broader editorial review.
