# Repository agent guidance

## Route the work

- Start with the scoped map in [`.agents/README.md`](.agents/README.md). Read [system decisions](.agents/knowledge/SYSTEM_DECISIONS.md) for compact durable context, then only the linked product documentation needed for the task.
- Use the architecture skill for module, route, and documentation ownership; content pipeline for source data and assets; interface contracts for components, themes, motion, dialogs, and accessibility; validation for tests and CI; release security for endpoints and deployment.
- Use Astra for coordination, review, decomposition, and evidence synthesis. Use GPT-5.6 Terra at High or Extra High for implementation.

## Shared invariants

- Search for an existing component, selector, validator, style primitive, and test helper before adding one. Keep domain content with its feature and extract only clearly repeated behavior.
- Preserve static rendering and progressive enhancement. Client code adds interaction; it does not fetch portfolio content.
- Read the relevant installed Next.js guide in `node_modules/next/dist/docs/` before a framework-sensitive code change.
- Update the guide that owns a changed contract and its links. Documentation, AGENTS.md, and `.agents` guidance are validated by `npm run docs:check`.
- Treat `main` and `develop` as permanent branches. Never delete, rename, force-update, or recreate either local or remote ref, and never weaken their protection. Exclude both refs from branch-cleanup work.
- Use one focused worktree branch for one cohesive idea. Reuse its existing worktree when continuing that idea; before creating a new worktree, the coordinating checkout may fetch and fast-forward `main` once, then keep that baseline fixed for the work.
- Run targeted development checks while changing a contract, then run each relevant final gate once near handoff. Review the complete diff, make one logical commit, push the focused branch, and open an authorized pull request into `main`; do not merge or enable auto-merge unless separately authorized.

## Required specialist rules

- Route every hydrated `data-theme` write through `src/lib/theme/themeTransition.ts`. Use `src/components/overlay/ModalDialog.tsx` for modal previews and evidence dialogs. Read the interface skill before changing either.
- For published Research media, use the existing content resolvers and previews. Read the interface and content skills before changing graphical or video assets.
- For Projects visuals, preserve workbook-owned records and local presentation ownership. Follow [Project showcase](docs/content/PROJECT_SHOWCASE.md) for the import handoff, verified claims, concept assets, diagrams, and no-JavaScript fallback.
- Before changing skeleton geometry, route coverage, visual baselines, transition coverage, or the browser gate, read `.agents/skills/portfolio-skeleton-regression/SKILL.md`. Preserve Linux-only zero-difference baselines and every part of `npm run test:e2e:skeletons`.

## Evidence

- Run documentation validation, lint, type checking, focused tests, the relevant browser coverage, and a build before handoff. Expand to the release suite when the change crosses a release boundary.
- Keep `next.config.mjs` and `scripts/normalizeNextStaticExport.mjs` together. The adapter must fail on malformed exports or collisions rather than overwrite output.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
