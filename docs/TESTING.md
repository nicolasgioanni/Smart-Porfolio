# Testing

Smart Portfolio uses a layered quality gate for documentation, static content, React behavior, style contracts, Cloudflare Pages Functions, deployment automation, and the exported build. This guide maps each command to the behavior it actually verifies.

## Supported environment

| Setting | Value |
| --- | --- |
| Node.js | 22.13 or newer locally, Node.js 22 in CI |
| Package installation | `npm ci` from `package-lock.json` in CI |
| Test runner | Vitest 4.1.11 |
| Default test environment | jsdom |
| DOM assertions | Testing Library and `@testing-library/jest-dom` |
| TypeScript mode | Strict, no emit |
| CI runner | `ubuntu-latest` |

`vitest.config.ts` enables globals, loads `vitest.setup.ts`, and maps `@` to `src`. The repository has one CI operating-system and Node-major configuration, not a multi-platform test matrix.

## Command matrix

| Command | What it runs | Important behavior |
| --- | --- | --- |
| `npm run docs:check` | Dependency-free Markdown validator | Does not make network requests |
| `npm run generate:content` | Content source download or template read, normalization, validation, and generated JSON write | Uses `.env` when run through the CLI |
| `npm run lint` | ESLint over the repository with `--max-warnings=0` | Generated content and build directories are ignored |
| `npm run typecheck` | `tsc --noEmit` | Uses strict TypeScript settings |
| `npm run test:footer` | Two focused footer regression files | Also runs again inside the full suite |
| `npm run test` | Complete Vitest suite | Uses mocks and jsdom, not a real browser or Cloudflare runtime |
| `npm run build` | `prebuild`, Next.js static export, then content-version write | Regenerates content before building |
| `npm run build:generated` | Next.js static export and content-version write | Consumes existing generated JSON without another content fetch |
| `npm run verify` | Docs check, lint, typecheck, full tests, and normal build | Does not run `test:footer` as a separate command |
| `npm run verify:local` | Dependency preparation, explicit content generation, then `verify` | The final normal build invokes generation again |

Use the cross-platform `verify:local:node` alias when PowerShell is unavailable.

## Documentation integrity

Run:

```bash
npm run docs:check
```

`scripts/validateDocumentation.mjs` reads `README.md` and every Markdown file under `docs/`. It checks:

- Exactly one H1 per document.
- Balanced fenced code blocks.
- Resolution and exact capitalization of relative Markdown, image, reference, HTML `href`, and HTML `src` links.
- Rejection of relative links that escape the repository.
- Rejection of links to local environment files or generated output directories.
- Rejection of absolute Windows user paths.
- Localhost URL use only in the approved local-development documents.
- Rejection of workbook URL patterns and obvious unresolved placeholders.
- Rejection of excluded local tooling terminology.
- Rejection of prose that presents generated output directories as committed source.

The validator uses only Node.js standard-library APIs and does not check external-link availability. Its fixture tests live in `scripts/validateDocumentation.test.mjs`.

## Content pipeline coverage

| Area | Authoritative tests | Coverage |
| --- | --- | --- |
| CSV parsing and normalized content shape | `src/lib/content/content.test.ts` | Fields, IDs, URLs, dates, ordering, selection, empty states, and profile helpers |
| Workbook download boundary | `scripts/portfolioContentGeneration.test.ts` | Anonymous HTTPS URL, one fetch, timeout, byte cap, response validation, and strict failure behavior |
| Workbook structure | `scripts/portfolioContentGeneration.test.ts` | Exact worksheets, normalized titles, visibility, headers, dimensions, cells, formulas, and schema errors |
| Semantic hashing | `scripts/portfolioContentGeneration.test.ts` | Canonical normalized content subset and `generatedAt` preservation |
| Public asset references | `scripts/demoAssets.test.mjs` | Referenced local assets exist and are non-empty |
| Environment placeholders | `scripts/envConfiguration.test.mjs` | Supported variables, ignored local files, and removal of legacy variable families |

