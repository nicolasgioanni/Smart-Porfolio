# Agent workflow

Repository-local guidance makes the architecture and validation contracts available after a clone without requiring a separate install. [AGENTS.md](../../AGENTS.md) contains shared constraints, and [.agents](../../.agents/README.md) routes work to focused skills and compact durable decisions.

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
