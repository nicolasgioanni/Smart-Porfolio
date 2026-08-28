# Smart Portfolio

[![CI](https://github.com/nicolasgioanni/Smart-Porfolio/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/nicolasgioanni/Smart-Porfolio/actions/workflows/ci.yml)
[![MIT License](https://img.shields.io/github/license/nicolasgioanni/Smart-Porfolio)](LICENSE)
[![Node.js 22.13+](https://img.shields.io/badge/Node.js-%3E%3D22.13-339933?logo=nodedotjs&logoColor=white)](package.json)
[![Cloudflare Pages](https://img.shields.io/badge/Deploy-Cloudflare_Pages-F38020?logo=cloudflare&logoColor=white)](https://nicolasmgioanni.dev)

A spreadsheet-authored, static-first portfolio with typed content validation, a restrained glass interface, and integrity-checked Cloudflare deployment.

**[View the live portfolio](https://nicolasmgioanni.dev)**

## Overview

Smart Portfolio is Nicolas Gioanni's personal software engineering, research, and cybersecurity portfolio. Its public content is maintained independently from the interface through one workbook, then validated and converted to typed JSON before Next.js builds the site.

The core routes are static. A visitor's browser receives generated pages and never requests spreadsheet content. GitHub Actions deploys only candidates that pass content validation, documentation checks, lint, type checking, tests, a static build, and artifact-integrity checks. Runtime request handling is isolated to the contact verification and delivery Functions.

The workbook is a lightweight content-authoring surface rather than a general-purpose content management system. It holds only reviewed public content and has no control over application code, secrets, or deployment.

## What makes it different

| Capability | Purpose |
| --- | --- |
| Workbook-authored content | Lets the portfolio owner update public content without editing React components. |
| Strict XLSX contract | Rejects missing, unexpected, hidden, duplicate-normalized, malformed, or invalid worksheets before build. |
| Typed generated content | Gives selectors and components one validated JSON shape instead of spreadsheet rows. |
| Semantic content hashing | Compares a canonical normalized content subset so workbook metadata and harmless formatting do not trigger deployments. |
| Static-first delivery | Keeps portfolio data out of request-time APIs and serves the core experience from Cloudflare's edge. |
| Exact tested artifact | Deploys the same export that passed the quality gate, with a SHA-256 manifest checked before upload. |
| Focused interaction | Adds theme, navigation, skills, recommendation, and motion behavior without moving content rendering into the browser. |
| Isolated contact flow | Uses a server-verified Turnstile gate, short-lived signed ticket, strict request validation, and Resend delivery. |
| Preview and production isolation | Keeps `develop` deployments, browser keys, origins, hostnames, and production aliases separate. |

## Architecture at a glance

```mermaid
flowchart TB
    Owner[Portfolio owner] --> Workbook[Public-safe XLSX workbook]
    Workbook --> Actions[GitHub Actions]
    Actions --> Validate[Validate and normalize]
    Validate --> Json[Typed JSON and content hash]
    Json --> Build[Next.js static export]
    Build --> Artifact[Integrity-checked artifact]
    Artifact --> Pages[Cloudflare Pages]
    Pages --> Browser[Visitor browser]

    Browser --> Verify[/api/contact/verify]
    Verify --> Turnstile[Cloudflare Turnstile]
    Browser --> Submit[/api/contact]
    Submit --> Resend[Resend]
```

The workbook participates only at build time. Cloudflare Pages serves the static export, while the two contact paths form one isolated runtime boundary. The verification Function checks Turnstile once and issues a signed ticket; the delivery Function validates that ticket and the contact payload before calling Resend.

Deep dives:

- [Architecture](docs/ARCHITECTURE.md)
- [Content pipeline](docs/CONTENT_PIPELINE.md)
- [Deployment](docs/DEPLOYMENT.md)
- [Contact system](docs/CONTACT_SYSTEM.md)

## Content workflow

1. The portfolio owner edits the reviewed public workbook.
2. GitHub Actions downloads one anonymous XLSX snapshot.
3. The generator verifies the exact visible worksheet set, headers, rows, and file constraints.
4. Source rows are normalized and validated against the typed content contract.
5. A deterministic SHA-256 hash is calculated from a canonical normalized content subset.
6. Eligible scheduled and non-forced manual runs become successful no-ops when the active production hash matches.
7. Changed or forced candidates run the complete quality gate.
8. Next.js builds from the already-tested generated snapshot without downloading again.
9. The exact static artifact is hashed, transferred, verified, uploaded, and smoke-tested.

The remote workbook has exactly nine visible sheets:

| Sheet | Purpose |
| --- | --- |
| `profile` | Identity, biography, role, image, and profile references. |
| `links` | Header, Home, social, email, and repository destinations. |
| `research` | Research summaries, evidence, skills, impact, and resources. |
| `projects` | Project summaries, problem and solution context, skills, and links. |
| `experience` | Work, research, teaching, and leadership history. |
| `recommendations` | Recommendation text, attribution, source, and display order. |
| `education` | Institution, program, dates, supporting facts, and logo. |
| `skills` | Category, icon, proficiency, summary, and evidence of use. |
| `site_settings` | Public UI settings, limits, legal metadata, and feature switches. |

Worksheet titles are matched by trimmed lowercase text, so capitalization and physical order do not matter. Internal spaces, hyphens, spelling changes, extra sheets, duplicate-normalized sheets, and hidden sheets are invalid.

The public `/resume` route provides private-request instructions only. It does not authorize a `resume` workbook sheet, and any such extra sheet is rejected.

The workflow performs an ordinary anonymous HTTPS download. It uses no Google API, Drive connector, OAuth grant, service account, or Google account access. Local development can use checked-in CSV templates; production candidates enable strict remote mode and cannot fall back to template content.

See [Content pipeline](docs/CONTENT_PIPELINE.md), [sheet schema](docs/CONTENT_SHEET_SCHEMA.md), and [local content editing](docs/LOCAL_CONTENT_EDITING.md).

## User experience and visual system

The interface uses glass-inspired surfaces as restrained hierarchy, not as a full-screen effect. Text sits on quiet backgrounds, large panels use bounded blur, and nested cards reduce visual weight.

- Navy, Light, and Dark themes share semantic color and interaction tokens.
- A floating header provides desktop navigation, an accessible mobile menu, profile preview, social links, and theme selection.
- Home combines a profile overview with experience, education, research, projects, skills, and recommendations.
- The role line can rotate through spreadsheet-configured titles while exposing one stable accessible label.
- Skills with complete evidence open keyboard-managed dialogs; incomplete legacy rows remain static badges.
- Long recommendations expand in place with measured overflow and reduced-motion support.
- The footer is an explicit progressive disclosure that remains in normal document flow.
- Route skeletons mirror final layouts without hiding available static content.
- Focus-visible treatments, ARIA state, keyboard behavior, semantic headings, and responsive reflow are component requirements.

See [Design system](docs/DESIGN_SYSTEM.md), [Accessibility](docs/ACCESSIBILITY.md), [Animation guidelines](docs/ANIMATION_GUIDELINES.md), and [Skeleton loading guidelines](docs/SKELETON_LOADING_GUIDELINES.md).

## Documented route map

Page routes are statically exported. This table covers the visitor flows documented in this guide; hydration is limited to the interactions noted below.

| Route | Purpose | Rendering and interaction |
| --- | --- | --- |
| `/` | Portfolio overview | Static content with role, skills, recommendation, motion, and shared-shell hydration. |
| `/experience` | Detailed experience timeline | Static evidence cards with shared-shell and optional reveal behavior. |
| `/research` | Detailed research work | Static evidence cards and verified external resources. |
| `/projects` | Detailed engineering projects | Static evidence cards with project-skill dialogs where configured. |
| `/recommendations` | Complete recommendation collection | Static cards with expandable long quotes; navigation is content-dependent. |
| `/resume` | Private resume request instructions | Static request page with contact and email actions; no resume file or workbook sheet is published. |
| `/contact` | Prioritized contact workflow | Static form shell that calls the two same-origin Pages Functions; marked `noindex`. |
| `/privacy` | Privacy notice | Static footer-only legal route. |
| `/terms` | Terms and accuracy notice | Static footer-only legal route. |
| `/security` | Security and disclosure notice | Static footer-only legal route. |

Primary navigation is assembled by [navigationItems.ts](src/components/navigation/navigationItems.ts) from the central route registry. Resume is always present, Recommendations is included only when configured, and Contact plus legal routes are intentionally available through the footer.

## Technology and project role

| Area | Technology | Role in this repository |
| --- | --- | --- |
| Application | Next.js App Router and React | Build route components into a static export and hydrate focused interactions. |
| Language | TypeScript | Define content, component, script, and test contracts under strict checking. |
| Typography | Inter through `next/font` | Self-manage the primary font with system fallbacks. |
| Workbook parsing | ExcelJS | Parse the complete anonymous XLSX snapshot and inspect worksheet state and cells. |
| Local source parsing | `csv-parse` | Read checked-in content templates through the same row model. |
| Content safety | Custom normalizers and validators | Enforce required data, exact references, URL rules, grouped fields, and UI invariants. |
| Interface | CSS custom properties and reusable glass primitives | Share semantic themes, geometry, surfaces, and interaction states without a UI framework. |
| Icons | `simple-icons` and local semantic icons | Render configured technology and destination marks. |
| Browser behavior | IntersectionObserver and native browser APIs | Drive focused reveal, footer, responsive, and preference behavior. |
| Quality | ESLint, TypeScript, Vitest, Testing Library, and jsdom | Verify code, types, content, components, Functions, scripts, CSS contracts, and automation. |
| Automation | GitHub Actions | Own candidate selection, verification, artifact transfer, deployment, and scheduled checks. |
| Hosting | Cloudflare Pages and Wrangler | Serve the static export and compile the isolated Pages Functions through Direct Upload. |
| Contact | Pages Functions, Turnstile, and Resend HTTPS API | Verify human interaction, validate requests, and deliver one email batch without a contact database. |

## Quick start

### Prerequisites

- Git
- Node.js 22.13 or newer
- npm

### Windows-first setup

```powershell
git clone https://github.com/nicolasgioanni/Smart-Porfolio.git
cd Smart-Porfolio
npm run setup:local
npm run dev:smart
```

`setup:local` verifies the Node.js version, creates a local `.env` from the placeholder example when missing, uses `npm ci` only when dependencies are missing or stale, and regenerates content only when needed. `dev:smart` starts at port 3000 or the first available port through 3010 and prints the selected URL.

### Cross-platform smart commands

```bash
git clone https://github.com/nicolasgioanni/Smart-Porfolio.git
cd Smart-Porfolio
npm run setup:local:node
npm run dev:smart:node
```

### Standard npm path

```bash
npm ci
npm run generate:content
npm run dev
```

With no workbook URL configured, generation uses the local templates. The standard Next.js development server opens at `http://localhost:3000` unless another port is provided.

To test the built static export and contact Functions together, configure development values in the ignored `.env` and run:

```bash
npm run dev:pages
```

This command builds first, then starts Wrangler Pages development with the address printed by Wrangler. It does not require production credentials.

See [Local development](docs/LOCAL_DEVELOPMENT.md) for command flags, setup-state behavior, Function configuration, and safe cleanup.

## Editing content

### Local templates

1. Edit the matching CSV under `src/content/templates/`.
2. Place approved public assets under `public/` and use safe root-relative paths.
3. Run `npm run generate:content`.
4. Run the development server and inspect Home plus the affected detail route.
5. Run focused tests and `npm run verify`.

Do not edit `src/content/generated/portfolio.generated.json` as the authoring source. Regeneration replaces it.

### Public workbook

1. Maintain one anonymously downloadable workbook with the nine exact sheets.
2. Keep row-one headers aligned with the checked-in templates.
3. Review all values and workbook metadata for anonymous public release.
4. Configure the XLSX export locator in the build environment.
5. Use strict mode for deployment candidates.

See [Content sheet schema](docs/CONTENT_SHEET_SCHEMA.md) for fields and [Content replacement checklist](docs/CONTENT_REPLACEMENT_CHECKLIST.md) before publishing a broad content update.

## Environment configuration

Never copy real values into tracked documentation or `.env.example`.

### Build-time public content

| Variable | Placement | Purpose |
| --- | --- | --- |
| `PORTFOLIO_WORKBOOK_URL` | Local `.env`; GitHub Actions secret for automatic log redaction | Anonymous HTTPS XLSX locator. It is not a Google credential. |
| `PORTFOLIO_REQUIRE_REMOTE_CONTENT` | Local `.env` when needed; workflow sets it directly | Fails generation instead of allowing template fallback. |

### Public browser configuration

| Variable | Placement | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Local `.env`; GitHub repository variable for production builds | Public Turnstile widget key included in the client bundle. |
| `NEXT_PUBLIC_TURNSTILE_PREVIEW_SITE_KEY` | GitHub repository variable | Separate public key for `develop` preview builds, with no production fallback. |

### Server-only contact configuration

| Variable | Placement | Purpose |
| --- | --- | --- |
| `TURNSTILE_SECRET_KEY` | Local `.env`; Cloudflare encrypted secret | Server-side Siteverify credential and source for the derived ticket key. |
| `RESEND_API_KEY` | Local `.env`; Cloudflare encrypted secret | Resend API authentication. |
| `CONTACT_RECIPIENT_EMAIL` | Local `.env`; Cloudflare encrypted secret | Private owner destination. |
| `TURNSTILE_ALLOWED_HOSTNAMES` | Local `.env`; reviewed Wrangler variable | Exact accepted Siteverify hostnames. |
| `CONTACT_ALLOWED_ORIGINS` | Local `.env`; reviewed Wrangler variable | Exact same-origin request allowlist. |
| `CONTACT_FROM_EMAIL` | Local `.env`; reviewed Wrangler variable | Verified Resend sender identity. |
| `CONTACT_REPLY_TO_EMAIL` | Local `.env`; reviewed Wrangler variable | Fixed public reply-to for visitor receipts. |

Deployment credentials and immutable Cloudflare target variables are documented in [Deployment](docs/DEPLOYMENT.md). Secret placement and logging rules are documented in [Security](docs/SECURITY.md).

## Testing and quality gates

| Command | Scope |
| --- | --- |
| `npm run docs:check` | Markdown structure, local links and images, path case, private URL patterns, placeholders, and excluded local-only references. |
| `npm run generate:content` | Source loading, normalization, validation, hashing, and generated snapshot. |
| `npm run lint` | Source, test, script, and configuration lint rules with zero warnings. |
| `npm run typecheck` | Strict TypeScript checking without output. |
| `npm run test:footer` | Focused footer behavior and style regressions. |
| `npm run test` | Complete Vitest suite, including components, content, Functions, scripts, and automation contracts. |
| `npm run build` | Regenerate content, create the static export, and write deployment version metadata. |
| `npm run build:generated` | Build the existing generated snapshot without fetching content again. |
| `npm run verify` | Documentation check, lint, typecheck, full tests, and normal build in sequence. |

`verify` does not call `test:footer` separately because the full Vitest suite already includes those tests. CI keeps the focused footer step as a named early regression gate before running the full suite.

Pull requests generate from checked-in templates without deployment credentials, then run the complete verification path and static build. Deployable branch candidates use one strict remote snapshot. Artifact checks and live smoke tests run as deployment-specific stages.

See [Testing](docs/TESTING.md), [Quality checklist](docs/QUALITY_CHECKLIST.md), and [Performance checklist](docs/PERFORMANCE_CHECKLIST.md).

## Deployment

The deployment design makes GitHub Actions the sole deployment owner. Operators must keep Cloudflare Pages Git integration disabled so provider-side builds cannot bypass repository verification.

| Event | Result |
| --- | --- |
| Pull request to `main` or `develop` | Verify a local-template snapshot; never deploy. |
| Push to `develop` | Verify one strict workbook snapshot and deploy only the `develop` preview. |
| Push to `main` | Verify one strict workbook snapshot and deploy production. |
| Daily schedule | Compare the canonical normalized content subset with production; verify and deploy only when changed. |
| Manual dispatch | Target current `main`; forced mode bypasses only the unchanged optimization. |

Configured production URLs are [nicolasmgioanni.dev](https://nicolasmgioanni.dev) and Cloudflare's assigned `smart-portfolio-bds.pages.dev` domain. The configured stable preview alias is `develop.smart-portfolio-bds.pages.dev`.

The workflow checks that a production candidate still matches current `main`, verifies the downloaded artifact, runs pinned local Wrangler from repository root, and smoke-tests the deployed root, content manifest, integrity manifest, and GET rejection from both contact Functions. Generated production content and deployment state are not committed after upload. The active `/content-version.json` records current deployed content and candidate metadata; it does not prove that a post-upload smoke test succeeded.

See [Deployment](docs/DEPLOYMENT.md) for setup and [Operations](docs/OPERATIONS.md) for event behavior, no-ops, retries, manifests, and rollback considerations.

## Contact and security

The contact page is static, but its submission path crosses a narrow server trust boundary:

1. The browser renders Turnstile with a public site key.
2. `/api/contact/verify` accepts JSON POST from an exact allowed origin, verifies the token's success, action, and hostname, then sets a short-lived signed host-only ticket.
3. The visitor completes name, contact details, message, review, and three acknowledgements.
4. `/api/contact` validates method, media type, origin, request size, strict fields, timing, honeypot, acknowledgements, and ticket binding.
5. One Resend batch sends the owner notification and visitor receipt with submission-scoped idempotency.

The Functions return generic JSON errors, set their own no-store and security headers, keep the recipient and provider credentials server-side, and do not use a first-party contact database. Request bodies and personal fields must not be logged.

Cloudflare WAF rate limiting for both JSON paths is an operator-managed requirement. Repository code and tests cannot prove the live rule or the response customization available on the active Cloudflare plan.

See [Contact system](docs/CONTACT_SYSTEM.md), [Security](docs/SECURITY.md), and [Security checklist](docs/SECURITY_CHECKLIST.md).

## Project structure

```text
.github/             GitHub Actions workflow
docs/                Guides, references, and checklists
functions/           Cloudflare contact verification and delivery
public/              Static assets, headers, and Function route allowlist
scripts/             Content, local automation, manifests, smoke checks, tests
src/app/             Static Next.js routes and loading files
src/components/      Layout, navigation, theme, glass, portfolio, and contact UI
src/content/         Types, local templates, and generated snapshot
src/lib/             Content, CSV, formatting, and theme helpers
src/styles/          Semantic tokens and focused CSS layers
```

See [Project structure](docs/PROJECT_STRUCTURE.md) for route ownership, component groups, styling responsibilities, tests, and a change-location matrix.

## Documentation

The complete reader-oriented index is [docs/README.md](docs/README.md).

| Goal | Guides |
| --- | --- |
| Understand the system | [Architecture](docs/ARCHITECTURE.md) and [project structure](docs/PROJECT_STRUCTURE.md) |
| Edit content | [Content pipeline](docs/CONTENT_PIPELINE.md), [sheet schema](docs/CONTENT_SHEET_SCHEMA.md), and [local editing](docs/LOCAL_CONTENT_EDITING.md) |
| Work locally and test | [Local development](docs/LOCAL_DEVELOPMENT.md) and [testing](docs/TESTING.md) |
| Change the interface | [Design system](docs/DESIGN_SYSTEM.md), [accessibility](docs/ACCESSIBILITY.md), and [animation](docs/ANIMATION_GUIDELINES.md) |
| Deploy and operate | [Deployment](docs/DEPLOYMENT.md), [operations](docs/OPERATIONS.md), and [troubleshooting](docs/TROUBLESHOOTING.md) |
| Review security | [Security](docs/SECURITY.md), [contact system](docs/CONTACT_SYSTEM.md), and [security checklist](docs/SECURITY_CHECKLIST.md) |
| Extend safely | [Maintenance](docs/MAINTENANCE.md) and [engineering standards](docs/ENGINEERING_STANDARDS.md) |

## License

Smart Portfolio source code is available under the [MIT License](LICENSE).

Copyright 2026 Nicolas Gioanni.
