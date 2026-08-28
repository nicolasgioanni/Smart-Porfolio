# Content Mapping

## Source Of Truth

All portfolio UI content comes from generated JSON built from spreadsheet-compatible CSV sheets. React components should not hard-code personal portfolio facts.

The app remains static export friendly: content is generated before build, then read from generated files by static pages.

## Profile Mapping

Profile fields drive:

- Header and footer identity.
- Home profile overview greeting, role, about text, current work, education, research, location, timezone, portrait, and contact fallbacks.
- Contact and resume-request email fallbacks.
- Route metadata defaults.

Portrait assets are referenced by the profile data. If a real image exists but the profile still points to a placeholder, update the content source intentionally in a separate content pass.

The Home profile overview derives `greetingName` from `profile.preferred_name`, then the first word of `profile.full_name`. The right-side `Hi, I’m {greetingName}` greeting is the Home page's single `h1`; the full name beneath the portrait is non-heading identity text.

Spreadsheet keys `role_engineer_prefixes`, `role_engineer_suffix`, and `role_alternate` normalize to `ProfileContent.roleEngineerPrefixes`, `roleEngineerSuffix`, and `roleAlternate`. The overview exposes a discriminated role model: `kind: "rotating"` contains the parsed prefixes, shared suffix, and alternate, while `kind: "static"` contains the required `headline` fallback. A rotating configuration requires all three source fields; a partial configuration or a prefix value with no non-empty items fails generation. `headline` also remains the resume-safe role, even when Home rotates roles.

The role is followed by an About paragraph from `profile.short_bio`. If `short_bio` is blank, the existing concise `long_bio` excerpt fallback may be used; if both are blank, the About block is omitted. Components must wrap this generated copy rather than replace or truncate it with hard-coded personal text.

The right-side hierarchy is greeting, role, About, a full-width Current Work summary, then a 50/50 Education and Research row. The paired panels stretch to the same outer height and use the same geometry; Education's graduation label and Research's resource controls sit in aligned footer rows. On narrow screens, Education stacks before Research. Current Work owns the `View experience` link in its header, Research owns `View research`, and there is no detached supporting-navigation row beneath the panels. Header actions occupy an overlaid action slot so their larger hit areas do not increase header height or create a padding mismatch with Education.

Current Work prefers a suitable current experience row: an entry with a blank end date or an end date normalized as `Present` or `Current`. A valid `current_experience_id` can identify that row; when several current rows are eligible, Home visibility, featured state, and Home ordering provide deterministic selection. The selected experience supplies organization, title, dates, `home_summary`, and optional `organization_logo`. Only when no suitable current experience exists do `profile.current_title` and `profile.current_company` provide a compact fallback. Previous experience rows remain in generated content and on the Experience page, but the Home profile overview never renders a Previous Work preview.

The compact Education panel prefers the row named by `primary_education_id`, then uses the established Home-visible/featured/ordered education fallback. Non-blank `profile.university`, `profile.degree`, `profile.field_of_study`, and `profile.graduation` override the matching visible values from that row; the row supplies concentration, dates, and optional `institution_logo`. If no usable education row exists, the profile fields provide the safe fallback. When both degree and field are present, the shared education formatter joins them with `in`, so the current compact display is `Degree: Bachelor of Science in Computer Science`, followed by `Concentration: Information Assurance & Cybersecurity`. The education row uses the same formatter on the larger Home card. This panel emphasizes completion as `Graduated <date>` rather than repeating the full enrollment range, and it omits location because the left profile rail already establishes geography.

Research renders one item. It first considers rows with `show_on_home=true`, prioritizes featured entries, then uses `home_order` and the existing deterministic sort. When no row is marked for Home, a valid `featured_research_id` provides the explicit fallback before the deterministic featured/ordered fallback. Spreadsheet `home_title`, `profile_summary`, `profile_byline`, and `profile_labs` normalize into the research model. The compact view model uses the Home title with `title` fallback. When a byline or labs are present, it places the unlabelled byline directly below the title, renders the labs as a single labelled list, and omits both `role` and narrative copy. Otherwise, it preserves the legacy summary fallback from `profile_summary` to `home_summary` to `detail_summary`. It also consumes validated links, the spreadsheet organization logo, and pending resource labels while omitting organization text and dates. Its resource controls are centered, look transparent while idle, reveal a button surface and border on hover or focus, and do not underline their labels. Verified resources remain links; a label in `pending_links`, such as an unpublished `Manuscript`, renders only in this compact panel as a native disabled, non-interactive button. The separate Home Research cards continue to omit pending resources.

The `View experience` and `View research` labels and destinations are fixed internal navigation. They use static Next.js navigation inside their relevant panel headers while all personal facts and external destinations continue to come from generated spreadsheet content.

Location comes from `profile.location`, so values such as `Greater Seattle Area` or `Bothell, WA` should be set in the content source. The compact timezone row comes from `profile.timezone`.

## Links Mapping

