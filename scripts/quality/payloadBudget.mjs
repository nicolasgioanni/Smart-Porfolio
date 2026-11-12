import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync } from "node:zlib";

export const publicRoutes = [
  "/", "/experience", "/projects", "/recommendations", "/research", "/resume", "/contact", "/privacy", "/terms", "/security", "/contact-terms"
];

const researchOnlyMarkers = [
  "cytocv-supplementary-video-s1.mp4",
  "cytocv-supplementary-video-s1.en.vtt",
  "cytocv-supplementary-video-s1-transcript.txt",
  "research-video-player",
  "research-abstract",
  "article.research-project"
];

function fail(message) {
  throw new Error(`Payload budget: ${message}`);
}

function routeFile(route) {
  if (!publicRoutes.includes(route)) fail(`unsupported public route ${route}.`);
  return route === "/" ? "index.html" : `${route.slice(1)}.html`;
}

function ceiling(value, slack) {
  if (!Number.isSafeInteger(value) || value < 0 || typeof slack !== "number" || slack < 1) fail("baseline budget is malformed.");
  return Math.ceil(value * slack);
}

function assetPathFromReference(reference) {
  if (typeof reference !== "string" || !reference.startsWith("/_next/static/") || reference.includes("?") || reference.includes("#")) {
    fail(`initial script reference ${String(reference)} is unsafe or unsupported.`);
  }
  const relative = reference.slice("/_next/".length);
  if (relative.split("/").some((part) => !part || part === "." || part === ".." || part.includes("\\"))) {
    fail(`initial script reference ${reference} is unsafe.`);
  }
  return relative;
}

export function initialScriptReferences(html) {
  if (typeof html !== "string") fail("route HTML is unavailable.");
  const references = [];
  const expression = /<script\b[^>]*\bsrc=(?:"([^"]+)"|'([^']+)')[^>]*>/gi;
  for (const match of html.matchAll(expression)) references.push(match[1] ?? match[2]);
  const unique = [...new Set(references)];
  if (unique.length === 0) fail("route HTML has no initial JavaScript references.");
  unique.forEach(assetPathFromReference);
  return unique;
}

function equalSets(actual, expected) {
  return actual.length === expected.length && actual.every((value) => expected.includes(value));
}

function roleForAsset(relative) {
  if (relative === "images/research/cytocv-supplementary-video-s1.mp4") return "research-video";
  if (relative === "images/research/cytocv-supplementary-video-s1.en.vtt") return "research-caption";
  if (relative === "images/research/cytocv-supplementary-video-s1-transcript.txt") return "research-transcript";
  if (/^images\/research\/[a-z0-9-]+-graphical-abstract\.png$/.test(relative)) return "research-graphical-abstract";
  return undefined;
}

async function listAssets(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolute = path.join(current, entry.name);
    if (entry.isDirectory()) files.push(...await listAssets(root, absolute));
    else if (entry.isFile()) files.push({ relative: path.relative(root, absolute).split(path.sep).join("/"), size: (await stat(absolute)).size });
    else fail(`published asset ${absolute} is not a regular file.`);
  }
  return files;
}

function validateRouteBaseline(baseline) {
  if (!baseline || typeof baseline !== "object" || Array.isArray(baseline)) fail("baseline is unavailable.");
  if (!baseline.measurement || !baseline.routes || !baseline.assetRoles) fail("baseline has missing sections.");
  if (!equalSets(Object.keys(baseline.routes).sort(), [...publicRoutes].sort())) fail("baseline route coverage differs from the public route registry.");
  return baseline;
}

export async function loadPayloadBaseline() {
  return validateRouteBaseline(JSON.parse(await readFile(new URL("./payloadBaseline.json", import.meta.url), "utf8")));
}

