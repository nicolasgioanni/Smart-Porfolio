import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import YAML from 'yaml';

const workflow = YAML.parse(readFileSync('.github/workflows/circleci-verification.yml', 'utf8'));
describe('CircleCI evidence workflow', () => {
  it('uses only a manual trigger and read-only GitHub permissions', () => {
    expect(Object.keys(workflow.on)).toEqual(['status', 'workflow_dispatch']);
    expect(workflow.permissions).toEqual({ contents: 'read' });
    expect(workflow.jobs['circleci-completion'].if).toContain("github.repository == 'nicolasgioanni/Smart-Porfolio'");
  });
  it('runs trusted default-branch code with inputs and secret only in the verifier step', () => {
    const steps = workflow.jobs['circleci-completion'].steps;
    expect(steps[0].with.ref).toBe('${{ github.event.repository.default_branch }}');
    expect(steps[0].with['persist-credentials']).toBe(false);
    expect(steps[0].uses).toBe('actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803');
    expect(steps[1].uses).toBe('actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38');
    expect(steps[1].with['node-version']).toBe('22.23.3');
    expect(steps[2].run).toBe('node scripts/circleci/verify.mjs');
    expect(steps[2].env).toEqual({ STATUS_STATE: '${{ github.event.state }}', STATUS_CONTEXT: '${{ github.event.context }}', STATUS_TARGET_URL: '${{ github.event.target_url }}', STATUS_SHA: '${{ github.event.sha }}', CIRCLECI_WORKFLOW_ID: '${{ inputs.workflow_id }}', EXPECTED_SHA: '${{ inputs.expected_sha }}', CIRCLECI_API_TOKEN: '${{ secrets.CIRCLECI_API_TOKEN }}' });
    expect(JSON.stringify(steps.slice(0, 2))).not.toContain('CIRCLECI_API_TOKEN');
  });
});
