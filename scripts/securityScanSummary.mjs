import { access, appendFile, readFile, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const scanLanes = [
  "npm-audit-full",
  "npm-audit-production",
  "dependency-review",
  "gitleaks",
  "codeql",
  "actionlint",
  "zizmor",
  "terraform-validate",
  "trivy-config"
];

const allowedNotApplicableReasons = new Map([
  ["dependency-review", "not-a-pull-request"],
  ["terraform-validate", "no-terraform-targets"],
  ["trivy-config", "no-config-targets"]
]);

const laneIdentities = new Map([
  ["npm-audit-full", { tool: "npm", version: "10.9.9" }],
  ["npm-audit-production", { tool: "npm", version: "10.9.9" }],
  ["dependency-review", { tool: "dependency-review-action", version: "5.0.0" }],
  ["gitleaks", { tool: "gitleaks", version: "8.30.1" }],
  ["codeql", { tool: "codeql", version: "2.27.1" }],
  ["actionlint", { tool: "actionlint", version: "1.7.12" }],
  ["zizmor", { tool: "zizmor", version: "1.30.1" }],
  ["terraform-validate", { tool: "terraform", version: "1.16.5" }],
  ["trivy-config", { tool: "trivy", version: "0.75.0" }]
]);

const forbiddenToolNativeSuppressionFiles = [
  ".gitleaks.toml",
  "gitleaks.toml",
  ".gitleaksignore",
  ".trivyignore",
  ".trivy.yaml",
  ".trivy.yml",
  "trivy.yaml",
  "trivy.yml",
  ".zizmor.yml",
  "zizmor.yml",
  ".github/dependency-review-config.yml",
  ".github/dependency-review-config.yaml",
  ".github/codeql-config.yml",
  ".github/codeql-config.yaml",
  ".actionlint.yaml",
  ".actionlint.yml",
  "actionlint.yaml",
  "actionlint.yml",
  ".github/actionlint.yaml",
  ".github/actionlint.yml"
];

const trivyTargetPathspecs = [
  "*.tf",
  "*.tf.json",
  ":(glob)**/Dockerfile",
  ":(glob)**/Dockerfile.*",
  ":(glob)**/docker-compose.yml",
  ":(glob)**/docker-compose.yaml",
  ":(glob)**/docker-compose.*.yml",
  ":(glob)**/docker-compose.*.yaml",
  ":(glob)**/compose.yml",
  ":(glob)**/compose.yaml"
];

const execFileAsync = promisify(execFile);

function isNonNegativeInteger(value) {
  return Number.isInteger(value) && value >= 0;
}

function safeError() {
  return "scanner report could not be normalized";
}

function parseJson(source) {
  try {
    return JSON.parse(source);
  } catch {
    throw new Error(safeError());
  }
}

function requiredIdentity(lane) {
  const identity = laneIdentities.get(lane);
  if (!identity) throw new Error("security scan lane is not recognized");
  return identity;
}

export function scanIdentityForLane(lane) {
  return { ...requiredIdentity(lane) };
}

function errorSummary(lane) {
  const { tool, version } = requiredIdentity(lane);
  return createScanSummary({
    lane,
    tool,
    version,
    targetCount: 0,
    findings: 0,
    status: "error"
  });
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizedTarget(value) {
  if (typeof value !== "string" || !value.trim() || value.includes("\\")) {
    throw new Error(safeError());
  }
  let target = value;
  if (target === "./") target = ".";
  else if (target.startsWith("./")) target = target.slice(2);
  if (
    target.startsWith("/") ||
    !target ||
    (target !== "." && target.split("/").some((segment) => !segment || segment === "." || segment === ".."))
  ) {
    throw new Error(safeError());
  }
  return target;
}

function allowedExitCodes(lane) {
  if (lane === "npm-audit-full" || lane === "npm-audit-production" || lane === "actionlint") {
    return new Set([0, 1]);
  }
  if (lane === "zizmor") {
    return new Set([0]);
  }
  return new Set([0]);
}

function isValidTrivySummary(summary) {
  return (
    isObject(summary) &&
    isNonNegativeInteger(summary.Successes) &&
    isNonNegativeInteger(summary.Failures) &&
    summary.Successes + summary.Failures > 0
  );
}

function isTrivyExpectedTarget(value) {
  return (
    isObject(value) &&
    typeof value.kind === "string" &&
    typeof value.path === "string" &&
    ["terraform-module", "file"].includes(value.kind)
  );
}

function findingCountForReport(lane, source, expectedTargetCount) {
  if (lane === "actionlint") {
    if (!Number.isInteger(expectedTargetCount) || expectedTargetCount < 1) {
      throw new Error(safeError());
    }
    const report = parseJson(source);
    if (!Array.isArray(report) || report.some((finding) => !isObject(finding))) {
      throw new Error(safeError());
    }
    return { findings: report.length, targetCount: expectedTargetCount };
  }

  const report = parseJson(source);
  if (lane === "npm-audit-full" || lane === "npm-audit-production") {
    if (report?.auditReportVersion !== 2 || !isObject(report?.metadata?.vulnerabilities)) {
      throw new Error(safeError());
    }
    const findings = report?.metadata?.vulnerabilities?.total;
    if (!isNonNegativeInteger(findings)) throw new Error(safeError());
    return { findings, targetCount: 1 };
  }
  if (lane === "gitleaks") {
    if (!Array.isArray(report) || report.some((finding) => !isObject(finding))) throw new Error(safeError());
    return { findings: report.length, targetCount: 1 };
  }
  if (lane === "zizmor") {
    const entries = Array.isArray(report)
      ? report
      : Array.isArray(report?.findings)
        ? report.findings
        : undefined;
    const findings = entries?.length;
    if (
      !entries?.every(isObject) ||
      !isNonNegativeInteger(findings) ||
      !Number.isInteger(expectedTargetCount) ||
      expectedTargetCount < 1
    ) {
      throw new Error(safeError());
    }
    return { findings, targetCount: expectedTargetCount };
  }
  if (lane === "codeql") {
    if (report?.version !== "2.1.0" || !Array.isArray(report?.runs) || report.runs.length === 0) {
      throw new Error(safeError());
    }
    const findings = report.runs.reduce((total, run) => {
      const driver = run?.tool?.driver;
      const extensions = run?.tool?.extensions;
      if (
        driver?.name !== "CodeQL command-line toolchain" ||
        driver?.organization !== "GitHub" ||
        driver?.version !== "2.27.1" ||
        !Array.isArray(extensions) ||
        extensions.some((extension) => !isObject(extension)) ||
        !Array.isArray(run?.results)
      ) {
        throw new Error(safeError());
      }
      const components = [driver, ...extensions];
      const ruleIds = new Set();
      let extensionRuleCount = 0;
      for (const component of components) {
        if (component.rules === undefined) continue;
        if (
          !Array.isArray(component.rules) ||
          component.rules.some((rule) => !isObject(rule) || typeof rule.id !== "string" || !rule.id)
        ) {
          throw new Error(safeError());
        }
        for (const rule of component.rules) {
          if (ruleIds.has(rule.id)) throw new Error(safeError());
          ruleIds.add(rule.id);
          if (component !== driver) extensionRuleCount += 1;
        }
      }
      if (ruleIds.size === 0 || extensionRuleCount === 0) throw new Error(safeError());
      if (driver.notifications !== undefined && (
        !Array.isArray(driver.notifications) ||
        driver.notifications.some((notification) =>
          !isObject(notification) || typeof notification.id !== "string" || !notification.id
        )
      )) {
        throw new Error(safeError());
      }
      if (run.invocations !== undefined && (
        !Array.isArray(run.invocations) ||
        run.invocations.some((invocation) => {
          if (!isObject(invocation) || invocation.executionSuccessful !== true) return true;
          for (const notificationField of ["toolExecutionNotifications", "toolConfigurationNotifications"]) {
            const notifications = invocation[notificationField];
            if (
              notifications !== undefined &&
              (!Array.isArray(notifications) || notifications.some((notification) =>
                !isObject(notification) || notification.level === "error"
              ))
            ) {
              return true;
            }
          }
          return false;
        })
      )) {
        throw new Error(safeError());
      }
      for (const result of run.results) {
        if (
          !isObject(result) ||
          typeof result.ruleId !== "string" ||
          !ruleIds.has(result.ruleId)
        ) {
          throw new Error(safeError());
        }
        if (
          result.suppressions !== undefined &&
          (!Array.isArray(result.suppressions) ||
            result.suppressions.some(
              (suppression) => !isObject(suppression) || typeof suppression.kind !== "string"
            ))
        ) {
          throw new Error(safeError());
        }
      }
      return total + run.results.length;
    }, 0);
    return { findings, targetCount: report.runs.length };
  }
  if (lane === "terraform-validate") {
    if (!Array.isArray(report?.roots)) throw new Error(safeError());
    for (const root of report.roots) {
      if (
        root?.initExitCode !== 0 ||
        root?.validation?.valid !== true ||
        root?.validation?.error_count !== 0
      ) {
        throw new Error(safeError());
      }
    }
    return { findings: 0, targetCount: report.roots.length };
  }
  if (lane === "trivy-config") {
    if (
      !Array.isArray(report?.expectedTargets) ||
      !isObject(report?.scan) ||
      report.scan?.SchemaVersion !== 2 ||
      report.scan?.Trivy?.Version !== "0.75.0" ||
      report.scan?.ArtifactType !== "filesystem" ||
      !Array.isArray(report.scan.Results)
    ) {
      throw new Error(safeError());
    }
    const expectedTargets = report.expectedTargets.map((target) => {
      if (!isTrivyExpectedTarget(target)) throw new Error(safeError());
      return { kind: target.kind, path: normalizedTarget(target.path) };
    });
    const expectedKeys = new Set(expectedTargets.map((target) => target.kind + ":" + target.path));
    if (expectedKeys.size !== expectedTargets.length) throw new Error(safeError());

    const results = report.scan.Results;
    const coverage = new Set();
    let findings = 0;
    for (const result of results) {
      if (
        !isObject(result) ||
        result.Class !== "config" ||
        typeof result.Type !== "string" ||
        !isValidTrivySummary(result.MisconfSummary)
      ) {
        throw new Error(safeError());
      }
      const targetPath = normalizedTarget(result.Target);
      const listedMisconfigurations = result.Misconfigurations ?? [];
      if (!Array.isArray(listedMisconfigurations) || listedMisconfigurations.some((finding) => !isObject(finding))) {
        throw new Error(safeError());
      }
      if (result.MisconfSummary.Failures !== listedMisconfigurations.length) {
        throw new Error(safeError());
      }
      findings += listedMisconfigurations.length;
      for (const expected of expectedTargets) {
        const typeMatches = expected.kind === "terraform-module"
          ? result.Type === "terraform"
          : result.Type === (expected.path.split("/").pop()?.startsWith("Dockerfile") ? "dockerfile" : "docker-compose");
        if (typeMatches && targetPath === expected.path) {
          coverage.add(expected.kind + ":" + expected.path);
        }
      }
    }
    for (const expectedKey of expectedKeys) {
      if (!coverage.has(expectedKey)) throw new Error(safeError());
    }
    return { findings, targetCount: expectedTargets.length };
  }

  throw new Error(safeError());
}

export function createScanSummary({
  lane,
  tool,
  version,
  targetCount,
  findings,
  status,
  reason
}) {
  const identity = requiredIdentity(lane);
  if (tool !== identity.tool) throw new Error("security scan tool does not match its lane");
  if (version !== identity.version) throw new Error("security scan version does not match its lane");
  if (!isNonNegativeInteger(targetCount) || !isNonNegativeInteger(findings)) {
    throw new Error("security scan counts must be non-negative integers");
  }
  if (!new Set(["clean", "findings", "not-applicable", "error"]).has(status)) {
    throw new Error("security scan status is invalid");
  }
  if (status === "not-applicable") {
    if (allowedNotApplicableReasons.get(lane) !== reason || targetCount !== 0 || findings !== 0) {
      throw new Error("security scan not-applicable status is not approved");
    }
  } else if (reason !== undefined) {
    throw new Error("security scan reason is only allowed for not-applicable status");
  }
  if ((status === "clean" || status === "findings") && targetCount === 0) {
    throw new Error("successful security scan summaries must cover at least one target");
  }
  if (status === "clean" && findings !== 0) {
    throw new Error("clean security scan summaries cannot contain findings");
  }
  if (status === "findings" && findings === 0) {
    throw new Error("finding security scan summaries must contain findings");
  }

  return {
    schemaVersion: 1,
    lane,
    tool,
    version,
    targetCount,
    findings,
    status,
    ...(reason ? { reason } : {})
  };
}

export function summarizeReport({
  lane,
  tool,
  version,
  exitCode,
  source,
  reportExists = true,
  expectedTargetCount
}) {
  try {
    const identity = requiredIdentity(lane);
    if (
      tool !== identity.tool ||
      version !== identity.version ||
      !reportExists ||
      !Number.isInteger(exitCode) ||
      !allowedExitCodes(lane).has(exitCode)
    ) {
      return errorSummary(lane);
    }

    const { findings, targetCount } = findingCountForReport(
      lane,
      source,
      expectedTargetCount
    );
    if (exitCode !== 0 && findings === 0) return errorSummary(lane);

    if (lane === "terraform-validate" && targetCount === 0) {
      return createScanSummary({
        lane,
        tool,
        version,
        targetCount,
        findings,
        status: "not-applicable",
        reason: "no-terraform-targets"
      });
    }
    if (lane === "trivy-config" && targetCount === 0) {
      return createScanSummary({
        lane,
        tool,
        version,
        targetCount,
        findings,
        status: "not-applicable",
        reason: "no-config-targets"
      });
    }

    return createScanSummary({
      lane,
      tool,
      version,
      targetCount,
      findings,
      status: findings > 0 ? "findings" : "clean"
    });
  } catch {
    return errorSummary(lane);
  }
}

export function validateSuppressionConfiguration(
  configuration,
  now = new Date(),
  nativeSuppressionPaths = []
) {
  const errors = [];
  if (!configuration || typeof configuration !== "object" || Array.isArray(configuration)) {
    return ["suppression configuration must be an object"];
  }
  if (configuration.schemaVersion !== 1) errors.push("suppression configuration schemaVersion must be 1");
  if (!Array.isArray(configuration.suppressions)) {
    errors.push("suppression configuration suppressions must be an array");
    return errors;
  }
  if (nativeSuppressionPaths.length > 0) {
    errors.push("tool-native scanner suppression configuration is not permitted");
  }

  const allowedFields = new Set(["lane", "rule", "fingerprint", "reason", "owner", "expiresAt"]);
  for (const [index, entry] of configuration.suppressions.entries()) {
    const prefix = "suppression " + (index + 1);
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      errors.push(prefix + " must be an object");
      continue;
    }
    for (const key of Object.keys(entry)) {
      if (!allowedFields.has(key)) errors.push(prefix + " has an unsupported field");
    }
    if (!scanLanes.includes(entry.lane)) errors.push(prefix + " has an unknown lane");
    for (const field of ["rule", "fingerprint", "reason", "owner", "expiresAt"]) {
      if (typeof entry[field] !== "string" || !entry[field].trim()) {
        errors.push(prefix + " requires " + field);
      }
    }
    for (const field of ["rule", "fingerprint"]) {
      if (typeof entry[field] === "string" && /[*?[\]{}]/.test(entry[field])) {
        errors.push(prefix + " " + field + " must be exact");
      }
    }
    if (typeof entry.expiresAt === "string") {
      const expiration = new Date(entry.expiresAt + "T00:00:00.000Z");
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(entry.expiresAt) ||
        Number.isNaN(expiration.valueOf()) ||
        expiration.toISOString().slice(0, 10) !== entry.expiresAt ||
        expiration <= now
      ) {
        errors.push(prefix + " expiry must be a future ISO date");
      }
    }
  }

  return errors;
}

