# Content Replacement Checklist

Use this checklist when replacing demo content with Nicolas-specific public content.

## Profile

- Replace `full_name`, `preferred_name`, `headline`, `current_title`, `current_company`, `location`, `timezone`, `email`, `university`, `degree`, `field_of_study`, `graduation`, `short_bio`, and `long_bio`.
- Keep `current_experience_id`, `featured_research_id`, and `primary_education_id` aligned with real rows where those references remain in use. Current Work and Education have deterministic fallbacks when their selectors are blank; `featured_research_id` is the Selected Research fallback when no row is marked `show_on_home`. `previous_experience_id` may remain as compatible source metadata, but it does not create a Previous Work block on Home; previous roles belong in `experience.csv` and on the Experience page. Never leave a populated stale ID because generation will fail.
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
- Keep the Home profile-overview details ordered as Headline, About, Current Work, the Education/Selected Research row, then the supporting Experience and Research links. On mobile, Selected Research stacks before Education.
- Use `organization_logo`/`organization_logo_alt` on experience and research rows and `institution_logo`/`institution_logo_alt` on education rows. Store new local marks under `public/images/organizations/`; blank logo fields intentionally render without a fake mark.
- Keep education `field` and `concentration` separate. Leave education `location` blank when it should remain hidden.
- Give research links descriptive labels such as `Live site`, `Source code`, and `Manuscript`. Add only verified public destinations. An unpublished label in `pending_links` must not create a disabled Home-card action; move it into `links` only when its public URL is ready.

## Recommendations

- Add recommendations only when the text is public-safe and approved for display.
- Required fields are `id`, `recommender_name`, and `full_quote`.
- Use `home_quote` for a short Home version when needed.
- Use HTTPS verification links only.
- Keep `show_empty_recommendations=false` until at least one recommendation row is ready, unless the empty page should be visible.

## Footer and legal

- Set `copyright_owner` if it should differ from `profile.full_name`.
- Set `repository_url` only when the source should be public.
- Set `license_name` and `license_url` only after the license choice is confirmed.
- Leave license fields blank to show an all-rights-reserved statement.

## Production strict mode

- Configure remote CSV URLs for every required sheet.
- Set `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true` when demo fallback content should never deploy.
- Run `npm run generate:content` and `npm run verify`.
