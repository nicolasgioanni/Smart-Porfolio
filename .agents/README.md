# Repository agent system

This directory contains portable guidance for work in this repository. Start with [AGENTS.md](../AGENTS.md) for shared constraints, then select only the skill that matches the change.

| Work | Skill |
| --- | --- |
| System boundaries, modules, routes, or documentation ownership | [Architecture](skills/portfolio-architecture/SKILL.md) |
| Workbook input, generated content, or public assets | [Content pipeline](skills/portfolio-content-pipeline/SKILL.md) |
| Components, themes, motion, dialogs, or accessibility | [Interface contracts](skills/portfolio-interface-contracts/SKILL.md) |
| Tests, regressions, or quality evidence | [Validation](skills/portfolio-validation/SKILL.md) |
| Endpoints, deployment, configuration, or release checks | [Release security](skills/portfolio-release-security/SKILL.md) |
| Route skeletons, visual baselines, or held navigation | [Skeleton regression](skills/portfolio-skeleton-regression/SKILL.md) |

The compact, durable project facts live in [system decisions](knowledge/SYSTEM_DECISIONS.md). Read a linked product document when the current task needs its details; do not load unrelated guidance by default.

For a fresh clone, follow the ordered [agent workflow](../docs/development/AGENT_WORKFLOW.md) after reading this map. It leads from a focused worktree through local setup, skill selection, validation, and the authorized pull-request handoff; [local development](../docs/development/LOCAL_DEVELOPMENT.md) owns the dependency and server commands.