async function findForbiddenToolNativeSuppressionFiles(rootPath) {
  const found = await Promise.all(forbiddenToolNativeSuppressionFiles.map(async (relativePath) => {
    try {
      await access(path.join(rootPath, relativePath));
      return relativePath;
    } catch {
      return undefined;
    }
  }));
  const trackedTargets = await findTrackedTrivyTargets(rootPath);
  for (const targetPath of trackedTargets) {
    try {
      const source = await readFile(path.join(rootPath, targetPath), "utf8");
      if (/(?:#|\/\/)\s*(?:trivy|tfsec):ignore:|\/\*[\s\S]*?(?:trivy|tfsec):ignore:[\s\S]*?\*\//i.test(source)) {
        found.push(targetPath);
      }
    } catch {
      found.push(targetPath);
    }
  }
  return found.filter(Boolean);
}

async function findTrackedTrivyTargets(rootPath) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", rootPath, "ls-files", "-z", "--", ...trivyTargetPathspecs],
      { encoding: "utf8", maxBuffer: 1024 * 1024 }
    );
    return [...new Set(stdout.split("\0").filter(Boolean))].sort();
  } catch {
    throw new Error("security scan target discovery failed");
  }
}

async function findTrackedTerraformRoots(rootPath) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["-C", rootPath, "ls-files", "-z", "--", "*.tf", "*.tf.json"],
      { encoding: "utf8", maxBuffer: 1024 * 1024 }
    );
    return [...new Set(
      stdout
        .split("\0")
        .filter(Boolean)
        .map((filePath) => path.posix.dirname(filePath))
    )].sort();
  } catch {
    throw new Error("security scan target discovery failed");
  }
}