The links sheet drives:

- Home profile contact links.
- Header compact icon links.
- Mobile navigation social links.
- Resume CTA when a resume link is present.

The footer intentionally does not repeat GitHub, LinkedIn, email, or resume icon rows from `links.csv`. Its legal contact, repository, and license resources come from `site_settings`; repository resources remain omitted while their URLs are blank.

The Home profile card left rail selects compact contact rows in this order when available: location, timezone, Email, Portfolio or Website, LinkedIn, and GitHub. Email can fall back to `profile.email`.

## Skills Mapping

Skills drive:

- Home skill-category cards.
- Shared skill groups used by portfolio surfaces.

Skills are grouped by `category`, ordered by `category_order`, and then sorted within each group by priority and `order`. Home renders three recruiter-focused category cards after Projects and before Recommendations, using a three-column desktop grid that collapses responsively. Each of the four skills per category renders its spreadsheet-owned `name` and `icon`; complete `proficiency`, `summary`, and `where_used` fields turn the badge into a dialog trigger that explains the skill and Nicolas's applied experience.

## Experience Mapping

Experience drives:

- Home work-history list.
- Experience page timeline details.

Home renders every experience row enabled with `show_on_home`, grouped by the exact `organization` value. The work-history list uses only the title, organization, logo, dates, and location; summaries, type labels, featured labels, bullets, and skills remain available to other surfaces. A compact top-right `View` button opens the Experience route.

Experience rows may provide `organization_logo` and `organization_logo_alt`. Store real local marks under `public/images/organizations/` and reference them with a validated root-relative CSV path. When a logo is blank, the Home work-history list uses compact initials derived from the organization name.

## Research Mapping

Research drives:

- Home Research card row.
- Research page detail cards.

Home renders the first three enabled research rows in a three-column desktop grid. Each larger card shows `home_title` with `title` fallback, organization, date range, location, and one-line `home_summary`; `profile_summary`, `profile_byline`, and `profile_labs` are reserved for the compact profile panel and do not replace this copy. The cards do not show a Featured tag or a `Learn more` action. They render only verified actions, in the fixed order `Source code`, `Manuscript`, then `Live demo`, and render no action for a missing or `pending_links` resource. Roles, impact callouts, bullets, skill chips, and the formal `title` remain available to the Research detail route. A compact top-right `View` button opens the Research route. Research rows may provide `organization_logo` and `organization_logo_alt` for contexts that display an organization mark.

## Projects Mapping

Projects drive:

- Home project cards.
- Projects page detail cards.

The Home section is titled `Projects`. Each card uses the plain `title` and `subtitle`, a product-focused `home_summary`, exactly three `home_skills` badges, and verified links ordered as `Source code` then optional `Live demo`. Ordered columns `home_skill_1_summary`/`home_skill_1_details` through position three map onto optional `ProjectSkill.summary`/`details` fields. A position must provide both values or neither and must have a corresponding ordered skill; legacy project rows without tool explanations remain valid. It does not render Featured or subtitle chips. A compact top-right `View` button opens the Projects route. The Projects page adds problem, solution, impact, image, complete stack, and full links.

## Recommendations Mapping

Recommendations drive:

- The Home Recommendations card after Skills.
- The Recommendations page at `/recommendations`.
- The Recommendations navigation item when recommendations exist, unless empty display is explicitly enabled.
- LinkedIn/source verification links when valid HTTPS URLs are provided.

Home shows the first three eligible recommendation rows by default, while the detail route shows all rows. Both surfaces render the unchanged `full_quote` with the recommender's name, title at the time, organization, full date, relationship, and verification link. An optional validated `fullQuoteLink` turns its one exact matching label into an accessible inline link while the surrounding quote remains plain text; the renderer does not parse markup or auto-link raw URLs. Detail cards and single-card Home rows clamp long quotes to four lines. In multi-card Home rows, a taller rendered header may reduce its quote preview to three lines, at most one line below the default, and the row shares one collapsed height. Collapsed overflow fades through the lower half of its final visible line with a true alpha mask and exposes an accessible `Show more`/`Show less` control. On Home, expansion changes only the selected card: it protrudes below the fixed collapsed panel while an invisible section reserve moves later rows and the footer down in normal document flow. Transitions are disabled for reduced motion. Recommendation copy uses the same body size as Project and Research summaries, and verification actions use the same compact geometry as their resource buttons. A compact top-right `View` button opens the Recommendations route. When recommendation display is enabled but no rows are published, Home and the detail route render an honest empty state.

## Education Mapping

Education drives:

- Home profile overview education row.
- Home education list.

The Home Education card renders every Home-selected row as a clean academic-history list. Each row uses the spreadsheet's institution mark when supplied, with compact institution initials as the visual fallback, then shows institution, degree and field, concentration directly beneath the degree, dates, optional location, and every `bullets` entry as a visible bullet list. It does not render `home_summary`, wrap entries in nested cards, or use skill-style chips. Grade, activities, honors, and similar details remain spreadsheet-owned content in `bullets`; the UI does not invent them. The profile-overview Education panel is intentionally tighter and shows only the identity-level academic facts and compact graduation label.

