import { applicationJobs, chromiumShards, securityJobs } from "./plan.mjs";

export const gateDependencies = Object.freeze([
  "resolve-candidate", "prepare-content", ...securityJobs, "dependency-review", ...applicationJobs
]);
const auxiliaryJobs = ["verify", "deploy", "heartbeat"];
const sorted = (values) => [...values].sort().join(",");
const needs = (job) => typeof job?.needs === "string" ? [job.needs] : Array.isArray(job?.needs) ? job.needs : [];
const deployEligibilityTerms = Object.freeze([
  "!cancelled()",
  "github.event_name != 'pull_request'",
  "needs.verify.result == 'success'",
  "needs.verify.outputs.deploy == 'true'"
]);

function stepIndex(steps, predicate) {
  return Array.isArray(steps) ? steps.findIndex(predicate) : -1;
}

function builtOutputScanProblems(job) {
  const steps = job?.steps;
  const install = stepIndex(steps, (step) => step?.name === "Install checksum-verified built-output scanner" &&
    typeof step.run === "string" && /scripts\/security\/installPinnedTool\.mjs\s+gitleaks\s+/.test(step.run));
  const build = stepIndex(steps, (step) => step?.name === "Build once and seal the full candidate" &&
    step.run === "node scripts/ci/run.mjs build" &&
    step.env?.CI_GITLEAKS === "${{ runner.temp }}/smart-portfolio-tools/gitleaks/gitleaks");
  const receipt = stepIndex(steps, (step) => step?.name === "Upload immutable built-output scanner receipt" &&
    typeof step.uses === "string" && step.uses.startsWith("actions/upload-artifact@") &&
    step.with?.name === "${{ steps.evidence.outputs.scan_receipt_name }}" &&
    step.with?.path === "${{ steps.evidence.outputs.scan_receipt_path }}" &&
    step.with?.["if-no-files-found"] === "error");
  const release = stepIndex(steps, (step) => step?.name === "Upload immutable release" &&
    typeof step.uses === "string" && step.uses.startsWith("actions/upload-artifact@"));
  if ([install, build, receipt, release].some((index) => index < 0)) {
    return ["build-and-package must install, run, record, and upload the sealed-output Gitleaks admission."];
  }
  if (!(install < build && build < receipt && receipt < release)) {
    return ["The sealed-output Gitleaks receipt must be emitted before release upload."];
  }
  return [];
}

