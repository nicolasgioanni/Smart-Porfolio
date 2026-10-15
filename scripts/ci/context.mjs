import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, realpath, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseCandidate, parsePlan, positiveInteger } from "./plan.mjs";
import { parseProducer } from "./snapshot.mjs";

export function jsonEnvironment(name, environment = process.env) {
  const value = environment[name];
  if (typeof value !== "string" || value.length === 0 || value.length > 128 * 1024) throw new Error(`Missing or oversized ${name}.`);
  try { return JSON.parse(value); } catch { throw new Error(`${name} is not valid JSON.`); }
}

export function currentProducer(job, environment = process.env) {
  const number = (name) => {
    const value = environment[name];
    if (typeof value !== "string" || !/^[1-9][0-9]*$/.test(value)) throw new Error(`Missing or invalid ${name}.`);
    return positiveInteger(Number(value), name);
  };
  if (environment.GITHUB_JOB !== job) throw new Error("Current producer job differs from its declared responsibility.");
  return parseProducer({ runId: number("GITHUB_RUN_ID"), runNumber: number("GITHUB_RUN_NUMBER"),
    attempt: number("GITHUB_RUN_ATTEMPT"), job }, job);
}

export function checkedCandidate(environment = process.env, projectRoot = process.cwd()) {
  const candidate = parseCandidate(jsonEnvironment("CI_CANDIDATE", environment));
  const sha = execFileSync("git", ["rev-parse", "HEAD"], { cwd: projectRoot, encoding: "utf8", maxBuffer: 1024 }).trim();
  if (sha !== candidate.sourceSha || environment.GITHUB_SHA !== candidate.eventSha ||
      environment.GITHUB_REPOSITORY !== candidate.repository || environment.GITHUB_RUN_ID !== String(candidate.runId) ||
      environment.GITHUB_RUN_NUMBER !== String(candidate.runNumber)) throw new Error("Checkout/run identity differs from the accepted candidate.");
  return candidate;
}

export function currentPlan(environment = process.env) {
  return parsePlan(jsonEnvironment("CI_PLAN", environment));
}

export async function evidenceDirectory(environment = process.env) {
  if (!environment.RUNNER_TEMP) throw new Error("Runner temporary directory is missing.");
  const root = await realpath(environment.RUNNER_TEMP);
  const destination = path.join(root, "portfolio-ci");
  await mkdir(destination, { mode: 0o700 });
  return destination;
}

export async function writeRecord(directory, name, record) {
  if (!/^[a-z][a-z0-9-]*\.json$/.test(name)) throw new Error("Unsupported evidence filename.");
  await writeFile(path.join(directory, name), `${JSON.stringify(record, null, 2)}\n`, { flag: "wx", mode: 0o600 });
}

export async function digestFile(filename) {
  return createHash("sha256").update(await readFile(filename)).digest("hex");
}
