# Deployment

## Vercel deployment

1. Audit the tracked tree and reachable Git history for secrets, private metadata, unpublished assets, and unsafe configuration; resolve every blocker before changing visibility.
2. Push the repository to GitHub only after the exposure audit passes.
3. Import the repository in Vercel.
4. Use the default npm install and build flow.
5. Build command: `npm run build`.
6. Output is static export through Next.js `output: export`.

## Environment variables

CSV URL variables:

- `PORTFOLIO_PROFILE_CSV_URL`
- `PORTFOLIO_LINKS_CSV_URL`
- `PORTFOLIO_RESEARCH_CSV_URL`
- `PORTFOLIO_PROJECTS_CSV_URL`
- `PORTFOLIO_EXPERIENCE_CSV_URL`
- `PORTFOLIO_RECOMMENDATIONS_CSV_URL`
- `PORTFOLIO_EDUCATION_CSV_URL`
- `PORTFOLIO_SKILLS_CSV_URL`
- `PORTFOLIO_RESUME_CSV_URL`
- `PORTFOLIO_SITE_SETTINGS_CSV_URL`

Optional strict mode:

- `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true`

Use strict mode for production when demo fallback content should never deploy.

## Publishing Google Sheets as CSV

1. Create one tab for each logical sheet.
2. Keep the first row as the documented field names.
3. Select `File`, then `Share`, then `Publish to web`.
4. Choose the tab and CSV format.
5. Copy the published CSV URL into the matching Vercel environment variable.

## Redeploying after content edits

After editing Google Sheets, trigger a new Vercel deployment. The build fetches CSV content, generates JSON, and renders static pages.

## Asset placement

- Portrait image: `public/images/profile/`.
- Project images: `public/images/projects/`.
- Research images: `public/images/research/`.
- Favicon: `public/favicon/`.
- Resume PDF: `public/resume/`.

Root-relative paths such as `/resume/resume.pdf` are supported by validation.

## Static export caveats

- Do not add API routes.
- Do not add server actions.
- Do not depend on runtime Google Sheets requests.
- Do not use default Next image optimization without a static-compatible configuration.
- Avoid rewrites, redirects, ISR, and other runtime server features.

The `/recommendations` route is a static page generated from the same build-time JSON as the rest of the portfolio. LinkedIn recommendation links are plain outbound links only.

## Why there are no API routes

The portfolio is static-first. Content is fetched at build time, stored in generated JSON, and rendered into static pages. This keeps the site compatible with Vercel Hobby/free and avoids runtime infrastructure.
