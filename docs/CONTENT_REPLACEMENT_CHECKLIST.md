# Content Replacement Checklist

Use this checklist when replacing demo content with Nicolas-specific public content.

## Profile

- Replace `full_name`, `preferred_name`, `headline`, `role_engineer_prefixes`, `role_engineer_suffix`, `role_alternate`, `current_title`, `current_company`, `location`, `timezone`, `email`, `university`, `degree`, `field_of_study`, `graduation`, `short_bio`, and `long_bio`.
- Keep the three role-animation fields either all non-empty or all blank/omitted. Use pipe-delimited prefixes, and keep `headline` accurate for the static fallback and resume even when the rotating set is present.
- Confirm the sole Home H1 reads `Hi, I’m {preferred name}` with no trailing period; when `preferred_name` is blank, the first word of `full_name` is used. The full name beneath the portrait remains non-heading text.
- Keep `current_experience_id`, `featured_research_id`, and `primary_education_id` aligned with real rows where those references remain in use. Current Work and Education have deterministic fallbacks when their selectors are blank; `featured_research_id` is the Research fallback when no row is marked `show_on_home`. `previous_experience_id` may remain as compatible source metadata, but it does not create a Previous Work block on Home; previous roles belong in `experience.csv` and on the Experience page. Never leave a populated stale ID because generation will fail.
- Update `portrait_image` to a file under `public/images/profile/` or another validated public URL.
- Update `favicon_image` to a file under `public/favicon/`.
- For this private-resume configuration, keep `resume_url` and `resume_download_label` blank and do not place a resume PDF under `public/`.

## Links

- Add only intentionally public GitHub, LinkedIn, email, website, portfolio, or publication links. Do not add a resume-file link while the resume is private.
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
- Use `home_title` when a research row needs a concise title on both Home research surfaces. Keep `title` as the formal Research-page and resume title.
- Use `profile_byline` for the compact unlabelled descriptor directly beneath a Home Research title, and use pipe-delimited `profile_labs` for the labelled lab list. The compact panel must not display `role`. Use `profile_summary` only for the legacy summary layout when both structured fields are blank; it falls back to `home_summary`, then `detail_summary`. The larger Home Research card continues to use `home_summary` and ignores all profile-only fields.

- Give every Home project a plain `subtitle`, product-focused `home_summary`, three verified `home_skills` label/icon pairs, and matching `home_skill_N_summary`/`home_skill_N_details` explanation pairs. Keep each summary factual and brief, and use its details paragraph to explain the tool's concrete role in that repository. A `Source code` link is required; include `Live demo` only when one exists. Do not restore Featured or subtitle chips.
- Keep three broad Skills categories with four recruiter-focused, public-safe skills each. Set `category_order`, skill `order`, and a supported `icon` key for every row. Provide complete `proficiency`, `summary`, and `where_used` popup copy for every published skill, and ground each proficiency claim in visible project, research, teaching, or coursework evidence.

## Recommendations

- Add recommendations only when the text is public-safe and approved for display.
- Required fields are `id`, `recommender_name`, and `full_quote`.
- Keep the complete approved recommendation in `full_quote`; the detail route and single-card Home rows use four-line expansion, while multi-card Home rows may automatically show three lines for a taller-header card without changing the stored text.
- For one inline quote link, populate `full_quote_link_label` and `full_quote_link_url` together, use an HTTPS URL, and confirm the case-sensitive label occurs exactly once in `full_quote`. Otherwise leave both fields blank.
- Mark the intended first three rows `show_on_home=true` and order them with `home_order`; remaining rows stay available on the Recommendations route.
- Use HTTPS verification links only.
- Keep `show_empty_recommendations=false` until at least one recommendation row is ready, unless the empty page should be visible.

## Footer and legal

- Set `copyright_owner` if it should differ from `profile.full_name`.
- Set and verify `legal_contact_email`, `legal_effective_date`, `hosting_provider_name`, and the provider's HTTPS `hosting_privacy_url`.
- Keep the footer-only Contact form link pointed at `/contact`, and keep the public direct-email link available as a fallback.
- Confirm the Privacy and Security notices accurately describe Cloudflare Turnstile, the `/api/contact` Pages Function, Resend delivery, required email/optional phone fields, provider processing, and the lack of a contact database.
- Confirm the software license separately from the rights reserved in portfolio content.
- Audit tracked files and reachable Git history before making the repository public; stop on any unapproved credential, contact detail, asset, or configuration.
- Set `repository_url` and `license_url` only after anonymous access to both destinations succeeds. Leave them blank to omit unavailable footer resources.

## Private resume

- Keep `resume_url` and `resume_download_label` blank in the local profile template and the public workbook's `profile` tab.
- Keep `src/content/templates/resume.csv` header-only. Do not add a workbook `resume` tab or remote-source environment variable; the generator must always use the empty local template.
- Remove resume-kind file-link rows and keep resume PDFs outside `public/`, generated content, tracked source, and deploy artifacts.
- After content generation, search generated JSON, built HTML, and `out/` for old resume filenames and URLs before deployment.
- Treat old deployments, CDN caches, repository history, and shared copies as a separate exposure review. Do not claim that deleting a current link retracts an already published file.

## Production strict mode

- Configure the one anonymous XLSX export URL as the `PORTFOLIO_WORKBOOK_URL` GitHub Actions secret for automatic runner-log redaction; the downloaded workbook must contain exactly the nine required visible named tabs. The resume source remains the intentionally empty local exception.
- Keep `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true` in production so demo fallback content can never deploy.
- For local template changes, run `npm run generate:content`, review and commit the generated JSON with its source changes, then run `npm run verify`. For production workbook changes, let GitHub Actions verify and deploy the exact tested artifact; `/content-version.json`, not a repository commit, records the successful hash. Do not edit generated JSON directly.
