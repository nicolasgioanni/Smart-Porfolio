import { readFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { recordDigest } from "./plan.mjs";
import { parseArtifactReference } from "./snapshot.mjs";
import { artifactName } from "./githubEvidence.mjs";
import { downloadArtifact, extractArtifact } from "./artifactTransport.mjs";
import { jsonEnvironment } from "./context.mjs";
import { verifyAcceptedInputs, writeValidationEvidence } from "./consume.mjs";
import { parseDiscoveryEnvelope } from "./gate.mjs";
import { parseBrowserReport, crossBrowserProjects } from "./browserDiscovery.mjs";
import { readEvidenceArtifact } from "./validationEvidence.mjs";

export function browserAssignment(job, shard, discovery) {
  parseDiscoveryEnvelope(discovery);
  if (job === "browser-e2e") {
    if (!["1/2", "2/2"].includes(shard)) throw new Error("Unknown Chromium shard.");
    const validator = `chromium-${shard[0]}-of-2`;
    return { validator, selection: "functional", identities: discovery.chromium.assignments[validator].identities,
      arguments: ["--project=chromium", `--shard=${shard}`] };
  }
  if (shard !== undefined) throw new Error("Only Chromium functional jobs may select a shard.");
  if (job === "visual-regression") return { validator: job, selection: "visual",
    identities: discovery.chromium.assignments[job].identities, arguments: ["--project=chromium"] };
  if (job === "cross-browser") return { validator: job, selection: "full",
    identities: discovery.crossBrowser.identities, arguments: crossBrowserProjects.map((project) => `--project=${project}`) };
  throw new Error("Unsupported browser validator.");
}

export async function runBrowserValidation({ environment = process.env, projectRoot = process.cwd() } = {}) {
  const { root, plan } = await verifyAcceptedInputs({ environment, projectRoot });
  const reference = parseArtifactReference(jsonEnvironment("CI_DISCOVERY_REFERENCE", environment));
  if (reference.role !== "discovery" || reference.producer.job !== "prepare-content" ||
      reference.name !== artifactName({ role: "discovery", validator: "browsers", producer: reference.producer })) throw new Error("Unexpected browser discovery producer.");
  const directory = path.join(root, "discovery");
  await extractArtifact(await downloadArtifact(reference, plan.candidate, { token: environment.GH_TOKEN }), directory);
  const discovery = await readEvidenceArtifact(directory, "discovery.json");
  if (recordDigest(discovery) !== reference.recordDigest) throw new Error("Browser discovery changed after preparation.");
  const assigned = browserAssignment(environment.GITHUB_JOB, environment.CI_SHARD, discovery);
  const output = path.join(root, "browser-report.json");
  const browserEnvironment = { ...environment };
  delete browserEnvironment.GH_TOKEN;
  await new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(projectRoot, "node_modules/playwright/cli.js"), "test",
      "--config=playwright.ci.config.ts", ...assigned.arguments,
      `--reporter=line,${path.join(projectRoot, "scripts/ci/browserReporter.mjs")}`], {
      cwd: projectRoot, shell: false, stdio: "inherit", env: { ...browserEnvironment,
        CI_BROWSER_SELECTION: assigned.selection, CI_BROWSER_ROOT: projectRoot,
        CI_BROWSER_REPORT: output, CI_BROWSER_REPORT_MODE: "execution" }
    });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Browser validation failed; no successful receipt is authorized.")));
  });
  const browserReport = parseBrowserReport(JSON.parse(await readFile(output, "utf8")), "execution");
  return writeValidationEvidence({ environment, projectRoot, validator: assigned.validator,
    assignment: assigned.identities, browserReport });
}