These are unit and integration-style tests with temporary files and injected fetch implementations. They do not download the production workbook during pull-request verification.

## Contact-system coverage

| Layer | Authoritative tests | Coverage |
| --- | --- | --- |
| Client field validation | `src/components/contact/contactFormValidation.test.ts` | Required fields, trimming, email, phone, message, and shared limits |
| Turnstile widget | `src/components/contact/TurnstileWidget.test.tsx` | Rendering, success, expiry, reset, theme, and missing-key failure |
| Contact route | `src/app/contact/contact.test.tsx` | Four-step gating, acknowledgements, exact payload, success, retries, and noindex metadata |
| Verification Function | `functions/api/contact/verify.test.ts` | Method, origin, media type, body contract, Siteverify, action, hostname, remote IP, and signed cookie |
| Delivery Function | `functions/api/contact.test.ts` | Method, origin, media type, body size, schema, honeypot, timing, ticket validation, idempotency, delivery, and retry |
| Contact styles | `src/styles/contactStyles.test.ts` | Error, focus, disabled, responsive, wrapping, and reduced-motion contracts |
| Legal disclosures | `src/components/legal/legal.test.tsx` | Contact processing and published notices |

The Function tests call exported handlers with web-standard `Request` and `Response` objects while mocking Turnstile and Resend. They do not execute in a real Workers runtime, cross a WAF rule, use live provider credentials, or send production email.

## Interface and accessibility coverage

| Area | Test files | Main contracts |
| --- | --- | --- |
| Navigation and links | `src/components/navigation/navigation.test.tsx`, `src/components/navigation/smartLink.test.tsx` | Route registry, active indicator, header behavior, mobile state, external-link safety, and interaction treatments |
| Themes | `src/components/theme/ThemeSwitcher.test.tsx`, `src/lib/theme/resolveThemeName.test.ts` | Supported themes, persistence, keyboard and pointer behavior, fallback, and cleanup |
| Motion | `src/components/motion/motion.test.tsx`, `src/components/portfolio/AnimatedRole.test.tsx` | Reveal persistence, animation timing, static fallback, reduced motion, and cleanup |
| Footer | `src/components/layout/InteractiveBlobFooter.test.tsx`, `src/components/layout/footerStyles.test.ts` | Server fallback, disclosure state, scrolling, focus safety, responsive layout, motion, and observer cleanup |
| Skeletons | `src/components/loading/skeleton.test.tsx` | Structure, hidden state, route loading files, and absence of real content text |
| Portfolio rendering | `src/components/portfolio/portfolio.test.tsx` | Home order, cards, empty states, actions, profile hierarchy, images, and footer content |
| Skills dialogs | `src/components/portfolio/PortfolioSkillShowcase.test.tsx`, `src/components/portfolio/ProjectSkillShowcase.test.tsx` | Trigger fallback, labels, focus containment, Escape, backdrop, scroll lock, and focus restoration |
| Recommendations | Recommendation component, layout, and style tests under `src/components/portfolio/` | Expansion, link safety, row measurement, overflow reservation, masking, and reduced motion |
| Static security contracts | `src/lib/content/security.test.ts` | No Next.js runtime endpoints, scoped Pages routing, safe structured links, responsive and motion contracts |

Many accessibility assertions verify semantic roles, names, focus behavior, keyboard handling, `aria` state, and reduced-motion fallbacks. The repository does not currently run an automated browser accessibility scanner.

## Deployment automation coverage

| Test | What it verifies |
| --- | --- |
| `scripts/packageScripts.test.mjs` | Node and tool pins, workflow triggers, one-fetch conditions, branch isolation, permissions, no-op behavior, artifact transfer, target validation, heartbeat boundaries, no-cache metadata, and Wrangler invocation |
| `scripts/checkDeployedContent.test.mjs` | Post-deployment smoke requests both contact Functions and requires their exact JSON method rejection |
| Artifact tests inside `scripts/packageScripts.test.mjs` | Content-version creation, hidden file inclusion, manifest structure, commit binding, digest verification, and tamper rejection |
| `scripts/localAutomation.test.mjs` | Project discovery, environment copy safety, dependency-state hashing, stale content, and port selection |

