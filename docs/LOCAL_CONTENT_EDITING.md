# Local Content Editing

Use this guide to edit portfolio content, regenerate the checked-in local snapshot, and test a public workbook before deployment. See [Content Sheet Schema](CONTENT_SHEET_SCHEMA.md) for exact headers and field rules, [Content Mapping](CONTENT_MAPPING.md) for what the UI consumes, and [Content Pipeline](CONTENT_PIPELINE.md) for source selection, hashing, and CI behavior.

## Files to edit

Local CSV sources live in `src/content/templates/`:

| File | Purpose |
| --- | --- |
| `profile.csv` | Key/value identity and profile data. |
| `links.csv` | Public contact and external links. |
| `research.csv` | Research summaries and detail evidence. |
| `projects.csv` | Project summaries, deep dives, skills, and links. |
| `experience.csv` | Work, research, teaching, and leadership experience. |
| `recommendations.csv` | Approved recommendation copy and verification links. |
| `education.csv` | Education history. |
| `skills.csv` | Skill categories and evidence-dialog copy. |
| `site_settings.csv` | Metadata, feature flags, Home limits, and legal/footer settings. |
| `resume.csv` | Header-only compatibility guard. Do not add data rows or import it into the public workbook. |

Generation writes `src/content/generated/portfolio.generated.json`. Do not edit that JSON by hand. It is a derived, tracked snapshot of the local templates so a clean clone can build without remote configuration.

The public `/resume` page is a private-request route, not workbook-backed resume content. The generator requires local `resume.csv` to remain header-only and rejects any remote workbook containing a `resume` sheet.

## Choose a source mode

For ordinary local CSV work, leave `PORTFOLIO_WORKBOOK_URL` blank and keep `PORTFOLIO_REQUIRE_REMOTE_CONTENT` unset or false. The generator reads every local template.

To test the production-style workbook locally, put its anonymous HTTPS XLSX download URL in `PORTFOLIO_WORKBOOK_URL` inside the ignored root `.env` file, then enable strict mode:

```dotenv
PORTFOLIO_REQUIRE_REMOTE_CONTENT=true
```

Only the exact value `true` enables strict mode. A configured workbook URL selects remote mode even when strict mode is false. Any invalid or unavailable configured workbook fails generation without falling back to templates.

