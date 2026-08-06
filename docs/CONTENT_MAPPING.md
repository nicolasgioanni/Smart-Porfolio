# Content Mapping

## Source Of Truth

All portfolio UI content comes from generated JSON built from spreadsheet-compatible CSV sheets. React components should not hard-code personal portfolio facts.

The app remains static export friendly: content is generated before build, then read from generated files by static pages.

## Profile Mapping

Profile fields drive:

- Header and footer identity.
- Home profile overview name, headline, about text, current work, education, selected research, location, timezone, portrait, and contact fallbacks.
- Resume page profile panel.
- Route metadata defaults.

Portrait assets are referenced by the profile data. If a real image exists but the profile still points to a placeholder, update the content source intentionally in a separate content pass.

The Home profile overview uses `profile.full_name` for the single Home page `h1`. Its right-side introduction begins with `profile.headline`, followed immediately by an About paragraph from `profile.short_bio`. If `short_bio` is blank, the existing concise `long_bio` excerpt fallback may be used; if both are blank, the About block is omitted. Components must wrap this generated copy rather than replace or truncate it with hard-coded personal text.

The right-side hierarchy is Headline, About, a full-width Current Work summary, a coordinated Education and Selected Research row, then restrained links to `/experience` and `/research`. On desktop, Education occupies approximately 40 percent of the paired row and Selected Research approximately 60 percent. On narrow screens, the row becomes a single column with Selected Research before Education. These are subtle internal panels inside the existing glass shell, not timeline entries or independent heavy cards.

Current Work prefers a suitable current experience row: an entry with a blank end date or an end date normalized as `Present` or `Current`. A valid `current_experience_id` can identify that row; when several current rows are eligible, Home visibility, featured state, and Home ordering provide deterministic selection. The selected experience supplies organization, title, dates, `home_summary`, and optional `organization_logo`. Only when no suitable current experience exists do `profile.current_title` and `profile.current_company` provide a compact fallback. Previous experience rows remain in generated content and on the Experience page, but the Home profile overview never renders a Previous Work preview.

The compact Education panel prefers the row named by `primary_education_id`, then uses the established Home-visible/featured/ordered education fallback. Non-blank `profile.university`, `profile.degree`, `profile.field_of_study`, and `profile.graduation` override the matching visible values from that row; the row supplies concentration, dates, and optional `institution_logo`. If no usable education row exists, the profile fields provide the safe fallback. This panel emphasizes completion as `Graduated <date>` rather than repeating the full enrollment range, and it omits location because the left profile rail already establishes geography.

Selected Research renders one item. It first considers rows with `show_on_home=true`, prioritizes featured entries, then uses `home_order` and the existing deterministic sort. When no row is marked for Home, a valid `featured_research_id` provides the explicit fallback before the deterministic featured/ordered fallback. The compact view model contains only the selected title, concise `home_summary` with `detail_summary` fallback, and validated links, so it does not repeat research role, organization, logo, or dates already established elsewhere. Missing URLs and `pending_links` never create disabled-looking Home-card links; publication status may appear only as non-interactive metadata when the content contains a meaningful status.

The supporting `View full experience` and `Explore research` links are fixed internal route labels. They use static Next.js navigation while all personal facts and external destinations continue to come from generated spreadsheet content.

Location comes from `profile.location`, so values such as `Greater Seattle Area` or `Bothell, WA` should be set in the content source. The compact timezone row comes from `profile.timezone`.

## Links Mapping

The links sheet drives:

- Home profile contact links.
- Header compact icon links.
- Mobile navigation social links.
- Footer links and optional repository/source links.
- Resume CTA when a resume link is present.

Footer repository/source can also come from `site_settings.repository_url`.

The Home profile card left rail selects compact contact rows in this order when available: location, timezone, Email, Portfolio or Website, LinkedIn, and GitHub. Email can fall back to `profile.email`.

## Skills Mapping

Skills drive:

- The Home core-toolkit line and interactive capability evidence.
- Resume skills groups.

Skills are grouped by category and sorted by priority, order, category, and name. Home skills respect `max_home_skill_items`. Home capability stories resolve their supporting titles, summaries, outcomes, and tools from the selected experience, research, and project entries; when those entries are unavailable, the Home section falls back to the grouped skills view.

## Experience Mapping

Experience drives:

- Home work-history list.
- Experience page timeline details.
- Resume experience highlights.

Home renders every experience row enabled with `show_on_home`, grouped by the exact `organization` value. The work-history list uses only the title, organization, logo, dates, and location; summaries, type labels, featured labels, bullets, and skills remain available to other surfaces.

Experience rows may provide `organization_logo` and `organization_logo_alt`. Store real local marks under `public/images/organizations/` and reference them with a validated root-relative CSV path. When a logo is blank, the Home work-history list uses compact initials derived from the organization name.

## Research Mapping

Research drives:

- Home featured research summary.
- Research page detail cards.
- Resume research highlights.

Home uses short summaries and concise skills. The Research page includes dates, impact, bullets, skills, and verified links. Research rows may provide `organization_logo` and `organization_logo_alt` for contexts that display an organization mark, but the compact Selected Research panel does not repeat the Current Work organization badge. Link labels such as `Live site`, `Source code`, and `Manuscript` should describe verified destinations. A `pending_links` label records an unpublished resource without creating a disabled Home-card action; move it into `links` only when a valid public URL exists.

## Projects Mapping

Projects drive:

- Home featured project cards.
- Projects page detail cards.
- Resume project highlights.

Home uses `home_summary`, stack, and key links. The Projects page adds problem, solution, impact, image, and full links.

## Recommendations Mapping

Recommendations drive:

- The Recommendations page at `/recommendations`.
- The Recommendations navigation item when recommendations exist, unless empty display is explicitly enabled.
- LinkedIn/source verification links when valid HTTPS URLs are provided.

Recommendation summaries may use `home_quote` when available and otherwise derive a short excerpt from `full_quote`. The detail page uses `full_quote`, recommender context, skills, dates, and verification links.

## Education Mapping

Education drives:

- Home profile overview education row.
- Home education summary.
- Resume education section.

Home summaries use concise institution, degree, field, dates, summary, and short bullets. The profile-overview Education panel is intentionally tighter and shows only the identity-level academic facts and compact graduation label.

The Home profile overview prefers the row named by `profile.primary_education_id`, then uses the deterministic education fallback when that ID is blank. If no education row is available, it falls back to profile fields: `university`, `degree`, `field_of_study`, and `graduation`.

Education rows may provide `institution_logo`, `institution_logo_alt`, and `concentration`. Logo paths should use real safe local assets such as `/images/organizations/uw-logo.svg`; when no logo is provided, the compact panel omits the image without showing a fake mark. Education location remains available to detailed renderers but is omitted from this profile panel rather than duplicated beside the left-rail location.

Changing the Home profile overview does not require a schema migration. Whether content comes from local templates or published spreadsheet CSV URLs, generation produces the same normalized model. Remote sheet edits are not fetched by the browser at runtime; regenerate content and redeploy the static site before expecting those edits to appear.

## Resume Mapping

The resume sheet provides custom resume notes or section text. It supplements experience, research, projects, education, and skills data.

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

Unsupported theme values resolve to `navy` at render time.

## Home Summary Behavior

Home is the complete high-level overview of the core portfolio narrative. Recommendations and resume content remain on their dedicated routes so Projects can lead directly into the global footer.

Home order:

1. Profile overview
2. Skills
3. Experience
4. Education
5. Research
6. Projects
7. Global footer

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
