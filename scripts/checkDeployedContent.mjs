import assert from "node:assert/strict";
import { appendFile, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { artifactManifestFileName } from "./artifactIntegrity.mjs";
import { parseContentVersion } from "./writeContentVersion.mjs";

const contentHashPattern = /^[a-f0-9]{64}$/;
const gitShaPattern = /^[a-f0-9]{40}$/;
const pagesDomainPattern = /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.pages\.dev$/;
const canonicalHomepageUrl = new URL("https://nicolasmgioanni.dev/");
const staticHeaderNames = new Map([
  ["content-security-policy", "Content-Security-Policy"],
  ["permissions-policy", "Permissions-Policy"],
  ["referrer-policy", "Referrer-Policy"],
  ["strict-transport-security", "Strict-Transport-Security"],
  ["x-content-type-options", "X-Content-Type-Options"],
  ["x-frame-options", "X-Frame-Options"]
]);

export function resolvePagesDeploymentUrl(pagesDomain, branch) {
  if (typeof pagesDomain !== "string" || !pagesDomainPattern.test(pagesDomain)) {
    throw new Error("Cloudflare Pages domain must be a lowercase pages.dev hostname without a scheme or path");
  }
  if (branch === "main") return `https://${pagesDomain}`;
  if (branch === "develop") return `https://develop.${pagesDomain}`;
  throw new Error("Cloudflare Pages deployment branch must be main or develop");
}

function normalizeBaseUrl(value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Deployment base URL is invalid");
  }
  if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash) {
    throw new Error("Deployment base URL must be an HTTPS origin without credentials, query, or fragment");
  }
  url.pathname = `${url.pathname.replace(/\/+$/, "")}/`;
  return url;
}

function endpointUrl(baseUrl, endpoint, cacheBust) {
  const url = new URL(endpoint.replace(/^\//, ""), normalizeBaseUrl(baseUrl));
  url.searchParams.set("ci", cacheBust);
  return url;
}

async function fetchNoCache(url, { allowNotFound = false, rejectRedirect = false } = {}) {
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    redirect: rejectRedirect ? "manual" : "follow",
    signal: AbortSignal.timeout(20_000)
  });
  if (rejectRedirect && response.status >= 300 && response.status < 400) {
    throw new Error(`${url.pathname} redirected before its identity could be verified`);
  }
  if (allowNotFound && response.status === 404) return response;
  if (!response.ok) throw new Error(`${url.pathname} returned HTTP ${response.status}`);
  return response;
}

function headerRuleMatches(rule, requestPath) {
  const expression = rule.replace(/[|\\{}()[\]^$+?.]/g, "\\$&").replaceAll("*", ".*");
  return new RegExp(`^${expression}$`).test(requestPath);
}

