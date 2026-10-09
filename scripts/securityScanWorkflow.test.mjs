import { chmod, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const reusableWorkflowPath = path.join(projectRoot, ".github", "workflows", "security-scans.yml");
const scheduleWorkflowPath = path.join(projectRoot, ".github", "workflows", "security-scan-schedule.yml");
const ciWorkflowPath = path.join(projectRoot, ".github", "workflows", "ci.yml");
const execFileAsync = promisify(execFile);

function section(source, start, end) {
  const startIndex = source.indexOf(start);
  const endIndex = end ? source.indexOf(end, startIndex + start.length) : source.length;
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("dedicated security scan workflow", () => {
  it("pins every scanner, bounds every job, and keeps scanner reports private", async () => {
    const workflow = await readFile(reusableWorkflowPath, "utf8");

    for (const pin of [
      "actions/checkout@d23441a48e516b6c34aea4fa41551a30e30af803 # v6.1.0",
      "actions/setup-node@249970729cb0ef3589644e2896645e5dc5ba9c38 # v6.5.0",
      "actions/dependency-review-action@a1d282b36b6f3519aa1f3fc636f609c47dddb294 # v5.0.0",
      "github/codeql-action/init@24c54180a607b1449ed407dd24f251e4e9147c8d # v4.38.3",
      "github/codeql-action/analyze@24c54180a607b1449ed407dd24f251e4e9147c8d # v4.38.3",
      "github/codeql-action/upload-sarif@24c54180a607b1449ed407dd24f251e4e9147c8d # v4.38.3",
      "551f6fc83ea457d62a0d98237cbad105af8d557003051f41f3e7ca7b3f2470eb",
      "8aca8db96f1b94770f1b0d72b6dddcb1ebb8123cb3712530b08cc387b349a3d8",
      "e65324f4430c2717591937edcec90ccbefaf14c174f8ec9415e03ca875b46e1a",
      "2bc2fcfff033265c9e02ca0351f01794eb122f62a9b2a49a3294b9e49eaab5e4",
      "c6e65abddb348e25f10549df887045629cf28cc72453cd1c63acb717316b3f3f"
    ]) {
      expect(workflow).toContain(pin);
    }
    expect(workflow.match(/timeout-minutes:/g)).toHaveLength(11);
    expect(workflow.match(/persist-credentials: false/g)).toHaveLength(11);
    expect(workflow).not.toContain("pull_request_target");
    expect(workflow).not.toContain("upload-artifact");
    expect(workflow).not.toMatch(/npm (?:ci|run)/);
    expect(workflow).not.toContain("continue-on-error");
    expect(workflow).not.toContain("secrets.");
    expect(workflow).toContain('report_dir="$(mktemp -d "$RUNNER_TEMP/security-scans.XXXXXX")"');
  });

  it("accepts the first line of the pinned actionlint three-line version banner", async () => {
    const toolDir = await mkdtemp(path.join(tmpdir(), "portfolio-actionlint-banner-"));
    const actionlint = path.join(toolDir, "actionlint");
    const failingActionlint = path.join(toolDir, "failing-actionlint");
    await writeFile(actionlint, `#!/usr/bin/env bash
if [[ "$1" == "-version" ]]; then
  printf '%s\n' '1.7.12' 'installed by downloading from release page' 'built with go1.26.1 compiler for linux/amd64'
fi
`, "utf8");
    await writeFile(failingActionlint, "#!/usr/bin/env bash\nexit 73\n", "utf8");
    await Promise.all([chmod(actionlint, 0o700), chmod(failingActionlint, 0o700)]);
    const parser = `set -euo pipefail
banner="$("$1" -version)"
version="\${banner%%$'\n'*}"
[[ "$version" == "1.7.12" ]]
printf '%s' "$version"`;
    const { stdout } = await execFileAsync("bash", ["-c", parser, "--", actionlint]);
    const workflow = await readFile(reusableWorkflowPath, "utf8");

    expect(stdout).toBe("1.7.12");
    await expect(execFileAsync("bash", ["-c", parser, "--", failingActionlint])).rejects.toMatchObject({ code: 73 });
    expect(workflow).toContain('actionlint_banner="$("$tool_dir/actionlint" -version)"');
    expect(workflow).toContain(`actionlint_version="\${actionlint_banner%%$'\\n'*}"`);
    expect(workflow).not.toContain('actionlint" -version | awk');
  });

  it("uses one immutable candidate and makes every lane fail after a count-only summary", async () => {
    const workflow = await readFile(reusableWorkflowPath, "utf8");
    const aggregate = section(workflow, "  security_aggregate:");

    expect(workflow).toContain("resolve-security-scan-candidate");
    expect(workflow).toContain('echo "sha=$(git rev-parse HEAD)" >> "$GITHUB_OUTPUT"');
    const lanes = [
      "npm_audits",
      "dependency_review",
      "gitleaks",
      "codeql",
      "actionlint",
      "zizmor",
      "terraform_validate",
      "trivy_config"
    ];
    for (const [index, lane] of lanes.entries()) {
      const laneSource = section(
        workflow,
        `  ${lane}:`,
        index + 1 < lanes.length ? `\n  ${lanes[index + 1]}:` : "\n  security_aggregate:"
      );
      expect(laneSource).toContain("needs: [resolve_candidate, preflight]");
      expect(laneSource).toContain("needs.resolve_candidate.outputs.sha");
    }
    expect(workflow.match(/enforce-summary/g)).toHaveLength(9);
    expect(aggregate).toContain("if: ${{ always() }}");
    expect(aggregate).toContain("SECURITY_PREFLIGHT_RESULT");
    for (const lane of [
      "npm_audits",
      "dependency_review",
      "gitleaks",
      "codeql",
      "actionlint",
      "zizmor",
      "terraform_validate",
      "trivy_config"
    ]) {
      expect(aggregate).toContain(`- ${lane}`);
    }
  });

  it("uses trusted scanner configuration and preserves full coverage accounting", async () => {
    const workflow = await readFile(reusableWorkflowPath, "utf8");
    const preflight = section(workflow, "  preflight:", "\n  npm_audits:");
    const audits = section(workflow, "  npm_audits:", "\n  dependency_review:");
    const dependencyReview = section(workflow, "  dependency_review:", "\n  gitleaks:");
    const gitleaks = section(workflow, "  gitleaks:", "\n  codeql:");
    const codeql = section(workflow, "  codeql:", "\n  actionlint:");
    const actionlint = section(workflow, "  actionlint:", "\n  zizmor:");
    const zizmor = section(workflow, "  zizmor:", "\n  terraform_validate:");
    const terraform = section(workflow, "  terraform_validate:", "\n  trivy_config:");
    const trivy = section(workflow, "  trivy_config:", "\n  security_aggregate:");

    expect(preflight).toContain("validate-suppressions .github/security-scan-suppressions.json .");
    expect(dependencyReview).toContain("DEPENDENCY_REVIEW_EVENT: ${{ inputs.event_name }}");
    expect(dependencyReview).toContain('[[ "$DEPENDENCY_REVIEW_EVENT" != "pull_request" ]]');
    expect(dependencyReview).not.toContain('[[ "${{ inputs.event_name }}"');
    expect(audits).toContain("node-version: 22.23.3");
    expect(audits).toContain('[[ "$(npm --version)" == "10.9.9" ]]');
    expect(audits).toContain("cp package.json package-lock.json");
    expect(audits).toContain("NPM_CONFIG_USERCONFIG");
    expect(audits).toContain("npm-audit-global.npmrc");
    expect(audits).toContain("NPM_CONFIG_IGNORE_SCRIPTS=true");
    expect(audits).toContain("npm audit --package-lock-only --ignore-scripts --json");
    expect(audits).toContain("npm audit --package-lock-only --omit=dev --ignore-scripts --json");
    expect(audits).toContain("if: ${{ always() }}");
    expect(gitleaks).toContain("fetch-depth: 0");
    expect(gitleaks).toContain("--log-opts=HEAD");
    expect(gitleaks).toContain("--gitleaks-ignore-path");
    expect(gitleaks).toContain("--ignore-gitleaks-allow");
    expect(gitleaks).toContain("--redact=100");
    expect(codeql).toContain("tools: 2.27.1");
    expect(codeql).toContain("build-mode: none");
    expect(codeql).toContain("upload: never");
    expect(codeql).toContain("id: js/alert-suppression");
    expect(codeql).toContain("inputs.is_fork == false");
    expect(codeql).toContain("Normalize the local SARIF result before any eligible upload");
    expect(actionlint).toContain("'.github/workflows/*.yml' '.github/workflows/*.yaml'");
    expect(actionlint).toContain("if ! git ls-files -z");
    expect(actionlint).toContain(`mapfile -d '' -t workflow_files < "$workflow_list"`);
    expect(actionlint).not.toContain("< <(git ls-files");
    expect(actionlint).toContain("-config-file");
    expect(actionlint).toContain("-shellcheck '' -pyflakes ''");
    expect(actionlint).toContain("actionlint 1.7.12 predates GitHub's $/ self-repository syntax");
    expect(actionlint).toContain("sed -E 's#^([[:space:]]*uses:[[:space:]]*)\\$/#\\1./#'");
    expect(actionlint).not.toContain("-ignore");
    expect(zizmor).toContain("'.github/workflows/*.yml' '.github/workflows/*.yaml' 'action.yml' 'action.yaml' '*/action.yml' '*/action.yaml'");
    expect(zizmor).toContain(`mapfile -d '' -t zizmor_targets < "$target_list"`);
    expect(zizmor).not.toContain("< <(git ls-files");
    expect(zizmor).toContain("--no-config --no-ignores --strict-collection --no-exit-codes");
    expect(terraform).toContain("terraform-admission");
    expect(terraform).not.toContain("terraform init");
    expect(trivy).toContain("trivy-targets");
    expect(trivy).toContain("not-applicable trivy-config trivy 0.75.0 no-config-targets");
    expect(trivy).toContain('--config="" --ignorefile="" --skip-check-update --disable-telemetry --skip-version-check');
    expect(trivy).toContain('"$report_dir/trivy.json" .');
    expect(trivy).not.toContain('"${trivy_targets[@]}"');
    expect(trivy).toContain("trivy-report");
  });

  it("calls scans for every supported CI event and keeps the independent schedule separate from content comparison", async () => {
    const [ci, scheduled] = await Promise.all([
      readFile(ciWorkflowPath, "utf8"),
      readFile(scheduleWorkflowPath, "utf8")
    ]);
    const caller = section(ci, "  security_aggregate:", "\n  deploy:");

    expect(caller).toContain("uses: $/.github/workflows/security-scans.yml");
    expect(ci).toContain("ref: ${{ (github.event_name == 'schedule' || github.event_name == 'workflow_dispatch') && 'main' || github.sha }}");
    expect(caller).toContain("needs: resolve_candidate");
    expect(caller).toContain("candidate_ref: ${{ needs.resolve_candidate.outputs.candidate_sha }}");
    expect(ci).toContain("ref: ${{ needs.resolve_candidate.outputs.candidate_sha }}");
    expect(caller).toContain("security-events: write");
    expect(ci).toContain("needs: [verify, security_aggregate]");
    expect(scheduled).toContain('- cron: "43 11 * * 1"');
    expect(scheduled).toContain("candidate_ref: main");
    expect(scheduled).not.toContain("checkDeployedContent");
    expect(scheduled).not.toContain("generate:content");
  });
});