export async function evaluatePayloadBudget({ outputDirectory, nextDirectory, baseline }) {
  const checkedBaseline = validateRouteBaseline(baseline ?? await loadPayloadBaseline());
  const output = path.resolve(outputDirectory);
  const next = path.resolve(nextDirectory);
  const measurements = {};
  const referencesByRoute = new Map();

  for (const route of publicRoutes) {
    const html = await readFile(path.join(output, routeFile(route)), "utf8");
    const references = initialScriptReferences(html);
    const jsBuffers = await Promise.all(references.map(async (reference) => {
      const relative = assetPathFromReference(reference);
      const [published, source] = await Promise.all([
        readFile(path.join(output, "_next", relative)),
        readFile(path.join(next, relative))
      ]);
      if (!published.equals(source)) fail(`${route} publishes a chunk that differs from .next/${relative}.`);
      return published;
    }));
    const htmlGzip = gzipSync(html).byteLength;
    const initialJsGzip = jsBuffers.reduce((total, source) => total + gzipSync(source).byteLength, 0);
    const expected = checkedBaseline.routes[route];
    if (htmlGzip > ceiling(expected.htmlGzip, checkedBaseline.measurement.slack.htmlGzip)) {
      fail(`${route} HTML gzip ${htmlGzip} exceeds ${ceiling(expected.htmlGzip, checkedBaseline.measurement.slack.htmlGzip)} bytes.`);
    }
    if (initialJsGzip > ceiling(expected.initialJsGzip, checkedBaseline.measurement.slack.initialJsGzip)) {
      fail(`${route} initial JavaScript gzip ${initialJsGzip} exceeds ${ceiling(expected.initialJsGzip, checkedBaseline.measurement.slack.initialJsGzip)} bytes.`);
    }
    if (Boolean(/<video\b/i.test(html)) !== expected.videoMarkup) fail(`${route} video markup differs from the reviewed route role.`);
    if (route !== "/research" && researchOnlyMarkers.some((marker) => html.includes(marker))) {
      fail(`${route} contains Research-only video or project data.`);
    }
    measurements[route] = { htmlGzip, initialJsGzip, initialJsFiles: references.length };
    referencesByRoute.set(route, references);
  }

  const shared = [...referencesByRoute.values()].reduce((intersection, references) =>
    new Set([...intersection].filter((reference) => references.includes(reference)))
  );
  if (shared.size === 0) fail("no shared framework chunks were emitted.");
  let frameworkInitialJsGzip = 0;
  for (const reference of shared) {
    const relative = assetPathFromReference(reference);
    frameworkInitialJsGzip += gzipSync(await readFile(path.join(next, relative))).byteLength;
  }
  if (frameworkInitialJsGzip > ceiling(checkedBaseline.measurement.frameworkInitialJsGzip, checkedBaseline.measurement.slack.frameworkInitialJsGzip)) {
    fail(`shared .next framework gzip ${frameworkInitialJsGzip} exceeds ${ceiling(checkedBaseline.measurement.frameworkInitialJsGzip, checkedBaseline.measurement.slack.frameworkInitialJsGzip)} bytes.`);
  }

  const assets = await listAssets(path.join(output, "images"));
  const roleSizes = new Map();
  for (const asset of assets) {
    const role = roleForAsset(`images/${asset.relative}`);
    if (!role) continue;
    roleSizes.set(role, Math.max(roleSizes.get(role) ?? 0, asset.size));
  }
  for (const [role, reviewedBytes] of Object.entries(checkedBaseline.assetRoles)) {
    const actualBytes = roleSizes.get(role);
    if (!actualBytes) fail(`published ${role} asset is missing.`);
    if (actualBytes > ceiling(reviewedBytes, checkedBaseline.measurement.slack.assetRoleBytes)) {
      fail(`published ${role} asset ${actualBytes} exceeds ${ceiling(reviewedBytes, checkedBaseline.measurement.slack.assetRoleBytes)} bytes.`);
    }
  }

  return { routes: measurements, frameworkInitialJsGzip, frameworkInitialJsFiles: shared.size, assetRoles: Object.fromEntries(roleSizes) };
}

function parseArguments(argv) {
  const values = new Map();
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith("--") || value === undefined || values.has(key)) fail("usage: node payloadBudget.mjs --out <static-export> --next <next-build>");
    values.set(key, value);
  }
  if (values.size !== 2 || !values.has("--out") || !values.has("--next")) fail("usage: node payloadBudget.mjs --out <static-export> --next <next-build>");
  return { outputDirectory: values.get("--out"), nextDirectory: values.get("--next") };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  evaluatePayloadBudget(parseArguments(process.argv.slice(2)))
    .then((result) => console.log(`Payload budgets passed for ${Object.keys(result.routes).length} public routes; shared framework gzip ${result.frameworkInitialJsGzip} bytes.`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
