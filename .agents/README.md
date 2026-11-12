# Repository agent system

Read [AGENTS.md](../AGENTS.md), then [system decisions](knowledge/SYSTEM_DECISIONS.md). Run `npm run agents:route` for an index, or route with `--domain theme`, `--path src/lib/theme/themeTransition.ts`, or `--task "theme transition"` after `npm run agents:route --`. Add `--json` for structured output. The read-only command distinguishes primary owners and consumers and reports ambiguity.

Without Node, open [cards](cards/) as `.agents/cards/<domain>.md`. Domains: home, experience, research, projects, recommendations, skills, legal, resume, contact-ui, routes-seo, content, contact-functions, migrations, theme, shared-ui, motion, skeletons, tests, tooling, ci, release, infrastructure, documentation.

Open one card, its relevant specialist, and linked product section; expand when contracts cross. [Agent workflow](../docs/development/AGENT_WORKFLOW.md) documents the schema, workflow, and budgets. Run `npm run docs:check` for documentation and registry checks.
