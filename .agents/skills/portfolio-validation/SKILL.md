---
name: portfolio-validation
description: Select and run Smart Portfolio unit, integration, browser, documentation, and release regression checks with evidence matched to change risk.
---

# Portfolio validation

Use this skill when adding or changing tests, validation scripts, browser coverage, CI commands, or a release-quality gate.

Read [Testing](../../../docs/quality/TESTING.md) and [system decisions](../../knowledge/SYSTEM_DECISIONS.md). Start with the closest meaningful unit, integration, or browser contract, then expand only when the changed behavior crosses a boundary. Keep workflow-contract tests synchronized with every CI trigger, permission, artifact, or command change.

Run documentation validation, lint, type checking, focused tests, and the relevant build before handoff. Use `npm run verify:priority` for a pull-request-sized local gate; reserve `npm run verify:full` for a release candidate, since it includes local D1 integration and every Chromium contract. Run the latter on Ubuntu 24.04 when its Linux visual baseline is relevant. Use browser tests for focus, scroll, responsive geometry, fixed positioning, rendering, and painted transitions. Keep deterministic runners bounded when external emulation or browser timing needs isolation; select a unique `PLAYWRIGHT_PORT` for concurrent worktrees, fix the scheduling source rather than weakening assertions or raising timeouts without evidence.

For skeleton geometry, transition semantics, visual baselines, or the browser skeleton gate, read [Skeleton regression](../portfolio-skeleton-regression/SKILL.md) before changing anything. Its Linux-only visual baseline and three-part aggregate contract are mandatory.
