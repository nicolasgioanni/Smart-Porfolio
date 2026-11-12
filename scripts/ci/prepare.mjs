import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";
import { createPlan, candidateTarget, recordDigest } from "./plan.mjs";
import { createSnapshot, generatedContentPath } from "./snapshot.mjs";
import { artifactName } from "./githubEvidence.mjs";
import { checkedCandidate, currentProducer, digestFile, evidenceDirectory, writeRecord } from "./context.mjs";
import { collectPublicBuildInputs, publicBuildInputDigest } from "../release/publicBuildInputs.mjs";
import { discoverCompleteBrowserCoverage } from "./browserDiscovery.mjs";
import { approvedPagesOrigin, compareSnapshotDeployment, readDeployedIdentity } from "./deployedIdentity.mjs";

export function generateContent(projectRoot, environment) {
  return new Promise((resolve, reject) => {
    const child = spawn("npm", ["run", "generate:content"], { cwd: projectRoot, env: environment, shell: false, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", (code) => code === 0 ? resolve() : reject(new Error("Content preparation failed.")));
  });
}

export async function prepareCandidate({ environment = process.env, projectRoot = process.cwd(),
  generate = generateContent, discover = discoverCompleteBrowserCoverage, observe = readDeployedIdentity } = {}) {
  const candidate = checkedCandidate(environment, projectRoot);
  const producer = currentProducer("prepare-content", environment);
  if (producer.runId !== candidate.runId || producer.runNumber !== candidate.runNumber || producer.attempt < candidate.producerAttempt) throw new Error("Preparation producer differs from the accepted candidate.");
  if (candidate.event !== "pull_request" && candidate.sourceSha !== candidate.branchTip) {
    return { plan: JSON.stringify(createPlan(candidate)), mode: "obsolete", target: candidateTarget(candidate),
      snapshot_name: "", snapshot_path: "", snapshot_digest: "", discovery_name: "", discovery_path: "", discovery_digest: "" };
  }
  const target = candidateTarget(candidate), isPr = candidate.event === "pull_request";
  if (!isPr) {
    approvedPagesOrigin(target, environment);
    if (typeof environment.PORTFOLIO_WORKBOOK_URL !== "string" || !environment.PORTFOLIO_WORKBOOK_URL.trim()) throw new Error("Trusted preparation requires the workbook credential.");
  }
  await generate(projectRoot, { ...environment, PORTFOLIO_REQUIRE_REMOTE_CONTENT: String(!isPr),
    PORTFOLIO_WORKBOOK_URL: isPr ? "" : environment.PORTFOLIO_WORKBOOK_URL });
  const bytes = await readFile(path.join(projectRoot, generatedContentPath));
  const { validateGeneratedSource } = await import("../release/lifecycle.mjs");
  validateGeneratedSource(JSON.parse(bytes.toString("utf8")), target);
  const inputs = await collectPublicBuildInputs({ projectRoot, target, sourceCommit: candidate.sourceSha, environment });
  const snapshot = createSnapshot({ bytes, candidate, producer,
    lockfileDigest: await digestFile(path.join(projectRoot, "package-lock.json")), publicBuildInputDigest: publicBuildInputDigest(inputs) });
  const comparison = candidate.event === "schedule" || (candidate.event === "workflow_dispatch" && !candidate.force)
    ? compareSnapshotDeployment(candidate, snapshot, await observe(target, { environment })) : null;
  const plan = createPlan(candidate, { snapshotDigest: recordDigest(snapshot), comparison });
  const root = await evidenceDirectory(environment), snapshotPath = path.join(root, "snapshot");
  await mkdir(snapshotPath, { mode: 0o700 });
  await writeFile(path.join(snapshotPath, "portfolio.generated.json"), bytes, { flag: "wx", mode: 0o600 });
  await writeRecord(snapshotPath, "snapshot.json", snapshot);
  const outputs = { plan: JSON.stringify(plan), mode: plan.mode, target,
    snapshot_name: artifactName({ role: "snapshot", validator: "content", producer }), snapshot_path: snapshotPath,
    snapshot_digest: recordDigest(snapshot), discovery_name: "", discovery_path: "", discovery_digest: "" };
  if (plan.mode === "full") {
    const discovery = await discover({ projectRoot });
    const discoveryPath = path.join(root, "discovery");
    await mkdir(discoveryPath, { mode: 0o700 });
    await writeRecord(discoveryPath, "discovery.json", discovery);
    outputs.discovery_name = artifactName({ role: "discovery", validator: "browsers", producer });
    outputs.discovery_path = discoveryPath;
    outputs.discovery_digest = recordDigest(discovery);
  }
  return outputs;
}
