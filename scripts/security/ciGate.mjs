import { fileURLToPath } from "node:url";

const success = "success";
const baseJobs = ["candidate-admission", "candidate-precheck", "application-validation", "security-tools", "security-scans", "codeql"];
const supportedEvents = new Set(["pull_request", "push", "schedule", "workflow_dispatch"]);

export function requiredJobsForEvent(eventName) {
  if (!supportedEvents.has(eventName)) throw new Error("CI event is not declared by the stable workflow.");
  const jobs = [...baseJobs];
  if (eventName === "pull_request") jobs.push("dependency-review");
  return jobs;
}

function outcomeFor(results, job) {
  const result = results?.[job];
  if (!result || typeof result !== "object" || Array.isArray(result)) return "missing";
  return typeof result.result === "string" ? result.result : "missing";
}

export function evaluateCiGate({ eventName, results }) {
  if (!results || typeof results !== "object" || Array.isArray(results)) {
    throw new Error("CI gate results must be a job-result object.");
  }
  const expected = requiredJobsForEvent(eventName);
  const failures = expected
    .map((job) => ({ job, outcome: outcomeFor(results, job) }))
    .filter(({ outcome }) => outcome !== success);
  return {
    accepted: failures.length === 0,
    expected,
    failures
  };
}

export function assertCiGate(input) {
  const decision = evaluateCiGate(input);
  if (!decision.accepted) {
    throw new Error(
      `CI gate rejected required job results: ${decision.failures
        .map(({ job, outcome }) => `${job}=${outcome}`)
        .join(", ")}`
    );
  }
  return decision;
}

function parseCli(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || values.has(key)) {
      throw new Error("Usage: node scripts/security/ciGate.mjs --event <event> --results <needs-json>");
    }
    values.set(key, value);
  }
  if (values.size !== 2 || !values.has("--event") || !values.has("--results")) {
    throw new Error("Usage: node scripts/security/ciGate.mjs --event <event> --results <needs-json>");
  }
  let results;
  try {
    results = JSON.parse(values.get("--results"));
  } catch {
    throw new Error("CI gate needs JSON is malformed.");
  }
  return { eventName: values.get("--event"), results };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const decision = assertCiGate(parseCli(process.argv.slice(2)));
    console.log(`CI gate accepted: ${decision.expected.join(", ")}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
