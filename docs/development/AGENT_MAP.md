# Agent map

This portable overview routes a repository task without requiring a particular agent product. Read [AGENTS.md](../../AGENTS.md), [.agents](../../.agents/README.md), and [system decisions](../../.agents/knowledge/SYSTEM_DECISIONS.md) first. The direct cards in `.agents` reach implementation, tests, and authoritative documentation in two hops from the bootstrap; the [ownership manifest](../../.agents/ownership-manifest.json) keeps those cards machine-checkable.

The optional read-only shortcut is `node scripts/routeAgentWork.mjs <intent>`; use `--list` to print deterministic intents and aliases. Markdown and the JSON manifest remain the source of truth, so the shortcut is never required.

## Owner cards

| Intent aliases | Direct card | Read | Focused check |
| --- | --- | --- | --- |
| `routes`, `metadata`, `seo` | [Routes](../../.agents/cards/routes-metadata.md) | [documented routes](../architecture/PROJECT_STRUCTURE.md#documented-application-routes) | `npm run typecheck` |
| `architecture`, `ownership`, `structure` | [Architecture](../../.agents/cards/architecture.md) | [application layers](../architecture/ARCHITECTURE.md#application-layers) | `npm run docs:check` |
| `home`, `profile` | [Home/profile](../../.agents/cards/portfolio-home-profile.md) | [Home mapping](../content/CONTENT_MAPPING.md#shared-home-selection) | focused component test |
| `evidence`, `experience`, `research` | [Evidence](../../.agents/cards/portfolio-evidence.md) | [detail selection](../content/CONTENT_MAPPING.md#detail-selection) | focused feature test |
| `projects`, `project-visuals` | [Projects](../../.agents/cards/portfolio-projects.md) | [showcase handoff](../content/PROJECT_SHOWCASE.md#workbook-publication-handoff) | focused feature test |
| `recommendations`, `resume`, `skills` | [Supporting features](../../.agents/cards/portfolio-supporting-features.md) | [portfolio cards](../design/DESIGN_SYSTEM.md#portfolio-cards) | focused feature test |
| `theme`, `modal`, `motion`, `navigation` | [Theme](../../.agents/cards/shared-theme.md) · [Modal](../../.agents/cards/shared-modal.md) · [Motion](../../.agents/cards/shared-motion.md) · [Navigation](../../.agents/cards/shared-navigation.md) | [interface guidance](../design/DESIGN_SYSTEM.md#adding-or-changing-a-component) | card command |
| `content`, `workbook`, `assets` | [Content](../../.agents/cards/content.md) | [generated JSON](../content/CONTENT_PIPELINE.md#generated-json) | generator test |
| `contact`, `endpoint`, `migration` | [Browser contact](../../.agents/cards/contact-browser.md) · [Functions and D1](../../.agents/cards/contact-functions-d1.md) | [endpoint contract](../security/CONTACT_SYSTEM.md#endpoint-contract) | focused contact test |
| `quality`, `tests`, `ci` | [Tests](../../.agents/cards/quality-tests.md) | [command matrix](../quality/TESTING.md#command-matrix) | narrow command |
| `release`, `deployment` | [Deployment](../../.agents/cards/release-deployment.md) | [exact artifact](../operations/DEPLOYMENT.md#single-snapshot-exact-artifact-pipeline) | package/deploy test |
| `docs`, `documentation` | [Docs](../../.agents/cards/docs-maintenance.md) | [documentation principles](../README.md#documentation-principles) | `npm run docs:check` |
| `skeleton`, `loading` | [Skeletons](../../.agents/cards/skeleton-regression.md) | [visual and transition coverage](../design/SKELETON_LOADING_GUIDELINES.md#visual-and-transition-regression-coverage) | `npm run test:skeletons` |
| `infra`, `terraform` | [Infrastructure baseline](../../.agents/cards/infrastructure-baseline.md) | [repository map](../architecture/PROJECT_STRUCTURE.md#repository-map) | `npm run docs:check` |

## Boundaries and future areas

Route and metadata work stays in `src/app/`; portfolio work stays in `src/components/portfolio/`, not a speculative `src/features/` tree. Use the shared theme transition helper and `ModalDialog` boundary named by the owner cards. The manifest records root-level configuration paths as explicit exceptions instead of trying to infer paths from every inline-code span.

Infrastructure ownership is intentionally **not implemented** on this baseline: there is no `infrastructure/`, `infra/`, or Terraform source tree. Add an owner, paths, anchored documentation, and validation before introducing one. The documentation checker will include its Markdown automatically when either directory exists.