See [Content Pipeline: Source modes](CONTENT_PIPELINE.md#source-modes) for the complete behavior table.

## Edit local templates

1. Open the relevant CSV in a spreadsheet editor or a text editor that preserves CSV quoting.
2. Keep the exact header set. Header order can change, but names are lowercase, case-sensitive, and cannot be added, removed, or duplicated.
3. Keep collection IDs unique and update profile references when a referenced row ID changes.
4. Use pipe-delimited lists and `label=url` link entries as documented in [Content Sheet Schema](CONTENT_SHEET_SCHEMA.md#shared-rules).
5. Keep only content and destinations approved for anonymous publication.
6. Regenerate immediately so normalization and validation catch mistakes close to the edit.

Do not add a fixed number of rows merely to match the current snapshot. The schema does not require fixed counts for collections, skill categories, or Home cards. Use selection flags, ordering fields, and positive Home limits to control presentation.

## Regenerate

Run:

```powershell
npm run generate:content
```

The command parses all selected sources, normalizes them, validates cross-references and invariants, computes `contentHash`, and rewrites the generated JSON.

For local-template changes, review and commit the source CSV and generated JSON together. A useful review sequence is:

```powershell
git diff -- src/content/templates src/content/generated/portfolio.generated.json
git status --short
```

Review normalized output rather than only the CSV cells. In particular, confirm:

- optional blanks disappeared as intended;
- list fields became the expected arrays;
- boolean and number values normalized correctly;
- date display is correct;
- profile references point to the intended rows;
- source metadata says `templates` for local work;
- the hash changed only when the included normalized content changed.

`generatedAt` is preserved when the hash of the new canonical normalized content subset matches the existing valid hash. See [Content Pipeline: Content hash](CONTENT_PIPELINE.md#content-hash) for exact exclusions and timestamp behavior.

## Run the site

Start the development server after successful generation:

```powershell
npm run dev:smart
```

Check at least:

- Home selection, ordering, empty states, and responsive layout;
- profile Current Work, Education, and Research fallbacks;
- header external links and conditional Recommendations navigation;
- Experience, Research, Projects, and Recommendations detail routes;
- skill and project-skill dialogs;
- image and logo paths with no 404 responses;
- footer resources and contact email fallbacks;
- metadata title, description, favicon, and initial theme.

Use [Content Mapping](CONTENT_MAPPING.md) when a valid field does not appear where expected. Several accepted compatibility fields intentionally have no current UI consumer.

## Build a public workbook

Create one XLSX workbook with exactly these nine visible tabs:

1. `profile`
2. `links`
3. `research`
4. `projects`
5. `experience`
6. `recommendations`
7. `education`
8. `skills`
9. `site_settings`

Import the matching nine CSV templates as a starting point. Do not add notes, instructions, archive tabs, hidden tabs, or other worksheets to the downloadable workbook.

Tab order and capitalization do not matter because titles are trimmed and lowercased for matching. Internal punctuation, spaces, hyphens, and spelling still must match the canonical names. Every worksheet must contain the exact header set from [Content Sheet Schema](CONTENT_SHEET_SCHEMA.md).

If Google Sheets is the authoring tool, configure an anonymously downloadable XLSX export URL. The build does not use Drive API access, OAuth, a service account, or browser cookies. Test the exact URL in a signed-out browser or with a direct download client before using it in CI.

Workbook formula cells require cached displayed results. When reliability matters, paste finalized values instead of formulas. Keep the workbook under 5 MiB and within the worksheet dimension limits in [Content Pipeline: Workbook structure checks](CONTENT_PIPELINE.md#workbook-structure-checks).

## Test the workbook locally

1. Create `.env` from `.env.example` if needed.
2. Set `PORTFOLIO_WORKBOOK_URL` to the exact anonymous HTTPS XLSX URL.
3. Set `PORTFOLIO_REQUIRE_REMOTE_CONTENT=true` so a missing URL cannot silently select templates.
4. Run `npm run generate:content`.
5. Confirm `metadata.sourceMode` is `remote` and all nine public entries in `metadata.sources` are `remote`.
6. Run the focused tests and a generated-content build.

```powershell
npm run typecheck
npm run test -- scripts/portfolioContentGeneration.test.ts src/lib/content/content.test.ts
npm run build:generated
```

Do not commit a generated remote workbook snapshot as the repository's local baseline. Restore the normal local environment and run `npm run generate:content` from templates before preparing a local content commit.

## Full verification

Before merge, run:

```powershell
npm run verify
```

When changing generator contracts, workbook handling, selectors, or hashing, also run the focused tests explicitly:

```powershell
npm run test -- scripts/portfolioContentGeneration.test.ts src/lib/content/content.test.ts
```

`npm run build` regenerates through `prebuild`. `npm run build:generated` consumes the generated snapshot without downloading or regenerating it. Use the latter only after deliberate generation when testing the exact candidate snapshot.

## Assets

Store only anonymously publishable assets under `public/`. Common locations are:

- `public/images/profile/`
- `public/images/organizations/`
- `public/images/education/`
- `public/images/projects/`
- `public/images/research/`
- `public/favicon/`

Reference them from content with a safe root-relative path such as `/images/projects/example.png`. A file in `public/` is copied into the static export and is reachable without authentication.

Use the relevant `_logo_alt` column when a logo needs meaningful alternative text. Current compact overview logos are decorative, while Home history lists use the supplied alt text or generate a label from the organization or institution name.

## Common failures

| Failure | Check |
| --- | --- |
| Missing or unexpected header | Compare the complete header row with the canonical header in the schema reference. |
| Missing, duplicate, hidden, or unexpected tab | Keep exactly nine visible canonical workbook tabs. |
| Duplicate ID | Make each collection `id` unique; IDs are case-sensitive. |
| Invalid profile reference | Update the profile ID value or restore the referenced row. |
| Invalid boolean | Use `true`, `false`, `yes`, `no`, `1`, `0`, or blank. |
| Invalid number | Use a finite number; for display limits and order, use a sensible positive integer. |
| Invalid URL | Remove whitespace and use an allowed absolute or safe root-relative destination. Check field-specific HTTPS requirements. |
| Incomplete grouped fields | Complete or clear all role fields, project skill explanation pairs, skill popup fields, or quote inline-link fields. |
| Workbook response is HTML | Fix sharing/export configuration and test the exact signed-out download URL. |
| Formula has no cached result | Replace it with a value or export a workbook containing a displayed cached result. |
| Remote edit is not visible locally | Regenerate; the browser never reads the workbook directly. |
| Valid field is not rendered | Check [Content Mapping](CONTENT_MAPPING.md), including the compatibility field list. |

## Deployment handoff

Pull requests use local templates. Strict remote candidates for configured branches and scheduled or manual checks download the workbook once, then test and build that generated snapshot. Deployment consumes the exact verified artifact without a second fetch or build.

For an immediate workbook release check, dispatch the repository workflow rather than editing generated JSON. Confirm the deployed `/content-version.json` has the expected content hash and candidate commit after the workflow succeeds. See [Deployment](DEPLOYMENT.md) for branch and rollback operations.
