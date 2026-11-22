---
name: portfolio-validation
description: Select and run Smart Portfolio unit, integration, browser, documentation, and release regression checks with evidence matched to change risk.
---

# Portfolio validation

Use for tests, validation, browser coverage, CI commands, and release gates.

For candidate selection, snapshot transfer, browser partitioning or rerun evidence, read [CI input and evidence contracts](../../../docs/quality/CI_CONTRACTS.md). CI resolves one candidate, restores original-producer snapshots, runs full PR application units, and requires independent source-security receipts even for no-ops. Rerun tests distinguish provider copies from new executions, which need new exact evidence; ambiguous history fails closed. Preserve failure-path tests; fixtures do not prove hosted enforcement.

Preserve [CI source-integrity checkpoints](../../../docs/quality/CI_CONTRACTS.md#source-integrity-checkpoints): initial and source-only phases allow no source changes, while the content phase allows only snapshot-verified generated content JSON working-tree bytes. Checkpoints observe persistent changes, not continuous subprocess isolation. Validate the sealed export with visible no-JavaScript route content, footer links, native Projects disclosures and Research media, plus hydrated theme change, client navigation, and CSP errors.

Read [Testing](../../../docs/quality/TESTING.md) and [system decisions](../../knowledge/SYSTEM_DECISIONS.md). Start with the closest meaningful unit, integration, or browser contract, then expand only when the changed behavior crosses a boundary. Keep workflow-contract tests synchronized with every CI trigger, permission, artifact, or command change.

Run documentation validation, lint, type checking, focused tests, and the relevant build. Research mobile or fullscreen changes also require `npm run test:e2e:research:webkit`; Projects responsive previews and switchers require `npm run test:e2e:projects:webkit`. Emulation does not replace a physical iPhone Safari check. `verify:priority` is a local focused gate; `verify:full` is for a local release candidate. Full CI runs complete unit, Chromium, visual, Firefox and WebKit selections from one snapshot. Run Linux visual baselines on Ubuntu 24.04. Use browser tests for focus, scroll, geometry and paint; isolate concurrent worktrees with unique `PLAYWRIGHT_PORT`, and fix scheduling instead of weakening assertions.

For browser accessibility, run `test:e2e:accessibility`; narrow Firefox and WebKit critical suites cover navigation, dialog, theme, and mocked-contact recovery. Run contact property and mutation checks for boundary guards. After `build:generated`, run `test:quality:payload`; never raise its reviewed budget merely to pass. See the [command matrix](../../../docs/quality/TESTING.md#command-matrix).

Browser tests also run against strict workbook builds: derive authored values and optional fields from generated-content selectors, retain deterministic examples in fixtures, and assert content before layout. Preserve sampled animation reversal boundaries.

For skeleton geometry, transition semantics, visual baselines, or the browser skeleton gate, read [Skeleton regression](../portfolio-skeleton-regression/SKILL.md) before changing anything. Its Linux-only visual baseline and three-part aggregate contract are mandatory.

When feature files move, update local priority directories, required-file discovery, and the CI browser assignment discovery with the new owners; run the resolved import-graph contract and preserve existing browser selection. For route fallbacks, validate every exported route with JavaScript disabled and confirm native Research media, Home education, Projects disclosures, and footer links remain usable.

For changes to independent security lanes, verify each lane's fail-closed results and exact producer receipts, including unchanged and obsolete plans. Follow [Scanner governance](../../../docs/security/SCANNER_GOVERNANCE.md) for report privacy and exception ownership.
