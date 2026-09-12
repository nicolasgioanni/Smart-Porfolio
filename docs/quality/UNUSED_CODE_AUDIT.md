# Repository reachability audit

This audit records the evidence required before removing repository material. It is a preservation-first review: a file is removable only when its active paths and its supported discovery mechanism have both been checked.

## Scope and method

The initial review covered the `main` revision `967236da6305515d8cd6f19d38ad68c4b28c9516` and included application source, Cloudflare Functions, scripts, package commands, workflows, documentation, tests, and public assets. It intentionally excluded generated build directories and dependency directories.

The review used these checks together:

1. TypeScript compiler analysis with `noUnusedLocals` and `noUnusedParameters` enabled.
2. A TypeScript module-resolution graph for imports and re-exports, with application, script, Function, and test roots classified separately.
3. Repository-wide literal-reference searches for public paths and script entry points.
4. Package and workflow inspection for command-line and continuous-integration entry points.
5. Current generated-content inspection, including the source-mode metadata and every published asset path.
6. A follow-up direct-export and component review after portfolio ownership was reorganized. It combined a static TypeScript import graph with repository-wide symbol searches across application code, tests, scripts, Functions, styles, and documentation.

Compiler and import-graph results are evidence, not proof that a file is removable. Framework discovery, direct command execution, generated content, and externally addressable public paths are checked before a deletion is approved.

## Limits

The module graph resolves static TypeScript imports and re-exports. It does not prove reachability for framework filesystem conventions, commands assembled at runtime, a future workbook value, or a public URL requested outside the repository. A clean compiler result also does not prove that every export is necessary. This audit therefore records confirmed removals and retention decisions; it does not claim that all unused code has been removed.

## Retained implementation roots

No TypeScript or CSS source file met the removal standard in the initial pass. The focused follow-up review below rechecked direct exports and unused component modules after the ownership refactor.

The following initially appear unreferenced to a simple import scan, but are active roots or generated inputs:

| Item | Retention reason |
| --- | --- |
| `src/app/**/page.tsx`, `loading.tsx`, `robots.txt`, and `sitemap.xml` | Next.js route and metadata conventions discover these files without application imports. |
| `functions/api/contact.ts` and `functions/api/contact/verify.ts` | Cloudflare Pages Functions discover these filesystem routes. |
| `scripts/fetchPortfolioContent.ts`, build adapters, deployment checks, and local automation scripts | Package commands, GitHub Actions, or direct Node execution invoke them. |
| `src/content/generated/portfolio.generated.json` | `getPortfolioContent()` imports and validates the published content snapshot. |
| Skeleton and browser-test helpers | Tests import them directly or execute their renderer process at runtime. |

The strict TypeScript pass reported no unused locals or parameters. The module graph also found no `src/` production module that was imported only from tests. That result does not establish that every exported API is necessary, so exported APIs remain subject to focused review when their owning feature changes.

## Follow-up direct-export and component cleanup

The follow-up review covered the ownership-refactor baseline `434f2bae9d424ab02360bfd88183bf05f8ff5c2b`. It reran `tsc --noUnusedLocals --noUnusedParameters`, resolved static TypeScript imports from application and test roots, and searched every candidate name across the repository. The findings below have no framework discovery path, command entry point, generated-content reference, or external public-URL compatibility concern.

| Removed implementation | Evidence |
| --- | --- |
| `ExperienceList`, `ExperienceTimeline`, `ExperienceTimelineItem`, `ProfileSummary`, and `SkillsSummary` | The pass-through wrappers had no importer. Removing `ExperienceList` exposed the unused timeline and timeline item; their names and `.experience-timeline*` and `.timeline-item*` selectors had no remaining consumer. |
| `SkillBadge` | It had no production or test import. Active skill badges are rendered directly by `InteractiveSkillShowcase`; the remaining security assertion is a negative source-text check, not a dependency. |
| `GlassDivider` and `.glass-divider` | The component had no import, and the CSS selector appeared only in that component and its now-removed design-system entry. |
| `getEducationLogo`, `getFeaturedRecommendation`, and `formatList` | Each exported helper had only its definition repository-wide. |
| `SkeletonHero`, `SkeletonGrid`, `SkeletonCard`, `SkeletonAvatar`, and their unique selectors | The first two compositions had no import or route discovery path. Removing them made the card and avatar compositions unreachable too. `.skeleton-hero*`, `.skeleton-grid*`, `.skeleton-card`, `.skeleton-avatar`, and `.skeleton-actions` were then unreferenced. Shared `.skeleton-page__actions`, `.skeleton-page__section`, and active `.detail-card-skeleton-grid` rules remain. The obsolete skeleton-guideline entries were removed. |

This removal preserves live route markup and active CSS rules. It does not imply that a future public asset or framework-convention file is removable; those remain subject to the retention limits above.

## Public assets retained for content compatibility

The checked-in snapshot at the audit revision reports `sourceMode: "templates"`. The content pipeline also supports remote and mixed source modes. Content validation accepts safe root-relative paths for profile images, project images, organization and institution logos, and other supported media fields. A public file without a current literal reference can therefore be selected by a later approved workbook snapshot or still be linked from outside the repository.

For that reason, the following assets are retained even though the current templates and generated snapshot do not name them:

| Asset group | Reason for retention |
| --- | --- |
| `public/images/backgrounds/dark.png`, `light.png`, and `navy.png` | Public root-relative assets may be selected by validated content and are externally addressable. |
| `public/images/projects/project-placeholder.png` | A project image value may select this public path. |
| `public/images/research/research-placeholder.png` | A reviewed research graphical-abstract path may select this public path with matching alt text. |
| `public/images/education/uw_logo.png` | It is byte-identical to the organization copy, but the current template and generated snapshot use the education URL. Consolidation requires an explicit content-path migration that includes remote authoring. |

Do not delete or rename one of these assets until the current remote workbook, the generated snapshot, deployment behavior, and any intended compatibility period for the public URL have been reviewed together.

## Confirmed cleanup

The only files removed by this audit are directory-preservation markers inside nonempty public directories. Each directory already contains one or more tracked publishable files, and no configuration or source references its marker.

| Removed files | Evidence |
| --- | --- |
| `public/favicon/.gitkeep` | `public/favicon/` contains `favicon.png`. |
| `public/images/backgrounds/.gitkeep` | `public/images/backgrounds/` contains the three retained background images. |
| `public/images/education/.gitkeep` | `public/images/education/` contains two image files. |
| `public/images/organizations/.gitkeep` | `public/images/organizations/` contains four image files. |
| `public/images/profile/.gitkeep` | `public/images/profile/` contains two image files. |
| `public/images/projects/.gitkeep` | `public/images/projects/` contains `project-placeholder.png`. |
| `public/images/research/.gitkeep` | `public/images/research/` contains the published media and abstract assets. |

Removing these markers does not change a route, export, content value, functional asset URL, or emitted site behavior.

Future reachability reviews should update this document with their evidence and retain uncertain material for the feature owner to resolve.
