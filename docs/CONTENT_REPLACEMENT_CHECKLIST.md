# Content Replacement Checklist

Use this checklist when replacing local sample content or preparing a public workbook release. It assumes the exact contract in [Content Sheet Schema](CONTENT_SHEET_SCHEMA.md), the selector behavior in [Content Mapping](CONTENT_MAPPING.md), and the workflow in [Local Content Editing](LOCAL_CONTENT_EDITING.md).

## Publication boundary

- [ ] Confirm every value, quote, email address, URL, and image is approved for anonymous publication.
- [ ] Remove credentials, tokens, recipient-only addresses, internal notes, and unpublished personal data.
- [ ] Confirm third-party names, marks, quotes, and media have appropriate attribution and permission.
- [ ] Audit tracked files and reachable Git history before making the repository public; stop on any unapproved credential, contact detail, asset, or configuration.
- [ ] Treat everything under `public/`, every workbook tab, and generated JSON as public build input.

## Workbook and headers

- [ ] Keep exactly the nine required visible workbook tabs: `profile`, `links`, `research`, `projects`, `experience`, `recommendations`, `education`, `skills`, and `site_settings`.
- [ ] Keep `resume.csv` header-only and local; never add a `resume` worksheet to the downloadable workbook.
- [ ] Remove extra, hidden, very-hidden, archive, and instruction tabs from the downloadable workbook.
- [ ] Compare every complete header row with [Content Sheet Schema](CONTENT_SHEET_SCHEMA.md). Header order may differ, but spelling, lowercase case, and membership must be exact.
- [ ] Keep workbook key rows within the `profile` and `site_settings` allowlists and remove duplicate keys.

## Profile

- [ ] Populate the required `full_name`, `headline`, `location`, `email`, and `short_bio` values.
- [ ] Set `preferred_name`, timezone, pronouns, portrait, favicon, and longer profile copy only when they are accurate and approved.
- [ ] Populate all three rotating-role fields together, or leave all three blank. Keep at least one non-empty pipe-delimited prefix.
- [ ] Keep `headline` accurate even when rotating-role copy is enabled because it remains the static and metadata fallback.
- [ ] Verify `current_experience_id`, `featured_research_id`, and `primary_education_id` exactly match real collection IDs when populated.
- [ ] Treat `previous_experience_id` and CTA label fields as compatibility data, not current display controls.
- [ ] Confirm profile education overrides are intentional. Non-blank profile university, degree, field, and graduation values override the selected education row in the compact overview.
- [ ] Confirm `portrait_image` and `favicon_image` resolve anonymously without redirects to login content.

## Links

- [ ] Add only verified public destinations and use a meaningful `kind`.
- [ ] Use `is_primary`, `show_on_home`, and `show_in_header` deliberately. Header output is capped at four and general Home selection at six before identity filtering.
- [ ] Confirm profile identity links appear in the intended fixed order: location, timezone, email, portfolio or website, LinkedIn, GitHub.
- [ ] Set `show_in_footer=true` for the GitHub and LinkedIn profile links that should appear in footer resources. Do not rely on `icon` for footer rendering.
- [ ] Set `repository_url` in `site_settings` when the footer must use an exact repository destination. Otherwise, understand the footer's repository-kind link fallback.

## Experience and education

- [ ] Give every row a unique, stable ID and all required fields.
- [ ] Use blank, `Present`, or `Current` as an experience end date only when the role should qualify for the Current Work selector.
- [ ] Set `show_on_home`, `featured`, and `home_order` to make Home selection deterministic.
- [ ] Check organization spelling and capitalization. Home groups experience with `organization.trim().toLowerCase()`.
- [ ] Verify titles, organizations, dates, locations, summaries, bullets, and skills against the underlying evidence.
- [ ] Keep education `degree`, `field`, and `concentration` semantically separate.
- [ ] Confirm education bullets are concise enough for Home because all selected bullets render there.
- [ ] Do not expect education summaries or `detail_order` to render; those fields have no current UI consumer.
- [ ] Supply real logo paths and useful alt text where a visible list logo needs it, or leave the logo blank to use the initials fallback.

## Research

- [ ] Keep `title` formal and use `home_title` only when a shorter Home title is needed.
- [ ] Write distinct `home_summary` and `detail_summary` values when the two surfaces need different depth.
- [ ] Use `profile_byline` and pipe-delimited `profile_labs` for the compact profile panel. When either is present, that panel suppresses narrative summary copy.
- [ ] If the structured profile fields are blank, verify the compact summary fallback from `profile_summary` to `home_summary` to `detail_summary`.
- [ ] Mark the intended compact-profile candidate with `show_on_home`; `featured_research_id` is considered only when no row is Home-marked.
- [ ] Use descriptive `label=url` link entries and confirm link inference produces the intended Home actions.
- [ ] Keep a pending resource label in `pending_links` only while it has no destination. Remove it when the matching published link is added.
- [ ] Verify impact, bullets, skills, and all links on the Research route.
- [ ] Do not rely on the research image or organization logo to render on current Research cards.

## Projects

