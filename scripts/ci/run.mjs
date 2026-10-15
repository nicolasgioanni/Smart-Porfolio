import { fileURLToPath } from "node:url";
import path from "node:path";
import { writeOutputs } from "./resolve.mjs";
import { parsePlan, recordDigest } from "./plan.mjs";
import { parseArtifactReference } from "./snapshot.mjs";
import { artifactName } from "./githubEvidence.mjs";
import { checkedCandidate, currentProducer, jsonEnvironment } from "./context.mjs";

export function uploadedReference(environment = process.env) {
  const role = environment.CI_ARTIFACT_ROLE;
  const identity = { snapshot: ["prepare-content", "content"], discovery: ["prepare-content", "browsers"],
    release: ["build-and-package", "candidate"] }[role];
  if (!identity) throw new Error("Unexpected artifact producer role.");
  const [job, validator] = identity, producer = currentProducer(job, environment);
  if (!/^[1-9][0-9]*$/.test(environment.CI_ARTIFACT_ID ?? "")) throw new Error("Upload did not return an immutable artifact ID.");
  return parseArtifactReference({ schemaVersion: 1, role, producer,
    name: artifactName({ role, validator, producer }), id: Number(environment.CI_ARTIFACT_ID),
    digest: environment.CI_ARTIFACT_DIGEST, recordDigest: environment.CI_RECORD_DIGEST });
}

export async function run(command, environment = process.env) {
  switch (command) {
    case "prepare": return (await import("./prepare.mjs")).prepareCandidate({ environment });
    case "reference": return { reference: JSON.stringify(uploadedReference(environment)) };
    case "restore": return (await import("./consume.mjs")).restoreAcceptedInputs({ environment });
    case "receipt": return (await import("./consume.mjs")).writeValidationEvidence({ environment, validator: environment.GITHUB_JOB });
    case "source-receipt": return (await import("./consume.mjs")).writeSourceEvidence({ environment });
    case "browser": return (await import("./browserRun.mjs")).runBrowserValidation({ environment });
    case "build": return (await import("./releaseStages.mjs")).buildCandidate({ environment });
    case "export": return (await import("./releaseStages.mjs")).validateExport({ environment });
    case "deployment-prepare": return (await import("./deployment.mjs")).prepareDeployment({ environment });
    case "deploy": return (await import("./deployment.mjs")).executeDeployment({ environment });
    case "verify": {
      const needs = jsonEnvironment("CI_NEEDS", environment);
      const plan = parsePlan(JSON.parse(needs["prepare-content"]?.outputs?.plan));
      if (recordDigest(checkedCandidate(environment)) !== recordDigest(plan.candidate)) throw new Error("Aggregate candidate differs from the prepared plan.");
      const reference = (value) => value === "" ? null : parseArtifactReference(JSON.parse(value));
      const result = await (await import("./gate.mjs")).verifyCompleteEvidence({ plan, results: needs,
        currentAttempt: currentProducer("verify", environment).attempt, references: {
          snapshot: reference(needs["prepare-content"].outputs.snapshot_reference),
          discovery: reference(needs["prepare-content"].outputs.discovery_reference),
          release: reference(needs["build-and-package"].outputs.release_reference ?? "")
        } }, { token: environment.GH_TOKEN });
      console.log(JSON.stringify({ mode: result.mode, accepted: result.accepted, deploy: result.deploy, summaries: result.summaries }));
      return { accepted: String(result.accepted), deploy: String(result.deploy), plan: JSON.stringify(plan),
        acceptance: JSON.stringify(result) };
    }
    default: throw new Error("Unsupported CI operation.");
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    if (process.argv.length !== 3) throw new Error("Usage: node scripts/ci/run.mjs <operation>");
    await writeOutputs(await run(process.argv[2]));
  } catch (error) {
    console.error(error instanceof Error ? error.message : "CI operation failed.");
    process.exitCode = 1;
  }
}