function deployEligibilityProblems(value) {
  if (typeof value !== "string") return ["Deployment must have an explicit eligibility expression."];
  const expression = value.trim().match(/^\$\{\{\s*([\s\S]*?)\s*\}\}$/)?.[1];
  if (!expression) return ["Deployment must have an explicit GitHub Actions eligibility expression."];

  const problems = [];
  if (expression.includes("||")) problems.push("Deployment eligibility must not use an OR bypass.");
  if (/\balways\s*\(/.test(expression)) problems.push("Deployment eligibility must not use always().");
  const terms = expression.split(/\s*&&\s*/).map((term) => term.trim()).filter(Boolean);
  const labels = new Map([
    ["!cancelled()", "block cancellation"],
    ["github.event_name != 'pull_request'", "exclude pull requests"],
    ["needs.verify.result == 'success'", "require explicit verify success"],
    ["needs.verify.outputs.deploy == 'true'", "require the exact deploy output"]
  ]);
  for (const [term, label] of labels) {
    const occurrences = terms.filter((candidate) => candidate === term).length;
    if (occurrences === 0) problems.push(`Deployment eligibility must ${label}.`);
    if (occurrences > 1) problems.push(`Deployment eligibility must contain ${term} exactly once.`);
  }
  const unexpected = terms.filter((term) => !deployEligibilityTerms.includes(term));
  if (unexpected.length) problems.push("Deployment eligibility contains an unapproved bypass or substitute.");
  return problems;
}

export function workflowEvents(value) {
  const events = typeof value === "string" ? [value] : Array.isArray(value) ? value :
    value && typeof value === "object" ? Object.keys(value) : [];
  if (events.length === 0 || events.some((event) => typeof event !== "string" || !event) || new Set(events).size !== events.length) throw new Error("Workflow events are malformed.");
  return events;
}

// Consume parsed YAML. This enforces responsibilities and graph edges. Only
// the sealed-output scan has an ordering contract; other setup remains free.
export function validateWorkflowGraph(workflow) {
  const problems = [];
  if (workflow?.name !== "CI") problems.push("Preserve the CI workflow identity.");
  const jobs = workflow?.jobs;
  if (!jobs || typeof jobs !== "object" || Array.isArray(jobs)) throw new Error("Workflow jobs are missing.");
  if (sorted(Object.keys(jobs)) !== sorted([...gateDependencies, ...auxiliaryJobs])) problems.push("Every validation job must be registered in the gate contract; auxiliary jobs are explicit.");
  if (jobs.verify?.name !== "verify") problems.push("Preserve the verify check identity.");
  if (sorted(needs(jobs.verify)) !== sorted(gateDependencies)) problems.push("verify must directly depend on every required validator and producer.");
  if (!/^\s*(?:\$\{\{\s*)?always\(\)(?:\s*\}\})?\s*$/.test(jobs.verify?.if ?? "")) problems.push("Only complete lightweight result evaluation may define verify acceptance.");
  if (!needs(jobs["prepare-content"]).includes("resolve-candidate")) problems.push("Content preparation must consume the resolved candidate.");
  for (const name of [...securityJobs, "dependency-review"]) {
    if (sorted(needs(jobs[name])) !== "resolve-candidate") problems.push(`${name} must run independently after candidate resolution.`);
  }
  for (const name of applicationJobs) {
    const dependencies = needs(jobs[name]);
    if (!dependencies.includes("prepare-content") || !dependencies.includes("resolve-candidate")) problems.push(`${name} must consume the exact candidate and snapshot.`);
    if (name === "export-check") {
      if (!dependencies.includes("build-and-package")) problems.push("Export checks must consume the built candidate.");
    } else if (dependencies.some((dependency) => applicationJobs.includes(dependency))) {
      problems.push(`${name} must not serialize independent validators or builds.`);
    }
  }
  problems.push(...builtOutputScanProblems(jobs["build-and-package"]));
  if (!needs(jobs.deploy).includes("verify")) problems.push("Deployment must depend on verify.");
  problems.push(...deployEligibilityProblems(jobs.deploy?.if));
  if (jobs.deploy?.concurrency?.["cancel-in-progress"] !== false) problems.push("An active deployment must never be interrupted by concurrency.");
  const parentCancellation = workflow.concurrency?.["cancel-in-progress"];
  const prCancellation = typeof parentCancellation === "string" && /^\s*\$\{\{\s*github\.event_name\s*==\s*'pull_request'\s*\}\}\s*$/.test(parentCancellation);
  if (parentCancellation !== undefined && parentCancellation !== false && !prCancellation) problems.push("Trusted parent workflows must not cancel active deployment.");
  if (needs(jobs.heartbeat).length !== 0) problems.push("Heartbeat maintenance must remain independent of release acceptance.");
  const browser = jobs["browser-e2e"];
  if (sorted(browser?.strategy?.matrix?.shard ?? []) !== sorted(chromiumShards) || browser?.strategy?.["fail-fast"] !== false) problems.push("Chromium requires both native shards with fail-fast disabled.");
  const events = workflowEvents(workflow.on);
  const allowedEvents = ["push", "pull_request", "schedule", "workflow_dispatch"];
  if (events.some((event) => !allowedEvents.includes(event))) problems.push("Unreviewed event or cross-workflow acceptance trigger.");
  if (allowedEvents.some((event) => !events.includes(event))) problems.push("Every reviewed event must retain its validation contract.");
  for (const [name, job] of Object.entries(jobs)) {
    if (job?.["continue-on-error"]) problems.push(`${name} must not suppress a failed job.`);
    if (job?.secrets === "inherit") problems.push(`${name} must not inherit broad secrets.`);
    if (name !== "deploy" && name !== "heartbeat" && job?.environment) problems.push(`${name} must not enter a protected deployment environment.`);
  }
  if (problems.length) throw new Error(`CI graph contract failed:\n${problems.join("\n")}`);
  return true;
}
