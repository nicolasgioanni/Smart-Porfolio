import { readFile, realpath } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const resultLevels = new Set(["error", "warning", "note"]);

function object(value, message) {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(message);
  return value;
}

function severity(value, message) {
  if (typeof value !== "string" || !/^\d+(?:\.\d+)?$/.test(value) || Number(value) < 0 || Number(value) > 10) {
    throw new Error(message);
  }
  return Number(value);
}

function ruleFor(result, rules) {
  if (typeof result.ruleIndex === "number") {
    if (!Number.isInteger(result.ruleIndex) || result.ruleIndex < 0 || result.ruleIndex >= rules.length) {
      throw new Error("SARIF result ruleIndex is invalid.");
    }
    return rules[result.ruleIndex];
  }
  if (typeof result.ruleId !== "string" || !result.ruleId) throw new Error("SARIF result lacks ruleId and ruleIndex.");
  const rule = rules.find((entry) => entry?.id === result.ruleId);
  if (!rule) throw new Error("SARIF result has no driver rule.");
  return rule;
}

function failureNotifications(invocations) {
  if (!Array.isArray(invocations) || invocations.length === 0) throw new Error("SARIF run invocations are missing.");
  for (const invocation of invocations) {
    object(invocation, "SARIF invocation is malformed.");
    if (invocation.executionSuccessful !== true) throw new Error("SARIF analysis execution was unsuccessful.");
    for (const notifications of [invocation.toolExecutionNotifications, invocation.toolConfigurationNotifications]) {
      if (notifications !== undefined && !Array.isArray(notifications)) throw new Error("SARIF tool notifications are malformed.");
      for (const notification of notifications ?? []) {
        object(notification, "SARIF tool notification is malformed.");
        if (notification.level === "error") {
          throw new Error("SARIF tool reported an error notification.");
        }
      }
    }
  }
}

export function parseCodeqlSarif(report) {
  object(report, "SARIF report must be an object.");
  if (report.version !== "2.1.0" || !Array.isArray(report.runs) || report.runs.length !== 1) {
    throw new Error("SARIF report must contain exactly one version 2.1.0 run.");
  }
  const run = object(report.runs[0], "SARIF run is malformed.");
  const driver = object(run.tool?.driver, "SARIF driver is missing.");
  if (driver.name !== "CodeQL" || typeof driver.semanticVersion !== "string" || !driver.semanticVersion) {
    throw new Error("SARIF driver is not an identified CodeQL analysis.");
  }
  if (!Array.isArray(driver.rules) || driver.rules.length === 0) throw new Error("SARIF driver rules are missing or empty.");
  const ruleIds = new Set();
  for (const rule of driver.rules) {
    object(rule, "SARIF driver rule is malformed.");
    if (typeof rule.id !== "string" || !rule.id || ruleIds.has(rule.id)) throw new Error("SARIF driver rules contain a missing or duplicate id.");
    ruleIds.add(rule.id);
  }
  if (!Array.isArray(run.results)) throw new Error("SARIF results are missing.");
  failureNotifications(run.invocations);

  return run.results.map((rawResult) => {
    const result = object(rawResult, "SARIF result is malformed.");
    const rule = object(ruleFor(result, driver.rules), "SARIF driver rule is malformed.");
    const level = result.level ?? rule.defaultConfiguration?.level;
    if (!resultLevels.has(level)) throw new Error("SARIF result has no valid level or default level.");
    const securitySeverity = result.properties?.["security-severity"] ?? rule.properties?.["security-severity"];
    return {
      ruleId: typeof result.ruleId === "string" && result.ruleId ? result.ruleId : rule.id,
      level,
      securitySeverity: severity(securitySeverity, "SARIF result has no valid security severity.")
    };
  });
}

export function assertNoCodeqlFindings(report) {
  const findings = parseCodeqlSarif(report);
  if (findings.length) {
    throw new Error(
      `CodeQL security policy rejected ${findings.length} finding(s).`
    );
  }
  return findings;
}

async function invokedAsCli() {
  if (!process.argv[1]) return false;
  try {
    const [entrypoint, modulePath] = await Promise.all([realpath(process.argv[1]), realpath(fileURLToPath(import.meta.url))]);
    return entrypoint === modulePath;
  } catch {
    return false;
  }
}

if (await invokedAsCli()) {
  const reportPath = process.argv[2];
  if (!reportPath || process.argv.length !== 3) {
    console.error("Usage: node scripts/security/checkSarif.mjs <codeql.sarif>");
    process.exitCode = 1;
  } else {
    try {
      assertNoCodeqlFindings(JSON.parse(await readFile(reportPath, "utf8")));
      console.log("CodeQL SARIF contains no security findings.");
    } catch {
      console.error("CodeQL SARIF gate failed without publishing scanner details.");
      process.exitCode = 1;
    }
  }
}
