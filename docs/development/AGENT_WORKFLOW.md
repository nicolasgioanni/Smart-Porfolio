# Agent workflow

Repository-local guidance makes the architecture and validation contracts available after a clone without requiring a separate install. [AGENTS.md](../../AGENTS.md) contains shared constraints, and [.agents](../../.agents/README.md) routes work to focused skills and compact durable decisions.

## Start a repository task

1. Read [AGENTS.md](../../AGENTS.md), then the scoped map in [.agents](../../.agents/README.md) and its system decisions before opening unrelated documentation.
2. Before every improvement, including one that reuses an existing worktree, the coordinating checkout must run `git fetch origin`, advance local `main` from `origin/main` with a fast-forward-only update, and record the resulting SHA as the fixed baseline. Then create or select one focused `codex/` branch and worktree for the cohesive idea. After recording that baseline, ignore later upstream changes: do not merge, rebase, cherry-pick, pull, or otherwise sync newer `main` or work from other branches, agents, or pull requests into the worktree.
3. Complete the Windows or cross-platform setup path in [Local development](LOCAL_DEVELOPMENT.md) inside that worktree. It defines the Node and npm dependency contract, `.env` handling, local content source, and when to use the static UI or Pages Function server. Do not create a `requirements.txt`; `package.json`, `package-lock.json`, and `.nvmrc` are authoritative.
4. Search for the closest implementation, test, selector, and style primitive. Select the smallest relevant repository skill below and read its linked authoritative product guide before making the change.
5. For deployment, configuration, or release changes, select the release-security skill and read [Deployment](../operations/DEPLOYMENT.md) before editing the workflow, Wrangler configuration, bindings, secrets documentation, or operator instructions. Pull requests never deploy; `develop` deploys preview and `main` deploys production.
6. Make the narrowest coherent change, updating the guide that owns every changed contract.
7. Run the focused checks and the appropriate gate from [Testing](../quality/TESTING.md). Use `npm run verify:priority` for pull-request-sized work after installing Chromium; reserve `npm run verify:full` on Ubuntu 24.04 for a release candidate.
8. Run targeted development checks while changing the contract, then run each relevant final gate once near handoff. Review the complete diff, make one or more documented logical commits, push the branch, and open a pull request into `main` when authorized. The pull request must state its purpose, design, tests, documentation, risks, and reviewer notes. Inspect the matching CI result and resolve relevant failures, then stop at the open pull request for this workflow; do not merge or enable auto-merge.

`main` and `develop` are permanent branches. Never delete, rename, force-update, or recreate either local or remote ref, and never weaken their protection. Exclude both refs from branch-cleanup work. The tracked [permanent-branch ruleset](../../.github/rulesets/protect-permanent-branches.json) blocks deletion and non-fast-forward updates for those exact refs. It intentionally does not restrict ordinary updates or creation, so the guarded non-force `develop` heartbeat remains possible. The ruleset is repository configuration, not evidence that GitHub has applied it; preserve `main`'s separate pull-request and required-`verify` rules and verify live settings independently.

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

Use GPT-5.6 Sol for coordination, architecture, review, decomposition, and evidence synthesis. Use GPT-5.6 Terra at High or Extra High for implementation. If a requested capability is unavailable in a cloned environment, follow the same checked repository contracts with the available tooling and report the validation actually performed.

## Complete a change

Find an existing implementation before adding a new one. Keep work in a focused branch or worktree, update the applicable product and agent documentation with a changed contract, and run the relevant checks from [Testing](../quality/TESTING.md). A passing CI status is evidence from the configured workflow; merge enforcement remains a repository setting and must not be assumed from this documentation.
