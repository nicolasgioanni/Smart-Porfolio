# Agent workflow

Repository-local guidance makes the architecture and validation contracts available after a clone without requiring a separate install. [AGENTS.md](../../AGENTS.md) contains shared constraints, and [.agents](../../.agents/README.md) routes work to focused skills and compact durable decisions.

## Start a repository task

1. Read [AGENTS.md](../../AGENTS.md), then the scoped map in [.agents](../../.agents/README.md) and its system decisions before opening unrelated documentation.
2. Create or select one focused branch and worktree for the cohesive change. Reuse that worktree while the idea remains cohesive. Before creating it, the coordinating checkout may fetch and fast-forward `main` once; treat the resulting baseline as fixed for the work and do not sync, rebase, or cherry-pick unrelated changes into it.
3. Complete the Windows or cross-platform setup path in [Local development](LOCAL_DEVELOPMENT.md) inside that worktree. It defines the Node and npm dependency contract, `.env` handling, local content source, and when to use the static UI or Pages Function server. Do not create a `requirements.txt`; `package.json`, `package-lock.json`, and `.nvmrc` are authoritative.
4. Search for the closest implementation, test, selector, and style primitive. Select the smallest relevant repository skill below and read its linked authoritative product guide before making the change.
5. For deployment, configuration, or release changes, select the release-security skill and read [Deployment](../operations/DEPLOYMENT.md) before editing the workflow, Wrangler configuration, bindings, secrets documentation, or operator instructions. Pull requests never deploy; `develop` deploys preview and `main` deploys production.
6. Make the narrowest coherent change, updating the guide that owns every changed contract.
7. Run the focused checks and the appropriate gate from [Testing](../quality/TESTING.md). Use `npm run verify:priority` for pull-request-sized work after installing Chromium; reserve `npm run verify:full` on Ubuntu 24.04 for a release candidate.
8. Run targeted development checks while changing the contract, then run each relevant final gate once near handoff. Review the complete diff, commit one documented cohesive change, push its branch, and open a pull request into `main` when authorized. Inspect the matching CI result, resolve relevant failures, and stop at the user's requested review or merge boundary; do not merge or enable auto-merge without explicit authorization.

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

Use Astra for coordination, review, decomposition, and evidence synthesis. Use GPT-5.6 Terra at High or Extra High for implementation. If a requested capability is unavailable in a cloned environment, follow the same checked repository contracts with the available tooling and report the validation actually performed.

## Complete a change

Find an existing implementation before adding a new one. Keep work in a focused branch or worktree, update the applicable product and agent documentation with a changed contract, and run the relevant checks from [Testing](../quality/TESTING.md). A passing CI status is evidence from the configured workflow; merge enforcement remains a repository setting and must not be assumed from this documentation.
