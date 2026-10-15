import { randomUUID } from "node:crypto";
import { parseContentVersion } from "../writeContentVersion.mjs";
import { candidateTarget, parseCandidate, recordDigest } from "./plan.mjs";
import { parseSnapshot } from "./snapshot.mjs";

export const reviewedPagesProjectName = "smart-portfolio";
export const reviewedPagesDomain = "smart-portfolio-bds.pages.dev";
export const reviewedPagesProductionBranch = "main";

export function approvedPagesOrigin(target, environment = process.env) {
  if (environment.CLOUDFLARE_PAGES_PROJECT_NAME !== reviewedPagesProjectName ||
      environment.CLOUDFLARE_PAGES_DOMAIN !== reviewedPagesDomain) {
    throw new Error("Cloudflare project/domain differ from the reviewed deployment target.");
  }
  if (!["preview", "production"].includes(target)) throw new Error("Only deployable targets have a Pages origin.");
  return `https://${target === "preview" ? "develop." : ""}${environment.CLOUDFLARE_PAGES_DOMAIN}`;
}

function deployedIdentityUrl(origin) {
  const url = new URL("/content-version.json", origin);
  url.searchParams.set("ci", randomUUID());
  return url;
}

export async function readDeployedIdentity(target, { environment = process.env, fetchImplementation = fetch,
  signal = AbortSignal.timeout(20_000), exactDeployment = null } = {}) {
  const alias = approvedPagesOrigin(target, environment);
  if (exactDeployment !== null && !/^https:\/\/[a-f0-9]{8}\.smart-portfolio-bds\.pages\.dev$/.test(exactDeployment)) throw new Error("Exact deployment host is not an approved Pages hash host.");
  const origin = exactDeployment ?? alias;
  let abort;
  const expired = new Promise((_, reject) => {
    abort = () => reject(new Error("Deployed identity observation timed out."));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) abort();
  });
  let reader;
  try {
    const response = await Promise.race([Promise.resolve().then(() => fetchImplementation(deployedIdentityUrl(origin), {
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" }, redirect: "error", signal
    })), expired]);
    if (response.status === 404) { void response.body?.cancel().catch(() => {}); return null; }
    if (response.status !== 200 || !response.body) throw new Error("Deployed identity observation failed; it cannot authorize a no-op or deployment.");
    reader = response.body.getReader();
    const chunks = [];
    let size = 0;
    for (;;) {
      const item = await Promise.race([reader.read(), expired]);
      if (item.done) break;
      if (Object.prototype.toString.call(item.value) !== "[object Uint8Array]") throw new Error("Deployed identity response is malformed.");
      size += item.value.byteLength;
      if (size > 64 * 1024) throw new Error("Deployed identity response exceeds its budget.");
      chunks.push(Buffer.from(item.value));
    }
    try { return parseContentVersion(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)))); }
    catch { throw new Error("Deployed identity response is malformed."); }
  } finally {
    signal.removeEventListener("abort", abort);
    void reader?.cancel().catch(() => {});
  }
}

export function compareSnapshotDeployment(candidateValue, snapshotValue, deployedValue) {
  const candidate = parseCandidate(candidateValue), snapshot = parseSnapshot(snapshotValue);
  if (snapshot.candidateDigest !== recordDigest(candidate) || snapshot.target !== candidateTarget(candidate)) throw new Error("Deployment comparison uses different candidate inputs.");
  const deployed = deployedValue === null ? null : parseContentVersion(deployedValue);
  return { schemaVersion: 1,
    equivalent: deployed?.schemaVersion === 2 && deployed.target === snapshot.target &&
      deployed.producer.kind === "github-actions" && deployed.commitSha === candidate.sourceSha &&
      deployed.contentHash === snapshot.contentHash && deployed.publicBuildInputDigest === snapshot.publicBuildInputDigest,
    identityDigest: deployed === null ? null : recordDigest(deployed) };
}
