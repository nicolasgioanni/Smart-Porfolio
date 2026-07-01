# Content Mapping

## Source Of Truth

All portfolio UI content comes from generated JSON built from spreadsheet-compatible CSV sheets. React components should not hard-code personal portfolio facts.

The app remains static export friendly: content is generated before build, then read from generated files by static pages.

## Profile Mapping

Profile fields drive:

- Header and footer identity.
- Home hero name, headline, current title, location, education facts, bio, portrait, email, CTAs, and resume link.
- Resume page profile panel.
- Route metadata defaults.

Portrait assets are referenced by the profile data. If a real image exists but the profile still points to a placeholder, update the content source intentionally in a separate content pass.

## Links Mapping

The links sheet drives:

- Home hero links.
- Header compact icon links.
- Mobile navigation social links.
- Footer links and optional repository/source links.
- Resume CTA when a resume link is present.

Footer repository/source can also come from `site_settings.repository_url`.

## Skills Mapping

Skills drive:

- Home skills snapshot.
- Resume skills groups.

Skills are grouped by category and sorted by priority, order, category, and name. Home skills respect `max_home_skill_items`.

## Experience Mapping

Experience drives:

- Home featured experience summary.
- Experience page timeline details.
- Resume experience highlights.

Home uses `home_summary`. Detail pages prefer `detail_summary` and full bullets.

## Research Mapping

Research drives:

- Home featured research summary.
- Research page detail cards.
- Resume research highlights.

Home uses short summaries and concise skills. The Research page includes impact, bullets, skills, and links.

## Projects Mapping

Projects drive:

- Home featured project cards.
- Projects page detail cards.
- Resume project highlights.

Home uses `home_summary`, stack, and key links. The Projects page adds problem, solution, impact, image, and full links.

## Recommendations Mapping

Recommendations drive:

- Home professional recommendations after Projects.
- The Recommendations page at `/recommendations`.
- The Recommendations navigation item when recommendations exist, unless empty display is explicitly enabled.
- LinkedIn/source verification links when valid HTTPS URLs are provided.

Home uses `home_quote` when available and otherwise derives a short excerpt from `full_quote`. The detail page uses `full_quote`, recommender context, skills, dates, and verification links.

## Education Mapping

Education drives:

- Home education summary.
- Resume education section.

Home shows concise institution, degree, field, dates, summary, and short bullets.

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
- `max_home_experience_items`
- `max_home_recommendation_items`
- `max_home_skill_items`
- `recommendations_nav_label`
- `license_name`
- `license_url`
- `copyright_owner`
- `repository_url`

Unsupported theme values resolve to `navy` at render time.

## Home Summary Behavior

Home is the complete high-level overview. It includes every major category, with recommendations only when available, while keeping each section concise and scannable.

Home order:

1. Hero
2. Skills
3. Experience
4. Research
5. Projects
6. Recommendations when available
7. Education
8. Resume/contact

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
