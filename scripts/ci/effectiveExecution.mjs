import { parseCandidate, positiveInteger } from "./plan.mjs";

// GitHub Actions exposes copied job records under a consumer rerun's attempt
// number. Keep the history bounded: a deeper rerun chain must be restarted so
// the gate never makes an unbounded sequence of credentialed API reads.
export const maximumAttemptHistory = 20;

const timestampExpression = /^(\d{4})-(\d\d)-(\d\d)T(\d\d):(\d\d):(\d\d)(?:\.\d+)?Z$/;

function timestamp(value, label) {
  const match = typeof value === "string" ? timestampExpression.exec(value) : null;
  if (!match) {
    throw new Error(`${label} is missing or malformed.`);
  }
  const parsed = Date.parse(value);
  const date = new Date(parsed);
  if (!Number.isFinite(parsed) || date.getUTCFullYear() !== Number(match[1]) ||
      date.getUTCMonth() + 1 !== Number(match[2]) || date.getUTCDate() !== Number(match[3]) ||
      date.getUTCHours() !== Number(match[4]) || date.getUTCMinutes() !== Number(match[5]) ||
      date.getUTCSeconds() !== Number(match[6])) {
    throw new Error(`${label} is missing or malformed.`);
  }
  return parsed;
}

function attemptRange(startAttempt, currentAttempt) {
  positiveInteger(startAttempt, "History start attempt");
  positiveInteger(currentAttempt, "Current run attempt");
  if (currentAttempt < startAttempt) throw new Error("Current run attempt predates the accepted candidate.");
  const length = currentAttempt - startAttempt + 1;
  if (length > maximumAttemptHistory) {
    throw new Error(`Rerun history exceeds the ${maximumAttemptHistory}-attempt evidence limit. Perform a full affected rerun.`);
  }
  return Array.from({ length }, (_, index) => startAttempt + index);
}

function runRecord(value, candidate, attempt) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      value.id !== candidate.runId || value.run_number !== candidate.runNumber ||
      value.event !== candidate.event || value.head_sha !== candidate.runHeadSha ||
      value.path !== ".github/workflows/ci.yml" || value.run_attempt !== attempt) {
    throw new Error("GitHub rerun metadata does not match the accepted candidate.");
  }
  return { value, startedAt: timestamp(value.run_started_at, `Attempt ${attempt} start`) };
}

function jobRecord(value, candidate, attempt) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      !Number.isSafeInteger(value.id) || value.id < 1 || value.run_id !== candidate.runId ||
      value.run_attempt !== attempt || typeof value.name !== "string" || !value.name || value.name.length > 100 ||
      value.status !== "completed" || typeof value.conclusion !== "string" ||
      !Array.isArray(value.steps) || value.steps.length > 100) {
    throw new Error("GitHub job execution is incomplete or malformed.");
  }
  const startedAt = timestamp(value.started_at, `Job ${value.name} start`);
  const completedAt = timestamp(value.completed_at, `Job ${value.name} completion`);
  if (completedAt < startedAt) throw new Error("GitHub job execution has an invalid time range.");
  let previousNumber = 0;
  const steps = value.steps.map((step, index) => {
    if (!step || typeof step !== "object" || Array.isArray(step) ||
        !Number.isSafeInteger(step.number) || step.number <= previousNumber || typeof step.name !== "string" || !step.name || step.name.length > 200 ||
        typeof step.status !== "string" || typeof step.conclusion !== "string") {
      throw new Error("GitHub job step evidence is malformed.");
    }
    const skippedWithoutTimes = step.status === "completed" && step.conclusion === "skipped" &&
      [step.started_at, step.completed_at].every((time) => time === undefined || time === null);
    if (!skippedWithoutTimes) {
      const stepStartedAt = timestamp(step.started_at, `Job ${value.name} step ${index + 1} start`);
      const stepCompletedAt = timestamp(step.completed_at, `Job ${value.name} step ${index + 1} completion`);
      if (stepCompletedAt < stepStartedAt) throw new Error("GitHub job step evidence has an invalid time range.");
    }
    previousNumber = step.number;
    return {
      number: step.number,
      name: step.name,
      status: step.status,
      conclusion: step.conclusion,
      started_at: step.started_at,
      completed_at: step.completed_at
    };
  });
  return {
    attempt,
    name: value.name,
    job: value,
    startedAt,
    completedAt,
    fingerprint: JSON.stringify({
      name: value.name,
      status: value.status,
      conclusion: value.conclusion,
      started_at: value.started_at,
      completed_at: value.completed_at,
      steps
    })
  };
}

// Fetch only attempt metadata. Job rows always come from the one complete
// filter=all collection, so copied records and their originals are compared
// within one bounded provider response set.
export async function collectAttemptHistory({ candidate: candidateValue, currentAttempt, startAttempt,
  currentRun, readAttempt, options }) {
  const candidate = parseCandidate(candidateValue);
  const attempts = attemptRange(startAttempt, currentAttempt);
  const current = runRecord(currentRun, candidate, currentAttempt);
  if (attempts.length === 1) return [{ attempt: currentAttempt, run: current.value }];
  if (typeof readAttempt !== "function") throw new Error("GitHub rerun metadata reader is unavailable.");
  const previous = await Promise.all(attempts.slice(0, -1).map(async (attempt) => ({
    attempt,
    run: await readAttempt(candidate, attempt, options)
  })));
  return [...previous, { attempt: currentAttempt, run: current.value }];
}

