// @vitest-environment node
import { existsSync } from "node:fs";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { parseWorkflowYaml } from "./ci/workflowYaml.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workflowPath = path.join(projectRoot, ".github", "workflows", "ci.yml");
const developSha = "a".repeat(40);
const token = "test-token-must-not-appear-in-output";

function workflowScript(source) {
  const job = parseWorkflowYaml(source).jobs['heartbeat'];
  const selected = job.steps.find((step) => step.name === 'Refresh the existing develop branch after 30 inactive days');
  expect(typeof selected?.run).toBe("string");
  return selected.run;
}

const gitMock = `#!/usr/bin/env bash
set -euo pipefail
printf '%s\\n' "$*" >> "$GIT_CALLS"
case "$1" in
  ls-remote)
    if [[ "\${2:-}" == "--exit-code" ]]; then
      [[ "\${DEVELOP_EXISTS:-true}" == "true" ]] || exit 2
    elif [[ "\${RACE:-false}" == "true" ]]; then
      printf '%s\\trefs/heads/develop\\n' "$(printf b%.0s {1..40})"
    else
      printf '%s\\trefs/heads/develop\\n' "$DEVELOP_SHA"
    fi
    ;;
  fetch|switch|merge|add|config|commit) ;;
  log)
    if [[ "$*" == *"origin/main" ]]; then printf '%s\\n' "$MAIN_EPOCH"; else printf '%s\\n' "$DEVELOP_EPOCH"; fi
    ;;
  rev-parse) printf '%s\\n' "$DEVELOP_SHA" ;;
  show-ref) [[ "\${LOCAL_DEVELOP_EXISTS:-true}" == "true" ]] || exit 1 ;;
  status) printf '%s' "\${STATUS_OUTPUT:-}" ;;
  diff) printf '%s\\n' '.github/schedule-heartbeat' ;;
  merge-base) [[ "\${FAIL_FAST_FORWARD:-false}" != "true" ]] || exit 1 ;;
  -c)
    [[ "\${3:-}" == "push" ]] || exit 3
    [[ "\${4:-}" == "origin" && "\${5:-}" == "HEAD:refs/heads/develop" ]] || exit 4
    [[ -n "\${GIT_ASKPASS:-}" && "\${GIT_TERMINAL_PROMPT:-}" == "0" && "\${GCM_INTERACTIVE:-}" == "Never" ]] || exit 5
    cat "$GIT_ASKPASS" > "$ASKPASS_SOURCE"
    printf '%s\\n' "$GIT_ASKPASS" > "$ASKPASS_PATH"
    "$GIT_ASKPASS" 'Username for https://github.com' > "$ASKPASS_OUTPUT"
    "$GIT_ASKPASS" 'Password for https://x-access-token@github.com' >> "$ASKPASS_OUTPUT"
    ;;
  *) exit 6 ;;
esac
`;

async function runHeartbeat(script, values = {}) {
  const root = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-heartbeat-workflow-"));
  const bin = path.join(root, "bin");
  const repository = path.join(root, "repository");
  const runnerTemp = path.join(root, "runner-temp");
  const paths = {
    calls: path.join(root, "git-calls"),
    askpassSource: path.join(root, "askpass-source"),
    askpassPath: path.join(root, "askpass-path"),
    askpassOutput: path.join(root, "askpass-output")
  };
  await Promise.all([mkdir(bin), mkdir(path.join(repository, ".github"), { recursive: true }), mkdir(runnerTemp)]);
  const executable = path.join(bin, "git");
  await writeFile(executable, gitMock, { mode: 0o700 });
  try {
    const result = spawnSync("bash", ["-c", script], {
      cwd: repository,
      encoding: "utf8",
      env: {
        ...process.env,
        PATH: `${bin}:${process.env.PATH}`,
        RUNNER_TEMP: runnerTemp,
        GH_TOKEN: token,
        DEVELOP_SHA: developSha,
        MAIN_EPOCH: "0",
        DEVELOP_EPOCH: "0",
        GIT_CALLS: paths.calls,
        ASKPASS_SOURCE: paths.askpassSource,
        ASKPASS_PATH: paths.askpassPath,
        ASKPASS_OUTPUT: paths.askpassOutput,
        ...values
      }
    });
    const read = async (pathname) => readFile(pathname, "utf8").catch(() => "");
    const askpassPath = await read(paths.askpassPath);
    return {
      status: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      calls: await read(paths.calls),
      askpassSource: await read(paths.askpassSource),
      askpassOutput: await read(paths.askpassOutput),
      askpassRemoved: askpassPath ? !existsSync(askpassPath.trim()) : false
    };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

describe("heartbeat workflow shell", () => {
  it("uses the ephemeral token only for the final normal develop push without logging it", async () => {
    const result = await runHeartbeat(workflowScript(await readFile(workflowPath, "utf8")));
    expect(result.status).toBe(0);
    expect(result.calls).toContain("-c credential.helper= push origin HEAD:refs/heads/develop");
    expect(result.askpassSource).toContain('"$GH_TOKEN"');
    expect(result.askpassSource).not.toContain(token);
    expect(result.askpassOutput.startsWith("x-access-token\n")).toBe(true);
    expect(result.askpassRemoved).toBe(true);
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(token);
  });

  it.each([
    ["recent main activity", { MAIN_EPOCH: "9999999999" }, 0],
    ["recent develop activity", { DEVELOP_EPOCH: "9999999999" }, 0],
    ["missing existing develop ref", { DEVELOP_EXISTS: "false" }, "failure"],
    ["unexpected changed path", { STATUS_OUTPUT: " M unexpected.txt\\n" }, "failure"],
    ["non-fast-forward preparation", { FAIL_FAST_FORWARD: "true" }, "failure"],
    ["develop movement before push", { RACE: "true" }, "failure"]
  ])("does not push when the %s guard rejects the heartbeat", async (_label, values, expectedStatus) => {
    const result = await runHeartbeat(workflowScript(await readFile(workflowPath, "utf8")), values);
    if (expectedStatus === 0) expect(result.status).toBe(0);
    else expect(result.status).not.toBe(0);
    expect(result.calls).not.toContain("-c credential.helper= push origin HEAD:refs/heads/develop");
    expect(`${result.stdout}\n${result.stderr}`).not.toContain(token);
  });
});