The Home profile overview prefers the row named by `profile.primary_education_id`, then uses the deterministic education fallback when that ID is blank. If no education row is available, it falls back to profile fields: `university`, `degree`, `field_of_study`, and `graduation`.

Education rows may provide `institution_logo`, `institution_logo_alt`, and `concentration`. Logo paths should use real safe local assets such as `/images/organizations/uw-logo.svg`; when no logo is provided, the compact panel omits the image without showing a fake mark. Education location remains available to detailed renderers but is omitted from this profile panel rather than duplicated beside the left-rail location.

Whether content comes from local templates or the nine worksheets in the XLSX downloaded from `PORTFOLIO_WORKBOOK_URL`, generation validates role-set completeness, parses role prefixes, maps the optional research profile summary, byline, and lab affiliations, resolves Home-title and legacy summary fallbacks, and writes the same normalized model. The deprecated `profile_contributions` column is still accepted as a byline alias during generation. Workbook edits are never fetched by the browser at runtime; the daily or manually dispatched GitHub workflow verifies and deploys meaningful normalized changes, and the active `/content-version.json` records the successful content hash without a repository snapshot commit.

## Resume Mapping

The resume sheet is retained as a header-only compatibility source and always normalizes to an empty array in the private-resume configuration. The Resume route publishes no resume details or files; it directs legitimate contacts to the priority contact form or the public email address.

## Site Settings Mapping

`site_settings` controls presentation and selection behavior:

- `default_theme`: `navy`, `light`, or `dark`.
- `enable_skeletons`
- `enable_scroll_motion`
- `enable_glass_effects`
- `enable_recommendations`
- `show_empty_recommendations`
- `max_home_research_items`
- `max_home_project_items`
- `max_home_experience_items` (retained for existing sheets; Home now shows every enabled experience row)
- `max_home_recommendation_items`
- `max_home_skill_items`
- `recommendations_nav_label`
- `license_name`
- `license_url`
- `copyright_owner`
- `repository_url`
- `legal_contact_email`
- `legal_effective_date`
- `hosting_provider_name`
- `hosting_privacy_url`

Unsupported theme values resolve to `navy` at render time.

`license_url`, `repository_url`, and `hosting_privacy_url` must be HTTPS URLs. `legal_contact_email` must be a valid email address. `legal_effective_date` must be a real calendar date; ISO `YYYY-MM-DD` is preferred, while valid `M/D/YYYY` and `MM/DD/YYYY` Google Sheets display values normalize to ISO. The legal routes use safe production fallbacks if legacy generated content predates these settings.

## Footer And Notice Behavior

The global footer first renders a compact copyright statement and `Details` disclosure, followed by reserved below-footer scroll space sized for the expanded disclosure. It remains compact on first view, opens after the visitor continues scrolling into that runway, and also opens when contracting content above it moves the previously lower runway boundary fully into view. It closes after upward scrolling crosses the return threshold. Expansion consumes the reserved footprint instead of extending the page at the moment it opens. The manual `Collapse` action suppresses automatic reopening until the footer interaction area is exited and later re-entered; `Details` remains the explicit accessibility fallback. Expanded content maps the owner, contact, repository, license, and hosting facts from generated content while stable notice labels and internal destinations remain component-owned. The four footer-only routes are `/contact`, `/terms`, `/privacy`, and `/security`; they are intentionally absent from header navigation.

Do not populate public repository or repository-license URLs until the tracked tree and reachable Git history pass an exposure audit and both anonymous URLs resolve successfully. Portfolio content remains rights-reserved except where stated, while distributed site software is governed by the repository's MIT License.

## Home Summary Behavior

Home is the complete high-level overview of the core portfolio narrative. Compact top-right route buttons appear on Experience, Research, Projects, and Recommendations. The Resume route remains a private-access request surface rather than a public content summary.

Home order:

1. Profile overview
2. Experience
3. Education
4. Research
5. Projects
6. Skills (three category cards)
7. Recommendations
8. Global footer

## Detail Page Behavior

Detail pages show all relevant entries for their route with longer summaries, bullets, impact details, technical context, and links.

The Recommendations page shows all recommendations, featured first, then ordered rows. It shows a clean empty state when the recommendations sheet has no rows. Navigation hides that route while empty unless `show_empty_recommendations=true`.

## Selection And Ordering

Home selection uses this priority:

1. Items with `show_on_home=true`.
2. If none exist, featured items.
3. If none exist, first sorted items.

Within the chosen set, featured items sort first, then `home_order`, then date, then title or ID.

Detail pages use all relevant items. Featured items sort first, then `detail_order`, then date, then title or ID.

## Missing Content

Sections should not crash on missing arrays or optional fields. Empty states are accessible content and should not mention internal source mechanics.
