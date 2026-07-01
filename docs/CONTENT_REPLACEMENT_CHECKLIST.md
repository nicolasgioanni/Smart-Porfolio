# Content Replacement Checklist

Use this checklist when replacing demo content with Nicolas-specific public content.

## Profile

- Replace `full_name`, `preferred_name`, `headline`, `current_title`, `current_company`, `location`, `email`, `university`, `degree`, `field_of_study`, `graduation`, `short_bio`, and `long_bio`.
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
