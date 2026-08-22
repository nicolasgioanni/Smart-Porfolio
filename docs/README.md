# Smart Portfolio documentation

This documentation explains how Smart Portfolio is authored, built, tested, deployed, operated, and reviewed. The root [project README](../README.md) is the visitor-facing overview. The guides here provide the implementation detail needed to change the system safely.

## Documentation principles

- Implementation is authoritative. Package scripts, application code, validators, Cloudflare Functions, and GitHub Actions take precedence over prose.
- Public portfolio content and private runtime configuration are separate concerns.
- A guide explains a system or procedure. A checklist provides a concise verification pass and links to its guide.
- Shared facts should have one detailed home and be linked elsewhere instead of copied.
- Documentation changes are part of the quality gate and must pass `npm run docs:check`.

## Choose a path

| Reader | Start with | Continue with |
| --- | --- | --- |
| Portfolio owner | [Local content editing](LOCAL_CONTENT_EDITING.md) | [Content pipeline](CONTENT_PIPELINE.md), [sheet schema](CONTENT_SHEET_SCHEMA.md), and [content replacement checklist](CONTENT_REPLACEMENT_CHECKLIST.md) |
| Developer | [Architecture](ARCHITECTURE.md) | [Project structure](PROJECT_STRUCTURE.md), [local development](LOCAL_DEVELOPMENT.md), [testing](TESTING.md), and [maintenance](MAINTENANCE.md) |
| Design contributor | [Design system](DESIGN_SYSTEM.md) | [Accessibility](ACCESSIBILITY.md), [animation guidelines](ANIMATION_GUIDELINES.md), and [skeleton loading guidelines](SKELETON_LOADING_GUIDELINES.md) |
| Deployment operator | [Deployment](DEPLOYMENT.md) | [Operations](OPERATIONS.md), [testing](TESTING.md), and [troubleshooting](TROUBLESHOOTING.md) |
| Security reviewer | [Security](SECURITY.md) | [Contact system](CONTACT_SYSTEM.md), [architecture](ARCHITECTURE.md), and [security checklist](SECURITY_CHECKLIST.md) |

## Start here

| Document | Purpose |
| --- | --- |
| [Project README](../README.md) | Product overview, architecture summary, setup path, route map, and links into the documentation suite. |
| [Architecture](ARCHITECTURE.md) | System boundaries, layers, data flow, tradeoffs, and authoritative implementation sources. |
| [Project structure](PROJECT_STRUCTURE.md) | Repository tree, route ownership, component groups, tests, and guidance on where changes belong. |

## Content authoring

| Document | Purpose |
| --- | --- |
| [Content pipeline](CONTENT_PIPELINE.md) | Local and remote source modes, XLSX validation, normalization, generated JSON, and semantic hashing. |
| [Content sheet schema](CONTENT_SHEET_SCHEMA.md) | Exact field reference for supported source data. |
| [Content mapping](CONTENT_MAPPING.md) | Mapping from source fields through generated types and selectors to routes and components. |
| [Local content editing](LOCAL_CONTENT_EDITING.md) | Owner-focused procedure for editing local templates, assets, and workbook-backed content. |
| [Content replacement checklist](CONTENT_REPLACEMENT_CHECKLIST.md) | Short publication checklist for replacing portfolio content safely. |

## Design and user experience

| Document | Purpose |
| --- | --- |
| [Design system](DESIGN_SYSTEM.md) | Themes, tokens, glass primitives, layout, cards, interactions, and contribution rules. |
| [Accessibility](ACCESSIBILITY.md) | Accessibility practices, interaction contracts, known limits, and verification steps. |
| [Animation guidelines](ANIMATION_GUIDELINES.md) | Approved motion behavior, timing, reduced-motion handling, and interaction constraints. |
| [Skeleton loading guidelines](SKELETON_LOADING_GUIDELINES.md) | Route loading states, static-first constraints, layout matching, and accessibility behavior. |

## Development and quality

| Document | Purpose |
| --- | --- |
| [Local development](LOCAL_DEVELOPMENT.md) | Supported Node.js version, setup commands, development servers, local content, and Pages Function testing. |
| [Testing](TESTING.md) | Test layers, focused commands, the full quality gate, CI behavior, and test-extension guidance. |
| [Engineering standards](ENGINEERING_STANDARDS.md) | Concise architecture, component, styling, test, and dependency rules. |
| [Quality checklist](QUALITY_CHECKLIST.md) | General pre-merge verification checklist. |
| [Performance budget](PERFORMANCE_BUDGET.md) | Runtime, JavaScript, asset, glass, motion, and build constraints. |
| [Performance checklist](PERFORMANCE_CHECKLIST.md) | Focused pre-merge performance review. |

## Deployment and operations

| Document | Purpose |
| --- | --- |
| [Deployment](DEPLOYMENT.md) | GitHub and Cloudflare setup, environment separation, branch protection, and first deployment. |
| [Operations](OPERATIONS.md) | Event behavior, candidate selection, exact-artifact deployment, manifests, smoke tests, retries, and rollback considerations. |
| [Troubleshooting](TROUBLESHOOTING.md) | Symptoms, likely causes, diagnostics, safe corrections, and actions to avoid. |

## Security and data handling

| Document | Purpose |
| --- | --- |
| [Security](SECURITY.md) | Threat model, trust boundaries, public and private data, headers, URL rules, contact security, and publication review. |
| [Contact system](CONTACT_SYSTEM.md) | Client workflow, verification ticket, request validation, Turnstile, Resend, configuration, and abuse controls. |
| [Security checklist](SECURITY_CHECKLIST.md) | Concise operational security review linked to the deeper guides. |

## Maintenance

| Document | Purpose |
| --- | --- |
| [Maintenance](MAINTENANCE.md) | Safe extension patterns for content fields, routes, UI, themes, Functions, CI, and deployment. |

## Sources of truth

Use the narrowest authoritative implementation source when documentation and code differ.

| Topic | Authoritative implementation |
| --- | --- |
| Dependencies, Node.js version, and commands | `package.json`, `package-lock.json`, and `.nvmrc` |
| Static export and route implementation | `next.config.mjs` and `src/app/` |
| Content types and runtime validation | `src/content/types.ts` and `src/lib/content/` |
| Workbook download and structure | `scripts/fetchPortfolioContent.ts` and `scripts/lib/portfolioContentGeneration.ts` |
| Home selection and section order | `src/lib/content/selectHomeContent.ts` and `src/components/portfolio/HomeOverview.tsx` |
| Themes, layout, motion, and styling | `src/components/`, `src/lib/theme/`, and `src/styles/` |
| Contact request boundary | `functions/api/`, `functions/_shared/contact.ts`, and `src/components/contact/` |
| Function routing and static headers | `public/_routes.json` and `public/_headers` |
| Cloudflare configuration | `wrangler.jsonc` |
| Verification and deployment behavior | `.github/workflows/ci.yml` and `scripts/` |
| License | `LICENSE` |

## Keeping documentation synchronized

1. Change implementation and tests together.
2. Update the guide that owns the affected behavior.
3. Update the concise checklist that verifies it, if one exists.
4. Replace duplicated detail elsewhere with a descriptive link.
5. Run `npm run docs:check` and the relevant focused tests.
6. Run `npm run verify` before delivery.

When adding a document, give it one clear purpose, add it to the appropriate table above, and link it from the guide that introduces the concept. Do not publish secret values, the workbook URL, private recipient configuration, or machine-specific paths.
