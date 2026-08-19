# Content Replacement Checklist

Use this checklist when replacing demo content with Nicolas-specific public content.

## Profile

- Replace `full_name`, `preferred_name`, `headline`, `role_engineer_prefixes`, `role_engineer_suffix`, `role_alternate`, `current_title`, `current_company`, `location`, `timezone`, `email`, `university`, `degree`, `field_of_study`, `graduation`, `short_bio`, and `long_bio`.
- Keep the three role-animation fields either all non-empty or all blank/omitted. Use pipe-delimited prefixes, and keep `headline` accurate for the static fallback and résumé even when the rotating set is present.
- Confirm the sole Home H1 reads `Hi, I’m {preferred name}` with no trailing period; when `preferred_name` is blank, the first word of `full_name` is used. The full name beneath the portrait remains non-heading text.
- Keep `current_experience_id`, `featured_research_id`, and `primary_education_id` aligned with real rows where those references remain in use. Current Work and Education have deterministic fallbacks when their selectors are blank; `featured_research_id` is the Research fallback when no row is marked `show_on_home`. `previous_experience_id` may remain as compatible source metadata, but it does not create a Previous Work block on Home; previous roles belong in `experience.csv` and on the Experience page. Never leave a populated stale ID because generation will fail.
- Update `portrait_image` to a file under `public/images/profile/` or another validated public URL.
- Update `favicon_image` to a file under `public/favicon/`.
- Update `resume_url` to the final PDF path under `public/resume/`.

## Links

- Add public GitHub, LinkedIn, email, resume, website, portfolio, or publication links.
- Mark only the most important links as primary or header links.
- Use footer links sparingly.

## Evidence sections

- Replace demo `research`, `projects`, `experience`, `education`, and `skills` rows with accurate public-safe rows.
- Keep Home summaries concise.
- Put deeper proof, bullets, impact, stack, and links on detail rows.
- Keep the Home profile-overview details ordered as greeting H1, role, About, Current Work, then the equal-width Education/Research row. Put `View experience` and `View research` in their relevant panel-header action slots so their larger hit areas do not change header spacing; do not restore a detached bottom navigation row. Keep the Education graduation row and Research resource row bottom-aligned. On mobile, Education stacks before Research.
- Use `organization_logo`/`organization_logo_alt` on experience and research rows and `institution_logo`/`institution_logo_alt` on education rows. Store new local marks under `public/images/organizations/`; blank logo fields intentionally render without a fake mark.
- Keep education `degree`, `field`, and `concentration` separate. The shared formatter combines `Bachelor of Science` and `Computer Science` as `Bachelor of Science in Computer Science` on both Home Education surfaces, while the selected row supplies the `Information Assurance & Cybersecurity` concentration. Leave education `location` blank when it should remain hidden.
- Give research links descriptive labels such as `Live site`, `Source code`, and `Manuscript`. Add only verified public destinations. Keep the compact profile Research resources centered and button-like: published links have a transparent idle state, reveal their surface and border on hover/focus, and do not underline their labels. The panel may show an unpublished label from `pending_links` only as a native disabled, non-interactive button; the separate Home Research cards must omit it. Move the label into `links` and remove it from `pending_links` when its public URL is ready.
- Use `home_title` when a research row needs a concise title on both Home research surfaces. Keep `title` as the formal Research-page and résumé title.
- Prefer pipe-delimited `profile_contributions` and `profile_labs` for Education-style facts in the compact Home Research panel; in that mode, `role` becomes Position and narrative copy is omitted. Use `profile_summary` only for the legacy summary layout when both structured fields are blank; it falls back to `home_summary`, then `detail_summary`. The larger Home Research card continues to use `home_summary` and ignores all profile-only fields.

- Give every Home project a plain `subtitle`, product-focused `home_summary`, three verified `home_skills` label/icon pairs, and matching `home_skill_N_summary`/`home_skill_N_details` explanation pairs. Keep each summary factual and brief, and use its details paragraph to explain the tool's concrete role in that repository. A `Source code` link is required; include `Live demo` only when one exists. Do not restore Featured or subtitle chips.
- Keep six Skills categories with six exact public-safe skills each. Set `category_order`, skill `order`, and a supported `icon` key for every row; keep a Computer Vision/ML category and a Cybersecurity/Systems category.

## Recommendations

- Add recommendations only when the text is public-safe and approved for display.
- Required fields are `id`, `recommender_name`, and `full_quote`.
- Keep the complete approved recommendation in `full_quote`; the detail route and single-card Home rows use four-line expansion, while multi-card Home rows may automatically show three lines for a taller-header card without changing the stored text.
- Mark the intended first three rows `show_on_home=true` and order them with `home_order`; remaining rows stay available on the Recommendations route.
- Use HTTPS verification links only.
- Keep `show_empty_recommendations=false` until at least one recommendation row is ready, unless the empty page should be visible.

## Footer and legal

- Set `copyright_owner` if it should differ from `profile.full_name`.
- Set and verify `legal_contact_email`, `legal_effective_date`, `hosting_provider_name`, and the provider's HTTPS `hosting_privacy_url`.
- Confirm the software license separately from the rights reserved in portfolio content.
- Audit tracked files and reachable Git history before making the repository public; stop on any unapproved credential, contact detail, asset, or configuration.
- Set `repository_url` and `license_url` only after anonymous access to both destinations succeeds. Leave them blank to omit unavailable footer resources.

## Production strict mode

- Configure remote CSV URLs for every required sheet.
- Set `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true` when demo fallback content should never deploy.
- Run `npm run generate:content`, review and commit `src/content/generated/portfolio.generated.json` with the source changes, then run `npm run verify`. Do not edit generated JSON directly.
