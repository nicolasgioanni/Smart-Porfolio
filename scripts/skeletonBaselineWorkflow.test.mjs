import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workflowPath = path.join(projectRoot, ".github", "workflows", "skeleton-baselines.yml");
const expectedVisualCommand = "playwright test skeletons.visual.spec.ts --project=chromium";

const expectedSteps = [
  "Check out the exact selected candidate",
  "Record the checked out commit",
  "Set up Node.js",
  "Verify selected revision supports visual baseline capture",
  "Install locked dependencies",
  "Generate deterministic local template content",
  "Install Chromium for skeleton screenshots",
  "Generate Linux skeleton visual baselines",
  "Validate the Linux baseline set",
  "Upload Linux skeleton baselines for review"
];

const expectedActions = [
  "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0",
  "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0",
  "actions/upload-artifact@043fb46d1a93c77aae656e7c1c64a875d1fc6a0a # v7.0.1"
];

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length;

  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("skeleton visual baseline capture workflow", () => {
  it("is exactly a manual-only, read-only capture workflow", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const trigger = section(workflow, "on:\n", "\npermissions:");
    const globalPermissions = section(workflow, "permissions:\n", "\njobs:").trim();
    const captureJob = section(workflow, "  capture:\n");
    const jobPermissions = section(captureJob, "    permissions:\n", "\n    steps:").trim();

    expect(trigger).toBe("on:\n  workflow_dispatch:\n");
    expect(globalPermissions).toBe("permissions:\n  contents: read");
    expect(jobPermissions).toBe("permissions:\n      contents: read");
    expect(workflow.match(/^(?:| {4})permissions:/gm)).toHaveLength(2);
    expect(workflow).not.toMatch(/\b(?:write-all|read-all)\b/);
    expect(workflow).not.toMatch(/^\s*(?:push|pull_request|pull_request_target|schedule|workflow_call|workflow_run|repository_dispatch):/m);
    expect(workflow).not.toMatch(/\b(?:secrets\.|github\.token|ACTIONS_ID_TOKEN_REQUEST_TOKEN)\b/i);
    expect([...workflow.matchAll(/\b(?:credential|token|secret)\w*/gi)].map(([match]) => match)).toEqual([
      "credentials"
    ]);
    expect(workflow).not.toMatch(/\bgit\s+(?:add|commit|push|merge|rebase|reset)\b/i);
    expect(workflow).not.toMatch(/\b(?:wrangler|deploy|npm\s+publish|gh\s+(?:api|release)|curl|wget)\b/i);
  });

  it("pins its complete action allowlist and executes only the expected steps", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const actions = [...workflow.matchAll(/^\s+uses: ([^\n]+)$/gm)].map(([, action]) => action.trim());
    const steps = [...workflow.matchAll(/^ {6}- name: (.+)$/gm)].map(([, name]) => name);
    const directRunCommands = [...workflow.matchAll(/^ {8}run: (?!\|)(.+)$/gm)].map(([, command]) => command);

    expect(actions).toEqual(expectedActions);
    expect(steps).toEqual(expectedSteps);
    expect(directRunCommands).toEqual([
      "npm ci",
      "npm run generate:content",
      "npx --no-install playwright install --with-deps chromium",
      "npm run test:e2e:skeletons:visual -- --update-snapshots"
    ]);
    expect(workflow).toContain("runs-on: ubuntu-24.04");
    expect(workflow).toContain("ref: ${{ github.sha }}");
    expect(workflow).not.toContain("inputs.ref");
    expect(workflow).toContain("fetch-depth: 1");
    expect(workflow).toContain("persist-credentials: false");
    expect(workflow.match(/persist-credentials:/g)).toEqual(["persist-credentials:"]);
    expect(workflow).toContain('echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"');
  });

  it("preflights the visual-only command and captures only the exact Linux baseline set", async () => {
    const workflow = await readFile(workflowPath, "utf8");
    const preflight = section(
      workflow,
      "- name: Verify selected revision supports visual baseline capture",
      "- name: Install locked dependencies"
    );
    const generation = section(
      workflow,
      "- name: Generate deterministic local template content",
      "- name: Install Chromium for skeleton screenshots"
    );
    const validation = section(
      workflow,
      "- name: Validate the Linux baseline set",
      "- name: Upload Linux skeleton baselines for review"
    );
    const upload = section(workflow, "- name: Upload Linux skeleton baselines for review");
    const packageJson = JSON.parse(await readFile(path.join(projectRoot, "package.json"), "utf8"));

    expect(preflight).toContain('visual_spec="tests/e2e/skeletons.visual.spec.ts"');
    expect(preflight).toContain('[[ ! -f "$visual_spec" ]]');
    expect(preflight).toContain("rebase the visual baseline branch onto this workflow before dispatching it");
    expect(preflight).toContain("node --input-type=module");
    expect(preflight).toContain('packageJson.scripts?.["test:e2e:skeletons:visual"] !== expectedCommand');
    expect(preflight).toContain("missing the required visual-only test:e2e:skeletons:visual script");
    expect(workflow).toContain("node-version: 22");
    expect(workflow).toContain("run: npm ci");
    expect(generation).toContain('PORTFOLIO_REQUIRE_REMOTE_CONTENT: "false"');
    expect(generation).toContain('PORTFOLIO_WORKBOOK_URL: ""');
    expect(generation).toContain("run: npm run generate:content");
    expect(workflow.match(/playwright install --with-deps chromium/g)).toHaveLength(1);
    expect(workflow).toContain("npx --no-install playwright install --with-deps chromium");
    expect(workflow).toContain("run: npm run test:e2e:skeletons:visual -- --update-snapshots");
    expect(workflow).not.toContain("run: npm run test:e2e:skeletons -- --update-snapshots");
    expect(workflow).not.toContain("maxDiffPixels:");
    expect(workflow).not.toContain("--ignore-snapshots");
    expect(validation).toContain('baseline_root="tests/e2e/__screenshots__/linux"');
    expect(validation).toContain("-type f -name '*.png'");
    expect(validation).toContain('"$png_count" != "23"');
    expect(upload).toContain(
      "name: skeleton-baselines-linux-${{ github.run_id }}-${{ github.run_attempt }}-${{ steps.candidate.outputs.sha }}"
    );
    expect(upload).toContain("path: tests/e2e/__screenshots__/linux/");
    expect(upload).toContain("if-no-files-found: error");
    expect(upload).toContain("retention-days: 7");
    expect(packageJson.scripts["test:e2e:skeletons:visual"]).toBe(expectedVisualCommand);
  });
});
