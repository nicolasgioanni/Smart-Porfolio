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

async function fetchNoCache(url, { allowNotFound = false } = {}) {
  const response = await fetch(url, {
    headers: { "Cache-Control": "no-cache", Pragma: "no-cache" },
    redirect: "follow",
    signal: AbortSignal.timeout(20_000)
  });
  if (allowNotFound && response.status === 404) return response;
  if (!response.ok) throw new Error(`${url.pathname} returned HTTP ${response.status}`);
  return response;
}

async function writeOutput(name, value, environment = process.env) {
  const line = `${name}=${value}`;
  console.log(line);
  if (environment.GITHUB_OUTPUT?.trim()) {
    await appendFile(environment.GITHUB_OUTPUT, `${line}\n`, "utf8");
  }
}

export async function compareDeployedContent(baseUrl, expectedContentHash, cacheBust, environment = process.env) {
  if (!contentHashPattern.test(expectedContentHash)) throw new Error("Expected content hash is invalid");
  const response = await fetchNoCache(endpointUrl(baseUrl, "content-version.json", cacheBust), {
    allowNotFound: true
  });

  if (response.status === 404) {
    await writeOutput("deployed_content_matches", "false", environment);
    return false;
  }

  let version;
  try {
    version = parseContentVersion(await response.json());
  } catch (error) {
    throw new Error(`Deployed content-version.json is invalid: ${error instanceof Error ? error.message : String(error)}`);
  }

  const matches = version.contentHash === expectedContentHash;
  await writeOutput("deployed_content_matches", String(matches), environment);
  await writeOutput("deployed_content_hash", version.contentHash, environment);
  return matches;
}

async function smokeAttempt(baseUrl, artifactDirectory, expectedContentHash, expectedCommitSha, cacheBust) {
  const rootResponse = await fetchNoCache(endpointUrl(baseUrl, "/", cacheBust));
  if (!rootResponse.headers.get("content-type")?.includes("text/html")) {
    throw new Error("Deployment root did not return HTML");
  }
  const rootHtml = await rootResponse.text();
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

  const versionResponse = await fetchNoCache(endpointUrl(baseUrl, "content-version.json", cacheBust));
  const deployedVersion = parseContentVersion(await versionResponse.json());
  assert.equal(deployedVersion.contentHash, expectedContentHash, "Deployed content hash is stale");
  assert.equal(deployedVersion.commitSha, expectedCommitSha, "Deployed commit SHA is stale");

  const manifestResponse = await fetchNoCache(endpointUrl(baseUrl, artifactManifestFileName, cacheBust));
  const deployedManifest = await manifestResponse.json();
  const localManifest = JSON.parse(
    await readFile(path.join(path.resolve(artifactDirectory), artifactManifestFileName), "utf8")
  );
  assert.deepEqual(deployedManifest, localManifest, "Deployed artifact manifest does not match the verified upload");

  const robotsResponse = await fetchNoCache(endpointUrl(baseUrl, "robots.txt", cacheBust));
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

  const sitemapResponse = await fetchNoCache(endpointUrl(baseUrl, "sitemap.xml", cacheBust));
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
  if (command === "compare" && args.length === 3) return compareDeployedContent(...args);
  if (command === "smoke" && args.length === 4) return smokeDeployment(...args);
  throw new Error(
    "Usage: node scripts/checkDeployedContent.mjs url <pages-domain> <main|develop> | compare <base-url> <content-hash> <cache-bust> | smoke <base-url> <artifact-directory> <content-hash> <commit-sha>"
  );
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
