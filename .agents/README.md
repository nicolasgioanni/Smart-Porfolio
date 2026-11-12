# Repository agent system

Read [AGENTS.md](../AGENTS.md), then [system decisions](knowledge/SYSTEM_DECISIONS.md). Run `npm run agents:route` for a compact index. Route by `npm run agents:route -- --domain theme`, `npm run agents:route -- --path src/lib/theme/themeTransition.ts`, or `npm run agents:route -- --task "theme transition"`. Add `--json` for machine-readable output. The command is read-only, reports one primary owner and its consumers, or reports ambiguity for a task; select one domain or use a path when ambiguous. No match is not an ownership claim.

Open the selected card, its relevant specialist, and the linked product section. Expand only when the task crosses a listed contract. [Agent workflow](../docs/development/AGENT_WORKFLOW.md) documents the registry schema, fixed-baseline workflow, checks, and budgets. Run `npm run agents:check` after registry changes; `npm run docs:check` includes it.