- [ ] Give each project an accurate title, optional subtitle, Home summary, and detail summary.
- [ ] Keep `home_skills` at three or fewer ordered `name=icon` entries with valid lowercase icon keys.
- [ ] Populate each numbered skill summary/details pair together and only for an existing skill position.
- [ ] Verify project skill dialog copy describes the actual role of that technology.
- [ ] Confirm link inference produces the intended `Source code` and optional `Live demo` actions on Home.
- [ ] Verify problem, solution, impact, image, stack, and full links on the Projects route.

## Skills

- [ ] Use stable categories and `category_order` for category ordering.
- [ ] Use `priority` and `order` for deterministic skill ordering.
- [ ] Do not add filler to reach a fixed category or skill count; the schema requires neither.
- [ ] Populate `proficiency`, `summary`, and `where_used` as a complete set for every skill that should open a dialog.
- [ ] Ground proficiency and usage claims in visible public evidence.
- [ ] Confirm `max_home_skill_items` is a sensible positive value when a limit is wanted.

## Recommendations

- [ ] Publish only approved recommendation text.
- [ ] Populate required `id`, `recommender_name`, and `full_quote` values.
- [ ] Preserve the approved quote in `full_quote`; Home and detail cards both use it.
- [ ] Populate `full_quote_link_label` and `full_quote_link_url` together, require HTTPS, and confirm the case-sensitive label occurs exactly once in the quote.
- [ ] Use HTTPS for source and LinkedIn verification links.
- [ ] Set `show_on_home`, `featured`, and ordering fields deliberately.
- [ ] Choose a positive `max_home_recommendation_items`, or accept the fallback limit of three.
- [ ] Keep `show_empty_recommendations=false` unless an empty Recommendations section and route should be visible.
- [ ] Do not expect `home_quote`, `context`, or recommendation `skills` to render in the current UI.

## Site settings, footer, and contact

- [ ] Set `site_title`, `site_description`, and a supported `default_theme`.
- [ ] Review motion, skeleton, glass, and Recommendations feature flags.
- [ ] Use positive Home limits where a cap is intended. Do not rely on `max_home_experience_items`; current Home experience is unlimited after selection.
- [ ] Set `copyright_owner` if it should differ from `profile.full_name`.
- [ ] Set and verify `legal_contact_email`, `legal_effective_date`, `hosting_provider_name`, and the provider's HTTPS `hosting_privacy_url`.
- [ ] Keep the footer-only Contact form link pointed at `/contact`, and keep the public direct-email link available as a fallback.
- [ ] Confirm the Privacy and Security notices accurately describe the visible initial Turnstile gate, the `/api/contact/verify` ticket endpoint, the `/api/contact` delivery endpoint, the short-lived essential cookie, bounded mail-domain DNS validation, the pseudonymous D1 quota reservation, sequential Resend delivery, required email/optional phone fields, and provider processing.
- [ ] Confirm the software license separately from the rights reserved in portfolio content.
- [ ] Set `repository_url` and `license_url` only after anonymous access to both destinations succeeds. Leave them blank to omit unavailable footer resources.

## Assets

- [ ] Store only publishable assets under `public/`.
- [ ] Use safe root-relative paths or approved HTTP(S) destinations.
- [ ] Check portrait, favicon, project image, research image, organization logo, and institution logo paths for 200 responses.
- [ ] Confirm image dimensions, cropping, contrast, and alt behavior on desktop and mobile.
- [ ] Remove unused sample assets when they are no longer referenced and removal is within the release scope.

## Local generation and review

- [ ] Clear remote workbook variables when producing the tracked local snapshot.
- [ ] Run `npm run generate:content`.
- [ ] Review the template and generated JSON diff together.
- [ ] Confirm `metadata.sourceMode` is `templates` for the tracked local snapshot.
- [ ] Confirm optional fields, arrays, booleans, dates, references, and order normalized as expected.
- [ ] Confirm `contentHash` behavior against [Content Pipeline](CONTENT_PIPELINE.md#content-hash); do not use `generatedAt` as the semantic change signal.
- [ ] Run the site and inspect every affected Home and detail surface.
- [ ] Run `npm run verify` before merge.

## Workbook release

- [ ] Test the exact XLSX URL anonymously and confirm it returns a valid workbook rather than HTML or a login response.
- [ ] Run strict remote generation locally when practical.
- [ ] Confirm `metadata.sourceMode` is `remote` and the nine public source entries are remote.
- [ ] Run focused generation and content tests, then `npm run build:generated` on the deliberate snapshot.
- [ ] Use the repository workflow for the release so CI downloads once and deploys the exact verified artifact.
- [ ] Confirm the deployed `/content-version.json` reports the expected content hash and candidate commit.
- [ ] Treat validation, test, build, artifact-integrity, and pre-Wrangler failures as non-deploying failures, then correct the source before retrying.
- [ ] If Wrangler itself fails, verify the Cloudflare target before assuming which deployment remains active.
- [ ] If post-Wrangler smoke checks fail, assume the new deployment may already be active, inspect the target, and perform an authorized rollback or corrective deployment when required.