export async function validateTerraformProviderAdmission(_rootPath, terraformRoots, allowlistPath) {
  let allowlist;
  try {
    allowlist = parseJson(await readFile(allowlistPath, "utf8"));
  } catch {
    return false;
  }
  if (
    !isObject(allowlist) ||
    allowlist.schemaVersion !== 1 ||
    !Array.isArray(allowlist.providers) ||
    allowlist.providers.length !== 0 ||
    !Array.isArray(terraformRoots)
  ) {
    return false;
  }

  // The baseline contains no Terraform. Provider installation is therefore intentionally
  // unavailable until a separately reviewed parser and lockfile admission contract exists.
  return terraformRoots.length === 0;
}

function parseSummary(value, expectedLane) {
  try {
    const summary = JSON.parse(value);
    const normalized = createScanSummary(summary);
    if (normalized.lane !== expectedLane) throw new Error("lane mismatch");
    return normalized;
  } catch {
    throw new Error(`security scan ${expectedLane} summary is missing or malformed`);
  }
}

export function aggregateSecurityScans({ preflightResult, lanes }) {
  const errors = [];
  if (preflightResult !== "success") errors.push("security-scan-preflight did not succeed");
  const summaries = [];
  for (const lane of scanLanes) {
    const result = lanes?.[lane]?.result;
    if (result !== "success") {
      errors.push(`security scan ${lane} did not succeed`);
      continue;
    }
    let summary;
    try {
      summary = parseSummary(lanes[lane]?.summary ?? "", lane);
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `security scan ${lane} summary is missing or malformed`);
      continue;
    }
    summaries.push(summary);
    if (summary.status !== "clean" && summary.status !== "not-applicable") {
      errors.push(`security scan ${lane} reported ${summary.status}`);
    }
  }

  return { ok: errors.length === 0, errors, summaries };
}