function effectiveStaticHeaders(headerFile, requestPath) {
  const rules = headerFile.trim().split(/\r?\n\r?\n/).filter(Boolean);
  const headers = new Map();
  for (const rule of rules) {
    const [route, ...lines] = rule.split(/\r?\n/);
    if (!route || !route.startsWith("/") || /\s/.test(route) || !headerRuleMatches(route, requestPath)) continue;
    for (const line of lines) {
      if (!line.startsWith("  ")) throw new Error("Verified artifact has a malformed _headers rule.");
      const instruction = line.slice(2);
      const remove = instruction.match(/^! ([!#$%&'*+.^_`|~0-9A-Za-z-]+)$/);
      const set = instruction.match(/^([!#$%&'*+.^_`|~0-9A-Za-z-]+): (\S(?:.*\S)?)$/);
      const name = (remove?.[1] ?? set?.[1])?.toLowerCase();
      if (!name) throw new Error("Verified artifact has a malformed _headers instruction.");
      if (!staticHeaderNames.has(name)) continue;
      if (remove) {
        headers.delete(name);
      } else if (headers.has(name)) {
        throw new Error(`Verified artifact defines ${staticHeaderNames.get(name)} more than once for ${requestPath}.`);
      } else {
        headers.set(name, set[2]);
      }
    }
  }
  for (const [name, label] of staticHeaderNames) {
    if (!headers.has(name)) throw new Error(`Verified artifact is missing the effective ${label} header for ${requestPath}.`);
  }
  return headers;
}

export async function assertStaticHeaders(response, artifactDirectory, requestPath = "/") {
  const headerFile = await readFile(path.join(path.resolve(artifactDirectory), "_headers"), "utf8");
  const expected = effectiveStaticHeaders(headerFile, requestPath);
  for (const [name, label] of staticHeaderNames) {
    assert.equal(
      response.headers.get(name),
      expected.get(name),
      `Deployment ${requestPath} has an unexpected ${label} header`
    );
  }
}

export function assertNoCacheMetadataHeaders(response, name) {
  assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/i, `${name} must disable caching`);
  assert.equal(response.headers.get("pragma"), "no-cache", `${name} must set Pragma: no-cache`);
}

export function assertFunctionHeaders(response, endpoint) {
  assert.match(response.headers.get("cache-control") ?? "", /\bno-store\b/i, `/${endpoint} must disable caching`);
  assert.equal(response.headers.get("referrer-policy"), "no-referrer", `/${endpoint} must not leak referrers`);
  assert.equal(response.headers.get("x-content-type-options"), "nosniff", `/${endpoint} must disable content sniffing`);
  assert.equal(response.headers.get("content-security-policy"), "default-src 'none'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'", `/${endpoint} must retain restrictive JSON CSP`);
  assert.equal(response.headers.get("permissions-policy"), "camera=(), geolocation=(), microphone=(), payment=(), usb=()", `/${endpoint} must disable sensitive browser features`);
  assert.equal(response.headers.get("strict-transport-security"), "max-age=31536000", `/${endpoint} must retain transport security`);
  assert.equal(response.headers.get("x-frame-options"), "DENY", `/${endpoint} must reject framing`);
}

export async function assertRootResponse(response, artifactDirectory) {
  if (!response.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Deployment root did not return HTML");
  }
  await assertStaticHeaders(response, artifactDirectory);
  const rootBytes = Buffer.from(await response.arrayBuffer());
  assert.deepEqual(
    rootBytes,
    await readFile(path.join(path.resolve(artifactDirectory), "index.html")),
    "Deployment root content does not match the verified upload"
  );
  return new TextDecoder("utf-8", { fatal: true }).decode(rootBytes);
}

async function writeOutput(name, value, environment = process.env) {
  const line = `${name}=${value}`;
  console.log(line);
  if (environment.GITHUB_OUTPUT?.trim()) {
    await appendFile(environment.GITHUB_OUTPUT, `${line}\n`, "utf8");
  }
}

export async function compareDeployedContent(
  baseUrl,
  expectedContentHash,
  expectedCommitSha,
  cacheBust,
  environment = process.env
) {
  if (!contentHashPattern.test(expectedContentHash)) throw new Error("Expected content hash is invalid");
  if (!gitShaPattern.test(expectedCommitSha)) throw new Error("Expected commit SHA is invalid");
  const response = await fetchNoCache(endpointUrl(baseUrl, "content-version.json", cacheBust), {
    allowNotFound: true,
    rejectRedirect: true
  });

  if (response.status === 404) {
    await writeOutput("deployed_content_matches", "false", environment);
    await writeOutput("deployed_commit_matches", "false", environment);
    return false;
  }

  let version;
  try {
    version = parseContentVersion(await response.json());
  } catch (error) {
    throw new Error(`Deployed content-version.json is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  const contentMatches = version.contentHash === expectedContentHash;
  const commitMatches = version.commitSha === expectedCommitSha;
  await writeOutput("deployed_content_matches", String(contentMatches), environment);
  await writeOutput("deployed_commit_matches", String(commitMatches), environment);
  await writeOutput("deployed_content_hash", version.contentHash, environment);
  await writeOutput("deployed_commit_sha", version.commitSha, environment);
  return contentMatches && commitMatches;
}

function isDeployableV2(version) {
  return version?.schemaVersion === 2 &&
    (version.target === "preview" || version.target === "production") &&
    version.producer?.kind === "github-actions";
}

/** Compares only the monotonic GitHub producer fields, never timestamps. */
export function compareProducerGeneration(left, right) {
  if (!isDeployableV2(left) || !isDeployableV2(right)) {
    throw new Error("Producer ordering requires deployable v2 content identities");
  }
  if (left.producer.runNumber !== right.producer.runNumber) {
    return left.producer.runNumber < right.producer.runNumber ? -1 : 1;
  }
  if (left.producer.attempt !== right.producer.attempt) {
    return left.producer.attempt < right.producer.attempt ? -1 : 1;
  }
  return 0;
}

export function sameDeploymentIdentity(left, right) {
  return isDeployableV2(left) && isDeployableV2(right) &&
    left.commitSha === right.commitSha &&
    left.contentHash === right.contentHash &&
    left.target === right.target &&
    left.publicBuildInputDigest === right.publicBuildInputDigest &&
    left.producer.runId === right.producer.runId &&
    compareProducerGeneration(left, right) === 0;
}

/**
 * Decides a deployment path without network or filesystem effects. A legacy
 * v1 identity can request full verification, but can never establish no-op or
 * ordering equivalence. Malformed and ambiguous identities fail closed.
 */
export function decideDeployment(candidateValue, deployedValue) {
  let candidate;
  try { candidate = parseContentVersion(candidateValue); }
  catch { return { action: "fail-closed", reason: "candidate-identity-invalid" }; }
  if (!isDeployableV2(candidate)) return { action: "fail-closed", reason: "candidate-is-not-deployable-v2" };
  if (deployedValue === undefined || deployedValue === null) return { action: "full-verification", reason: "no-deployed-identity" };
  let deployed;
  try { deployed = parseContentVersion(deployedValue); }
  catch { return { action: "fail-closed", reason: "deployed-identity-malformed" }; }
  if (deployed.schemaVersion === 1) return { action: "full-verification", reason: "legacy-deployed-identity" };
  if (!isDeployableV2(deployed)) return { action: "fail-closed", reason: "deployed-identity-not-deployable-v2" };
  if (candidate.target !== deployed.target) return { action: "fail-closed", reason: "deployed-target-mismatch" };
  if (sameDeploymentIdentity(candidate, deployed)) return { action: "smoke-only", reason: "exact-deployed-identity" };
  const ordering = compareProducerGeneration(candidate, deployed);
  if (ordering < 0) return { action: "fail-closed", reason: "candidate-generation-is-older" };
  if (ordering === 0) return { action: "fail-closed", reason: "same-generation-has-different-identity" };
  return { action: "full-verification", reason: "candidate-generation-is-newer" };
}

async function smokeAttempt(baseUrl, artifactDirectory, expectedContentHash, expectedCommitSha, cacheBust) {
  const rootResponse = await fetchNoCache(endpointUrl(baseUrl, "/", cacheBust), { rejectRedirect: true });
  const rootHtml = await assertRootResponse(rootResponse, artifactDirectory);
  const canonicalTag = (rootHtml.match(/<link\b[^>]*>/gi) ?? []).find((tag) =>
    /\brel\s*=\s*(["'])canonical\1/i.test(tag)
  );
  const canonicalHref = canonicalTag?.match(/\bhref\s*=\s*(["'])([^"']+)\1/i)?.[2];
  assert.ok(canonicalHref, "Deployment root did not declare a canonical link");

  let deployedCanonical;
  try {
    deployedCanonical = new URL(canonicalHref);
  } catch {
    throw new Error("Deployment root canonical link is not an absolute URL");
  }
  assert.equal(deployedCanonical.origin, canonicalHomepageUrl.origin, "Deployment root canonical origin is incorrect");
  assert.equal(deployedCanonical.pathname, canonicalHomepageUrl.pathname, "Deployment root canonical path is incorrect");
  assert.equal(deployedCanonical.search, "", "Deployment root canonical must not contain a query string");
  assert.equal(deployedCanonical.hash, "", "Deployment root canonical must not contain a fragment");

  const versionResponse = await fetchNoCache(endpointUrl(baseUrl, "content-version.json", cacheBust), { rejectRedirect: true });
  assertNoCacheMetadataHeaders(versionResponse, "content-version.json");
  const deployedVersion = parseContentVersion(await versionResponse.json());
  assert.equal(deployedVersion.contentHash, expectedContentHash, "Deployed content hash is stale");
  assert.equal(deployedVersion.commitSha, expectedCommitSha, "Deployed commit SHA is stale");

  const manifestResponse = await fetchNoCache(endpointUrl(baseUrl, artifactManifestFileName, cacheBust), { rejectRedirect: true });
  assertNoCacheMetadataHeaders(manifestResponse, artifactManifestFileName);
  const deployedManifest = await manifestResponse.json();
  const localManifest = JSON.parse(
    await readFile(path.join(path.resolve(artifactDirectory), artifactManifestFileName), "utf8")
  );
  assert.deepEqual(deployedManifest, localManifest, "Deployed artifact manifest does not match the verified upload");

  const robotsResponse = await fetchNoCache(endpointUrl(baseUrl, "robots.txt", cacheBust), { rejectRedirect: true });
  assert.match(
    robotsResponse.headers.get("content-type") ?? "",
    /^text\/plain\b/i,
    "/robots.txt did not return plain text"
  );
  assert.equal(
    await robotsResponse.text(),
    await readFile(path.join(path.resolve(artifactDirectory), "robots.txt"), "utf8"),
    "Deployed robots.txt does not match the verified upload"
  );

  const sitemapResponse = await fetchNoCache(endpointUrl(baseUrl, "sitemap.xml", cacheBust), { rejectRedirect: true });
  assert.match(
    sitemapResponse.headers.get("content-type") ?? "",
    /^(?:application|text)\/(?:xml|[a-z0-9!#$&^_.+-]+\+xml)(?:\s*;|$)/i,
    "/sitemap.xml did not return XML"
  );
  assert.equal(
    await sitemapResponse.text(),
    await readFile(path.join(path.resolve(artifactDirectory), "sitemap.xml"), "utf8"),
    "Deployed sitemap.xml does not match the verified upload"
  );

  for (const endpoint of ["api/contact/verify", "api/contact"]) {
    const apiResponse = await fetch(endpointUrl(baseUrl, endpoint, cacheBust), {
      headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
      redirect: "manual",
      signal: AbortSignal.timeout(20_000)
    });
    assert.equal(apiResponse.status, 405, `/${endpoint} did not reject a GET request with HTTP 405`);
    assert.match(
      apiResponse.headers.get("content-type") ?? "",
      /^application\/json\b/i,
      `/${endpoint} did not return JSON`
    );
    assertFunctionHeaders(apiResponse, endpoint);
    assert.deepEqual(
      await apiResponse.json(),
      { ok: false, error: "method_not_allowed" },
      `/${endpoint} did not return the expected method rejection`
    );
  }
}

export async function smokeDeployment(baseUrl, artifactDirectory, expectedContentHash, expectedCommitSha) {
  if (!contentHashPattern.test(expectedContentHash)) throw new Error("Expected content hash is invalid");
  if (!gitShaPattern.test(expectedCommitSha)) throw new Error("Expected commit SHA is invalid");

  let lastError;
  for (let attempt = 1; attempt <= 10; attempt += 1) {
    try {
      await smokeAttempt(
        baseUrl,
        artifactDirectory,
        expectedContentHash,
        expectedCommitSha,
        `${expectedCommitSha}-${Date.now()}-${attempt}`
      );
      console.log(`Deployment smoke checks passed for ${normalizeBaseUrl(baseUrl).origin}.`);
      return;
    } catch (error) {
      lastError = error;
      if (attempt < 10) await new Promise((resolve) => setTimeout(resolve, 5_000));
    }
  }

  throw new Error(`Deployment smoke checks failed: ${lastError instanceof Error ? lastError.message : String(lastError)}`);
}

async function runCli() {
  const [command, ...args] = process.argv.slice(2);
  if (command === "url" && args.length === 2) {
    console.log(resolvePagesDeploymentUrl(...args));
    return;
  }
  if (command === "compare" && args.length === 4) return compareDeployedContent(...args);
  if (command === "smoke" && args.length === 4) return smokeDeployment(...args);
  throw new Error(
    "Usage: node scripts/checkDeployedContent.mjs url <pages-domain> <main|develop> | compare <base-url> <content-hash> <commit-sha> <cache-bust> | smoke <base-url> <artifact-directory> <content-hash> <commit-sha>"
  );
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
