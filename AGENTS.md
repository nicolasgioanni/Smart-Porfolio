# Repository agent guidance

## Route the work

Read [.agents/README.md](.agents/README.md), then [system decisions](.agents/knowledge/SYSTEM_DECISIONS.md). Use `npm run agents:route -- --task "description"` or [the registry](.agents/agent-map.json) to select one card; load its relevant specialist and product section. Check primary owners and consumers before crossing boundaries.

## Shared contracts

Preserve static rendering and progressive enhancement: browser code adds interaction and never fetches portfolio content. Features own domain UI, selectors, loaders, and styles; routes compose, components are shared, and libraries stay neutral. Find existing primitives and tests before adding one; follow the import graph. Theme writes use `src/lib/theme/themeTransition.ts`; modal previews use `src/components/overlay/ModalDialog.tsx`. Workbook records remain authoritative for Projects and Research media follows the existing resolver path. Skeleton work requires the [skeleton specialist](.agents/skills/portfolio-skeleton-regression/SKILL.md) and retains alignment, held-navigation transitions, Linux-only zero-difference screenshots, and every `npm run test:e2e:skeletons` contract.

## Worktree and publication policy

Use an isolated fixed-baseline worktree only when authorized. An explicit current-worktree or local-only instruction forbids fetches, worktrees, imports, rebases, branch recreation, pushes, and remote mutation; record a supplied baseline privately. Never delete, rename, force-update, or recreate local or remote `main` or `develop`, weaken protections, or include either branch in cleanup. Perform remote, publication, merge, deployment, or live-infrastructure actions only when authorized by the current task; local-only remains in force until changed. GPT-6.1 Sol coordinates and reviews; GPT-6.1 Terra at High or Extra High implements.

## Evidence

Run docs validation, lint, type checking, focused tests, relevant browser coverage, and a build when the environment and task allow. Run the full relevant validation once near completion, then repeat only affected checks. Keep `next.config.mjs` and `scripts/normalizeNextStaticExport.mjs` together; exported content must work without JavaScript. Infrastructure configuration, artifact integrity, and observed posture are separate evidence; fixtures do not prove live state.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