async function writeOutput(outputPath, name, value) {
  await appendFile(outputPath, `${name}=${value}\n`, "utf8");
}

async function runCli() {
  const [command, ...arguments_] = process.argv.slice(2);
  if (command === "validate-suppressions") {
    const [configurationPath, rootPath = "."] = arguments_;
    let configuration;
    try {
      configuration = parseJson(await readFile(configurationPath, "utf8"));
    } catch {
      throw new Error("security scan suppression configuration is missing or malformed");
    }
    const nativeSuppressionPaths = await findForbiddenToolNativeSuppressionFiles(rootPath);
    const errors = validateSuppressionConfiguration(configuration, new Date(), nativeSuppressionPaths);
    if (errors.length > 0) {
      throw new Error("security scan suppressions are invalid: " + errors.join("; "));
    }
    return;
  }
  if (command === "summarize") {
    const [
      lane,
      tool,
      version,
      exitCodeText,
      reportPath,
      outputPath,
      expectedTargetCountText = "-",
      summaryPath
    ] = arguments_;
    let source = "";
    let reportExists = true;
    try {
      source = await readFile(reportPath, "utf8");
    } catch {
      reportExists = false;
    }
    const summary = summarizeReport({
      lane,
      tool,
      version,
      exitCode: Number(exitCodeText),
      source,
      reportExists,
      expectedTargetCount: expectedTargetCountText === "-" ? undefined : Number(expectedTargetCountText)
    });
    await writeOutput(outputPath, "summary", JSON.stringify(summary));
    if (summaryPath) await writeFile(summaryPath, JSON.stringify(summary), "utf8");
    return;
  }
  if (command === "terraform-roots") {
    const [rootPath = ".", outputPath] = arguments_;
    try {
      const roots = await findTrackedTerraformRoots(rootPath);
      await writeFile(outputPath, JSON.stringify(roots), "utf8");
    } catch {
      await writeFile(outputPath, "{}", "utf8");
    }
    return;
  }
  if (command === "terraform-admission") {
    const [rootPath = ".", rootsPath, allowlistPath] = arguments_;
    let roots;
    try {
      roots = parseJson(await readFile(rootsPath, "utf8"));
    } catch {
      throw new Error("Terraform provider admission is unavailable");
    }
    if (!Array.isArray(roots) || !await validateTerraformProviderAdmission(rootPath, roots, allowlistPath)) {
      throw new Error("Terraform provider admission is unavailable");
    }
    return;
  }
  if (command === "terraform-report") {
    const [indexPath, outputPath] = arguments_;
    try {
      const index = parseJson(await readFile(indexPath, "utf8"));
      if (!Array.isArray(index)) throw new Error(safeError());
      const roots = [];
      for (const entry of index) {
        if (!isObject(entry) || !Number.isInteger(entry.initExitCode) || typeof entry.validationPath !== "string") {
          throw new Error(safeError());
        }
        roots.push({
          initExitCode: entry.initExitCode,
          validation: parseJson(await readFile(entry.validationPath, "utf8"))
        });
      }
      await writeFile(outputPath, JSON.stringify({ roots }), "utf8");
    } catch {
      await writeFile(outputPath, "{}", "utf8");
    }
    return;
  }
  if (command === "trivy-targets") {
    const [rootPath = ".", outputPath] = arguments_;
    try {
      const targetPaths = await findTrackedTrivyTargets(rootPath);
      const inventory = [...new Map(targetPaths.map((targetPath) => {
        const isTerraform = targetPath.endsWith(".tf") || targetPath.endsWith(".tf.json");
        const target = isTerraform
          ? { kind: "terraform-module", path: path.posix.dirname(targetPath) }
          : { kind: "file", path: targetPath };
        return [target.kind + ":" + target.path, target];
      })).values()];
      await writeFile(outputPath, JSON.stringify(inventory), "utf8");
    } catch {
      await writeFile(outputPath, "{}", "utf8");
      throw new Error("security scan target discovery failed");
    }
    return;
  }
  if (command === "trivy-report") {
    const [targetsPath, scanPath, outputPath] = arguments_;
    try {
      const expectedTargets = parseJson(await readFile(targetsPath, "utf8"));
      const scan = parseJson(await readFile(scanPath, "utf8"));
      await writeFile(outputPath, JSON.stringify({ expectedTargets, scan }), "utf8");
    } catch {
      await writeFile(outputPath, "{}", "utf8");
    }
    return;
  }
  if (command === "not-applicable") {
    const [lane, tool, version, reason, outputPath, summaryPath] = arguments_;
    const summary = createScanSummary({
      lane,
      tool,
      version,
      targetCount: 0,
      findings: 0,
      status: "not-applicable",
      reason
    });
    await writeOutput(outputPath, "summary", JSON.stringify(summary));
    if (summaryPath) await writeFile(summaryPath, JSON.stringify(summary), "utf8");
    return;
  }
  if (command === "manual") {
    const [lane, tool, version, targetCountText, findingsText, status, reason, outputPath, summaryPath] = arguments_;
    if (lane !== "dependency-review" || !["clean", "error", "not-applicable"].includes(status)) {
      throw new Error("manual summaries are reserved for dependency-review outcomes");
    }
    const summary = createScanSummary({
      lane,
      tool,
      version,
      targetCount: Number(targetCountText),
      findings: Number(findingsText),
      status,
      ...(reason === "-" ? {} : { reason })
    });
    await writeOutput(outputPath, "summary", JSON.stringify(summary));
    if (summaryPath) await writeFile(summaryPath, JSON.stringify(summary), "utf8");
    return;
  }
  if (command === "enforce-summary") {
    const [summaryPath] = arguments_;
    let summary;
    try {
      summary = createScanSummary(parseJson(await readFile(summaryPath, "utf8")));
    } catch {
      throw new Error("security scan summary is missing or malformed");
    }
    if (summary.status !== "clean" && summary.status !== "not-applicable") {
      throw new Error("security scan " + summary.lane + " reported " + summary.status);
    }
    return;
  }
  if (command === "aggregate-env") {
    const [outputPath] = arguments_;
    const lanes = Object.fromEntries(
      scanLanes.map((lane) => {
        const envName = lane.toUpperCase().replaceAll("-", "_");
        return [lane, {
          result: process.env[`SECURITY_${envName}_RESULT`],
          summary: process.env[`SECURITY_${envName}_SUMMARY`]
        }];
      })
    );
    const aggregate = aggregateSecurityScans({
      preflightResult: process.env.SECURITY_PREFLIGHT_RESULT,
      lanes
    });
    await writeOutput(outputPath, "status", aggregate.ok ? "success" : "failure");
    if (!aggregate.ok) throw new Error(`security scan aggregate failed: ${aggregate.errors.join("; ")}`);
    return;
  }
  throw new Error("Usage: securityScanSummary.mjs validate-suppressions|summarize|terraform-roots|terraform-admission|terraform-report|trivy-targets|trivy-report|not-applicable|manual|enforce-summary|aggregate-env");
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirectExecution) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