// Reduce relabelled job records to the physical execution that produced their
// timestamps and ordered steps. Only requested logical jobs are admitted; the
// aggregate, deployment, heartbeat, and intentionally skipped jobs stay out
// of this execution-evidence boundary.
export function normalizeEffectiveExecutions({ candidate: candidateValue, currentAttempt, startAttempt,
  attempts, jobs, names, requireCurrent = true }) {
  const candidate = parseCandidate(candidateValue);
  const expectedAttempts = attemptRange(startAttempt, currentAttempt);
  if (!Array.isArray(attempts) || !Array.isArray(jobs) || !Array.isArray(names) ||
      names.length === 0 || new Set(names).size !== names.length ||
      names.some((name) => typeof name !== "string" || !name || name.length > 100)) {
    throw new Error("Rerun execution evidence is malformed.");
  }

  const attemptMetadata = new Map();
  for (const entry of attempts) {
    if (!entry || typeof entry !== "object" || !Number.isSafeInteger(entry.attempt) ||
        !expectedAttempts.includes(entry.attempt) || attemptMetadata.has(entry.attempt)) {
      throw new Error("Rerun attempt metadata is missing or ambiguous.");
    }
    attemptMetadata.set(entry.attempt, runRecord(entry.run, candidate, entry.attempt));
  }
  if (attemptMetadata.size !== expectedAttempts.length) throw new Error("Rerun attempt metadata is incomplete.");
  for (const [index, attempt] of expectedAttempts.entries()) {
    if (index > 0 && attemptMetadata.get(attempt).startedAt <= attemptMetadata.get(expectedAttempts[index - 1]).startedAt) {
      throw new Error("Rerun attempt windows are not strictly ordered.");
    }
  }

  const nameSet = new Set(names);
  const records = new Map(), jobIds = new Set();
  for (const value of jobs) {
    if (!nameSet.has(value?.name)) continue;
    if (value.run_id !== candidate.runId || !Number.isSafeInteger(value.run_attempt) || value.run_attempt < 1 ||
        value.run_attempt > currentAttempt) throw new Error("GitHub job evidence has an invalid run identity.");
    if (value.run_attempt < startAttempt) continue;
    if (jobIds.has(value.id)) throw new Error("GitHub job evidence contains duplicate IDs.");
    jobIds.add(value.id);
    const record = jobRecord(value, candidate, value.run_attempt);
    const key = `${record.attempt}\u0000${record.name}`;
    if (records.has(key)) throw new Error("GitHub job evidence contains ambiguous same-name executions.");
    records.set(key, record);
  }

  const resolving = new Set(), resolved = new Map();
  const resolve = (record) => {
    const key = `${record.attempt}\u0000${record.name}`;
    if (resolved.has(key)) return resolved.get(key);
    if (resolving.has(key)) throw new Error("Copied GitHub job evidence contains a cycle.");
    resolving.add(key);
    const window = attemptMetadata.get(record.attempt);
    const nextAttempt = expectedAttempts[expectedAttempts.indexOf(record.attempt) + 1];
    const nextWindow = nextAttempt ? attemptMetadata.get(nextAttempt) : null;
    let value;
    if (record.startedAt >= window.startedAt) {
      if ((nextWindow && (record.startedAt >= nextWindow.startedAt || record.completedAt > nextWindow.startedAt))) {
        throw new Error("GitHub job execution falls outside its attempt window.");
      }
      value = { name: record.name, attempt: record.attempt, job: record.job, currentJob: null, copied: false };
    } else {
      if (record.completedAt > window.startedAt) throw new Error("Copied GitHub job execution crosses its attempt window.");
      const origins = new Map();
      for (const candidateRecord of records.values()) {
        if (candidateRecord.name !== record.name || candidateRecord.attempt >= record.attempt ||
            candidateRecord.fingerprint !== record.fingerprint) continue;
        const origin = resolve(candidateRecord);
        origins.set(`${origin.attempt}\u0000${origin.name}`, origin);
      }
      if (origins.size !== 1) throw new Error("Copied GitHub job execution has no unique physical origin.");
      const origin = [...origins.values()][0];
      value = { ...origin, currentJob: record.job, copied: true };
    }
    resolving.delete(key);
    resolved.set(key, value);
    return value;
  };

  const current = new Map();
  for (const name of names) {
    const currentRecord = records.get(`${currentAttempt}\u0000${name}`);
    if (!currentRecord) {
      if (requireCurrent) throw new Error("Current rerun job evidence is missing.");
      continue;
    }
    current.set(name, resolve(currentRecord));
  }
  for (const record of records.values()) resolve(record);
  for (const [name, execution] of current) {
    const latestPhysicalAttempt = Math.max(...[...records.values()]
      .filter((record) => record.name === name && resolved.get(`${record.attempt}\u0000${record.name}`).copied === false)
      .map((record) => record.attempt));
    if (execution.attempt !== latestPhysicalAttempt) {
      throw new Error("Current GitHub job evidence does not select the latest physical execution.");
    }
  }
  const physical = [...records.values()]
    .filter((record) => resolved.get(`${record.attempt}\u0000${record.name}`).copied === false)
    .map((record) => ({ name: record.name, attempt: record.attempt, job: record.job }))
    .sort((left, right) => left.attempt - right.attempt || left.name.localeCompare(right.name));
  return {
    current,
    jobs: [...current.values()].map(({ job }) => job),
    physical
  };
}
