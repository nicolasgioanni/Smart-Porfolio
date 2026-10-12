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

function ruleFor(result, components) {
  const reference = result.rule;
  if (reference !== undefined) object(reference, "SARIF result rule reference is malformed.");
  const component = reference?.toolComponent;
  let selected = components[0];
  if (component !== undefined) {
    object(component, "SARIF rule component reference is malformed.");
    if (component.index !== undefined) {
      if (!Number.isInteger(component.index) || component.index < 0 || component.index >= components.length - 1) throw new Error("SARIF rule component index is invalid.");
      selected = components[component.index + 1];
      if (component.name !== undefined && component.name !== selected.name) throw new Error("SARIF rule component identity is inconsistent.");
    } else {
      const matches = components.filter((entry) => entry.name === component.name);
      if (matches.length !== 1) throw new Error("SARIF rule component identity is missing or ambiguous.");
      selected = matches[0];
    }
    if (component.guid !== undefined && component.guid !== selected.guid) throw new Error("SARIF rule component GUID is inconsistent.");
  }
  const index = reference?.index ?? result.ruleIndex;
  const id = reference?.id ?? result.ruleId;
  if (reference?.id !== undefined && result.ruleId !== undefined && reference.id !== result.ruleId) throw new Error("SARIF rule identity is inconsistent.");
  let rule;
  if (index !== undefined) {
    if (!Number.isInteger(index) || index < 0 || index >= (selected.rules ?? []).length) throw new Error("SARIF result ruleIndex is invalid.");
    rule = selected.rules[index];
    if (id !== undefined && rule.id !== id) throw new Error("SARIF rule identity is inconsistent.");
  } else {
    if (typeof id !== "string" || !id) throw new Error("SARIF result lacks ruleId and ruleIndex.");
    rule = (selected.rules ?? []).find((entry) => entry.id === id);
    if (!rule) throw new Error("SARIF result has no component rule.");
  }
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
  if (!Array.isArray(driver.rules)) throw new Error("SARIF driver rules are missing.");
  if (run.tool.extensions !== undefined && !Array.isArray(run.tool.extensions)) throw new Error("SARIF extensions are malformed.");
  const components = [driver, ...(run.tool.extensions ?? [])];
  const componentNames = new Set();
  let ruleCount = 0;
  for (const component of components) {
    object(component, "SARIF component is malformed.");
    if (typeof component.name !== "string" || !component.name || componentNames.has(component.name)) throw new Error("SARIF component names are missing or duplicate.");
    componentNames.add(component.name);
    if (component.rules !== undefined && !Array.isArray(component.rules)) throw new Error("SARIF component rules are malformed.");
    const ruleIds = new Set();
    for (const rule of component.rules ?? []) {
      object(rule, "SARIF component rule is malformed.");
      if (typeof rule.id !== "string" || !rule.id || ruleIds.has(rule.id)) throw new Error("SARIF rules contain a missing or duplicate id.");
      ruleIds.add(rule.id);
      ruleCount += 1;
    }
  }
  if (ruleCount === 0) throw new Error("SARIF analyzed rules are missing or empty.");
  if (!Array.isArray(run.results)) throw new Error("SARIF results are missing.");
  failureNotifications(run.invocations);

  return run.results.map((rawResult) => {
    const result = object(rawResult, "SARIF result is malformed.");
    const rule = object(ruleFor(result, components), "SARIF driver rule is malformed.");
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
