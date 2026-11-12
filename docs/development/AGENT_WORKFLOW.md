# Agent workflow

Repository-local guidance makes the architecture and validation contracts available after a clone without requiring a separate install. [AGENTS.md](../../AGENTS.md) contains shared constraints, and [.agents](../../.agents/README.md) routes work to focused skills and compact durable decisions.

## Start a repository task

1. Read [AGENTS.md](../../AGENTS.md), then the scoped map in [.agents](../../.agents/README.md) and its system decisions before opening unrelated documentation.
2. Create an isolated fixed-baseline worktree only when the current task authorizes it. When authorized, the coordinator fetches and fast-forwards `main` first and records the baseline; continuation retains that baseline without refresh or sync. An explicit current-worktree or local-only instruction forbids fetches, worktrees, imports, rebases, branch recreation, pushes, and remote mutation; record a supplied baseline privately. Only an explicitly authorized and recorded integration delta may change the baseline relationship.
3. Complete the Windows or cross-platform setup path in [Local development](LOCAL_DEVELOPMENT.md) inside that worktree. It defines the Node and npm dependency contract, `.env` handling, local content source, and when to use the static UI or Pages Function server. Do not create a `requirements.txt`; `package.json`, `package-lock.json`, and `.nvmrc` are authoritative.
4. Route to one ownership card, then search for the closest implementation, test, selector, and style primitive. Read its relevant specialist and linked authoritative product section before making the change.
5. For deployment, configuration, or release changes, select the release-security skill and read [Deployment](../operations/DEPLOYMENT.md) before editing the workflow, Wrangler configuration, bindings, secrets documentation, or operator instructions. Pull requests never deploy; `develop` deploys preview and `main` deploys production.
6. Make the narrowest coherent change, updating the guide that owns every changed contract.
7. Run the focused checks and the appropriate gate from [Testing](../quality/TESTING.md). Use `npm run verify:priority` for pull-request-sized work after installing Chromium; reserve `npm run verify:full` on Ubuntu 24.04 for a release candidate.
8. Commit a documented cohesive change, push its branch, and open a pull request into `main` when authorized. Inspect the matching CI result, resolve relevant failures, and stop at the user's requested review or merge boundary.

`main` and `develop` are permanent branches. Never delete, rename, force-update, or recreate either local or remote ref, and never weaken their protection. Exclude both refs from branch-cleanup work. The tracked [permanent-branch ruleset](../../.github/rulesets/protect-permanent-branches.json) blocks deletion and non-fast-forward updates only for those exact refs, leaving the guarded ordinary `develop` heartbeat valid. It supplements `main`'s separate pull-request and required-`verify` policy. The tracked JSON is not evidence that GitHub has applied it; verify the live configuration independently. The current task's explicit authorization controls generic workflow defaults but does not relax this permanent-branch invariant.

## Select the smallest relevant guidance

| Change | Read |
| --- | --- |
| System design, module ownership, route structure, or documentation | [Architecture skill](../../.agents/skills/portfolio-architecture/SKILL.md) |
| Workbook, generated content, or portfolio assets | [Content pipeline skill](../../.agents/skills/portfolio-content-pipeline/SKILL.md) |
| Components, theme, motion, dialogs, or accessibility | [Interface contracts skill](../../.agents/skills/portfolio-interface-contracts/SKILL.md) |
| Tests, regression coverage, or CI | [Validation skill](../../.agents/skills/portfolio-validation/SKILL.md) |
| Endpoints, runtime configuration, deployment, or release | [Release security skill](../../.agents/skills/portfolio-release-security/SKILL.md) |
| Skeleton geometry, visual baselines, or route transitions | [Skeleton regression skill](../../.agents/skills/portfolio-skeleton-regression/SKILL.md) |

Read the linked product document only when the selected task needs its detail. The compact [system decisions](../../.agents/knowledge/SYSTEM_DECISIONS.md) record stable boundaries and link to the authoritative implementation documentation. Update it only when the decision itself changes.

## Model routing

Use GPT-6.1 Sol for coordination, review, decomposition, and evidence synthesis. Use GPT-6.1 Terra at High or Extra High for implementation. If a requested capability is unavailable in a cloned environment, follow the same checked repository contracts with the available tooling and report the validation actually performed.

## Complete a change

Find an existing implementation before adding a new one. Keep work in a focused branch or worktree, update the applicable product and agent documentation with a changed contract, and run the relevant checks from [Testing](../quality/TESTING.md). A passing CI status is evidence from the configured workflow; merge enforcement remains a repository setting and must not be assumed from this documentation.

## Agent registry and routing

The versioned [registry](../../.agents/agent-map.json) has 23 cards. Each defines responsibility, disjoint primary owner patterns and optional exclusions, downstream consumers, entrypoints and tests, specialist IDs, authoritative sections, npm script names, task triggers, and expansion triggers. Patterns are exact repository-relative paths or directory prefixes ending in `/**`; exclusions override inclusions. Generated snapshots and historical evidence are explicitly excluded. `npm run agents:check` checks tracked and unignored new files for exactly one owner or one exclusion, rejects unused patterns, missing cards or references, stale commands and anchors, and validates guidance budgets. `npm run docs:check` runs this after the bounded Markdown validator.

Use `npm run agents:route` for a compact index, `npm run agents:route -- --domain theme`, `npm run agents:route -- --path src/lib/theme/themeTransition.ts`, or `npm run agents:route -- --task "theme transition"`; add `--json` for structured results. Task triggers select the longest matching phrase; ties are reported as ambiguous. A path reports its primary owner, not every consumer. Open one card and its specialist and linked authority, then expand when the task crosses their contracts. Routing reads local files only and does not change the tree.

Core guidance is limited to 6,144 bytes combined, each card to 2,048, each specialist to 4,096, and normal startup (core, one card, and its specialists) to 12,288. Keep detailed contracts in their authoritative product sections and links in focused guidance.