The workflow contract tests inspect checked-in workflow text and execute the manifest helpers. They do not start a GitHub Actions runner or perform a Cloudflare upload.

## CI quality gates

The `verify` job installs locked dependencies before any conditional quality work.

### Pull requests

Pull requests targeting `main` or `develop`:

1. Generate validated template content without workbook or Cloudflare credentials.
2. Run documentation integrity.
3. Run lint.
4. Run typecheck.
5. Run the focused footer suite.
6. Run the full Vitest suite.
7. Build with `build:generated`.
8. Stop without creating a deployment artifact.

### Push deployments

Latest pushes to `main` or `develop`:

1. Validate the fixed Pages project and assigned domain.
2. Download and generate one strict workbook snapshot.
3. Read and validate its SHA-256 content hash.
4. Run the same quality gates as pull requests.
5. Build with `build:generated` and the branch-specific public Turnstile key.
6. Create, verify, and upload the artifact manifest.
7. Enter the conditional deploy job.

### Scheduled and manual checks

Scheduled runs and non-forced manual runs perform the strict content work before deciding whether full verification is required. When the candidate hash matches production, documentation integrity, lint, typecheck, tests, build, artifact upload, and deployment are skipped. Forced manual runs always select the full production path after strict content validation.

### Focused footer duplication

CI deliberately runs `test:footer` before `test`. The complete suite includes the same two files, so they execute twice. The focused step preserves a named required regression signal while the full suite catches cross-component failures.

## Post-deployment smoke tests

The deploy job runs `scripts/checkDeployedContent.mjs` against the stable assigned-domain alias. It verifies root HTML, exact content and commit metadata, exact artifact-manifest equality, and the exact HTTP `405` JSON contract for GET requests to both contact Functions.

It does not test:

- Every static route.
- The custom domain.
- Static security headers.
- Valid contact POST requests.
- Turnstile completion.
- Resend delivery.
- WAF behavior.
- Browser layout or interaction.

See [Deployment](DEPLOYMENT.md#exact-automated-smoke-scope) and [Operations](OPERATIONS.md#post-deployment-verification) for the automated and manual boundaries.

## Running targeted tests

Run one file:

```bash
npx --no-install vitest run scripts/packageScripts.test.mjs
```

Run a related group:

```bash
npx --no-install vitest run functions/api/contact.test.ts functions/api/contact/verify.test.ts
```

Use `--reporter=dot` for compact output or the default reporter for individual test names.

## Adding or changing tests

When behavior changes:

1. Update the closest unit or component contract.
2. Add an integration test when data crosses a boundary such as workbook parsing, Function validation, or artifact transfer.
3. Update workflow contract tests when a CI trigger, condition, permission, action, command, artifact, or environment variable changes.
4. Update documentation and its cross-links in the same change.
5. Run the targeted tests first, then `npm run verify`.

Avoid snapshot tests that hide semantic changes. Prefer explicit assertions for user-visible text, accessibility state, response contracts, validation errors, and integrity metadata.

## Current limitations

- No coverage percentage is generated or enforced.
- No real-browser end-to-end suite is configured.
- No automated Lighthouse or performance threshold runs in CI.
- No automated browser accessibility scanner is configured.
- No Workers emulator integration test runs in CI.
- No automated live contact delivery test is performed.
- CI covers one Linux and Node-major configuration.
- External WAF, DNS, TLS, provider-secret, and branch-protection state are not testable from the repository.

These are explicit boundaries, not implied guarantees. Use the manual checks in [Operations](OPERATIONS.md) when the release risk reaches beyond the automated suite.
