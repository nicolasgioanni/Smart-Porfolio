# Architecture and ownership

Owns module boundaries, route placement, and map maintenance. Start with [application layers](../../docs/architecture/ARCHITECTURE.md#application-layers), [change placement](../../docs/architecture/PROJECT_STRUCTURE.md#where-should-this-change-go), and [direct import checks](../../src/lib/architecture/importBoundaries.test.ts).

Keep `src/lib` below components, keep portfolio features in `src/features/`, and preserve static-first rendering. Reuse [the route registry](../../src/lib/routing/siteRoutes.ts) and the [ownership manifest](../ownership-manifest.json) before creating a new boundary.

For a new improvement worktree, refresh `origin` and fast-forward only local `main`, then record its baseline before creating the worktree. An existing worktree retains its baseline unless the current task expressly authorizes an integration delta.

Run `npm run docs:check` and `npm run lint`. Broaden to `npm run verify:priority` when a change crosses routes, generated content, or an interaction boundary.
