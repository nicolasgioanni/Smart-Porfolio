# Architecture

## Static-first portfolio

This project is a static-first smart portfolio. Next.js App Router pages are rendered at build time with `output: export`, which produces static files that can be served from a CDN.

## Google Sheets as a lightweight CMS

Google Sheets is used only as a public-safe editing surface. Each sheet tab is exported as CSV. The site does not use Google API credentials and does not store secrets.

## Build-time content fetching

The content generation script reads CSV URLs from environment variables. If a URL is missing, local template CSV files are used unless strict production mode is enabled.

The script parses CSV, validates required fields, normalizes values, and writes `src/content/generated/portfolio.generated.json`.

## Generated JSON and typed UI mapping

The UI imports generated JSON through typed helpers. Pages receive normalized profile, links, research, projects, experience, recommendations, education, skills, resume, and site settings.

This keeps display components simple and avoids spreadsheet parsing inside React components.

## No backend

There is no runtime server requirement for core portfolio pages. Static export generates the HTML and client assets needed for deployment.

## No database

The spreadsheet is the editing source, and generated JSON is the build artifact. A database would add operational cost and complexity without improving the v1 portfolio workflow.

## No authentication

The portfolio only renders public-safe information. Authentication would be unnecessary for readers and incompatible with the static-first v1 goal.

## No runtime Google Sheets requests

The deployed site does not fetch spreadsheet data in the browser. This avoids loading delays, API availability issues, quota concerns, and exposure of implementation details.

## Vercel Hobby/free fit

The build runs once per deployment. The deployed output is static and does not need serverless functions, databases, background jobs, or paid runtime infrastructure.

## Home and detail layers

The Home page is the summary layer. It includes the strongest scannable overview of profile, links, skills, experience, recommendations when available, research, projects, education, and resume CTA.

The detail pages are evidence layers. Research, projects, experience, recommendations, and resume pages show longer explanations, bullets, context, impact details, recommendation quotes, and supporting links.
