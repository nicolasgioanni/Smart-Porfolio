# Content Mapping

## Source of truth

All portfolio UI content comes from generated JSON built from spreadsheet-compatible CSV sheets. Components should not hard-code Nicolas-specific portfolio facts.

## Profile mapping

Profile fields drive:

- Header and footer identity.
- Home hero name, headline, current title, location, university, degree, field of study, bio, portrait, email, CTAs, and resume link.
- Resume page profile panel.
- Route metadata defaults.

## Links mapping

The links sheet drives:

- Social links in the Home hero.
- Header compact icon links.
- Mobile navigation social links.
- Footer links and optional repository/source links.
- Resume CTA when a resume link is present.

## Skills mapping

Skills drive:

- Home skills snapshot.
- Resume skills groups.

Skills are grouped by category and sorted by priority, order, category, and name.

## Experience mapping

Experience drives:

- Home featured experience summary.
- Experience page timeline details.
- Resume experience highlights.

Home uses `home_summary`; detail pages prefer `detail_summary` and full bullets.

## Recommendations mapping

Recommendations drive:

- Home professional recommendations after Experience and before later evidence sections.
- The Recommendations page at `/recommendations`.
- The Recommendations navigation item when recommendations exist, unless empty display is explicitly enabled.
- LinkedIn/source verification links when valid HTTPS URLs are provided.

Home uses `home_quote` when available and otherwise derives a short plain-text excerpt from `full_quote`. The Recommendations page uses `full_quote`, recommender context, skills, dates, and verification links.

## Research mapping

Research drives:

- Home featured research summary.
- Research page detail cards.
- Resume research highlights.

Home uses short summaries and concise skills. The Research page includes impact, bullets, skills, and links.

## Projects mapping

Projects drive:

- Home featured project cards.
- Projects page deep-dive cards.
- Resume project highlights.

Home uses `home_summary`, stack, and key links. The Projects page adds problem, solution, impact, image, and full links.

## Education mapping

Education drives:

- Home education summary.
- Resume education section.

Home shows concise institution, degree, field, dates, summary, and short bullets only.

## Resume mapping

The resume sheet provides custom resume notes or section text. It supplements but does not replace experience, research, projects, education, and skills data.

## Home summary behavior

Home is the complete high-level overview. It includes every major category, including recommendations when available, but keeps each section concise and scannable.

## Detail page behavior

Detail pages show all relevant entries for their route with longer summaries, bullets, impact details, technical context, and links.

The Recommendations page shows all recommendations, featured first, then ordered rows. It shows a clean empty state when the recommendations sheet has no rows. Navigation hides that route while empty unless `show_empty_recommendations=true`.

## Featured, show_on_home, and ordering

Home selection uses this priority:

1. Items with `show_on_home=true`.
2. If none exist, featured items.
3. If none exist, first sorted items.

Within the chosen set, featured items sort first, then `home_order`, then date, then title or ID.

Detail pages use all relevant items. Featured items sort first, then `detail_order`, then date, then title or ID.

## Max item settings

`site_settings` values control Home section counts:

- `max_home_research_items`
- `max_home_project_items`
- `max_home_experience_items`
- `max_home_recommendation_items`
- `max_home_skill_items`

Recommendation route visibility is controlled by `enable_recommendations`, `show_empty_recommendations`, and whether the recommendations sheet contains rows.

Footer data can come from `site_settings` keys such as `license_name`, `license_url`, `copyright_owner`, and `repository_url`, or repository/source link kinds in `links`.

Missing or invalid settings fall back to safe defaults during normalization.

## Missing content and empty states

Sections never crash on missing arrays or optional fields. Empty states are shown when helpful and are written as real accessible content, not skeletons.
