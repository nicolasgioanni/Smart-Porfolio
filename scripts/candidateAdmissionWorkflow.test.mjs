// @vitest-environment node
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const projectRoot = path.resolve(import.meta.dirname, "..");
const workflowPath = path.join(projectRoot, ".github", "workflows", "ci.yml");
const repository = "nicolasgioanni/Smart-Porfolio";
const workflowPathname = ".github/workflows/ci.yml";
const sha = (character) => character.repeat(40);

function workflowScript(source) {
  const start = source.indexOf("      - name: Reject ineligible events and untrusted workflow references before checkout");
  const end = source.indexOf("\n  candidate-precheck:", start);
  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);
  const step = source.slice(start, end);
  const marker = "        run: |\n";
  const body = step.slice(step.indexOf(marker) + marker.length).replace(/\n+$/, "");
  return body.split("\n").map((line) => line ? line.slice(10) : "").join("\n");
}

async function runAdmission(script, { eventName, eventRef, eventBaseRef = "", eventSha = sha("a"), workflowSha = eventSha }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-admission-"));
  const output = path.join(directory, "output");
  await writeFile(output, "", "utf8");
  try {
    const result = spawnSync("bash", ["-c", script], {
      cwd: directory,
      encoding: "utf8",
      env: {
        ...process.env,
        EVENT_NAME: eventName,
        EVENT_REF: eventRef,
        EVENT_SHA: eventSha,
        EVENT_BASE_REF: eventBaseRef,
        WORKFLOW_REF: `${repository}/${workflowPathname}@${eventRef}`,
        WORKFLOW_SHA: workflowSha,
        REPOSITORY: repository,
        GITHUB_OUTPUT: output
      }
    });
    return { ...result, output: await readFile(output, "utf8") };
  } finally {
    await rm(directory, { recursive: true, force: true });
  }
}

describe("candidate-admission workflow shell", () => {
  it("executes every eligible event form before checkout", async () => {
    const script = workflowScript(await readFile(workflowPath, "utf8"));
    for (const input of [
      { eventName: "pull_request", eventRef: "refs/pull/42/merge", eventBaseRef: "main", workflowSha: sha("b") },
      { eventName: "push", eventRef: "refs/heads/develop" },
      { eventName: "schedule", eventRef: "refs/heads/main" },
      { eventName: "workflow_dispatch", eventRef: "refs/heads/main" }
    ]) {
      const result = await runAdmission(script, input);
      expect(result.status).toBe(0);
      expect(result.stderr).not.toContain("unbound variable");
      expect(result.output).toBe(`candidate_sha=${sha("a")}\n`);
    }
  });

  it("rejects substituted repository, workflow, reference, and trusted revisions", async () => {
    const script = workflowScript(await readFile(workflowPath, "utf8"));
    const result = await runAdmission(script, {
      eventName: "push",
      eventRef: "refs/heads/main",
      workflowSha: sha("b")
    });
    expect(result.status).not.toBe(0);
    expect(result.output).toBe("");
  });
});
