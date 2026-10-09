# Repository agent guidance

## Route the work

- Read the scoped [map](.agents/README.md), [system decisions](.agents/knowledge/SYSTEM_DECISIONS.md), task card, then its owning product section.
- Use its matching skill. Use GPT-5.6 Sol for coordination, architecture, and review; use GPT-5.6 Terra at High or Extra High for implementation.
- `main` is production and `develop` preview; both are permanent. Never delete, rename, force-update, recreate, or weaken protection locally or remotely; cleanup excludes both. Use one `codex/` improvement branch and one PR to `main`; never merge or auto-merge.
- Follow the [branch and baseline workflow](docs/development/AGENT_WORKFLOW.md#branch-and-baseline). Existing worktrees keep their recorded baseline and never sync to newer branches, agents, or PRs.

## Shared invariants

- Reuse existing components, selectors, validators, styles, and test helpers; extract only repeated behavior.
- Preserve static rendering and progressive enhancement; client code never fetches portfolio content.
- Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before framework-sensitive code.
- Update owning guides and links; `npm run docs:check` validates them.

## Required specialist rules

- Route hydrated `data-theme` writes through `src/lib/theme/themeTransition.ts` and dialogs through `src/components/overlay/ModalDialog.tsx`; read the interface skill first.
- Use Research resolvers/previews; read interface and content skills before graphical or video assets.
- Keep Project workbook records and local presentation ownership; follow [Project showcase](docs/content/PROJECT_SHOWCASE.md).
- Before skeleton geometry, coverage, baselines, transitions, or browser-gate changes, read `.agents/skills/portfolio-skeleton-regression/SKILL.md`; preserve Linux zero-difference and all of `npm run test:e2e:skeletons`.

## Evidence

- Run docs validation, lint, typecheck, focused/relevant browser tests, then build; expand at a release boundary.
- Keep `next.config.mjs` with `scripts/normalizeNextStaticExport.mjs`; reject malformed exports/collisions.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
