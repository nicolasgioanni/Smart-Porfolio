# ci

Workflow orchestration, candidate snapshots and rerun evidence. Trace candidate identity, workflow graph, snapshots and receipts before changing orchestration.

Start at `scripts/ci/run.mjs` and inspect `scripts/ci/workflowGraph.test.mjs`. Read the [portfolio-validation](../skills/portfolio-validation/SKILL.md) and [authority](../../docs/quality/CI_CONTRACTS.md#candidate-and-execution-plan) for this contract. Run `npm run test` as applicable.

Consumers: release. Reruns, artifact identity or job dependencies require the CI evidence guide and workflow tests.
