import { createHash } from "node:crypto";
import { lstat, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const defaultStaticExportDirectory = path.join(projectRoot, "out");
export const cloudflareHeaderLineLimit = 2_000;
export const cloudflareHeaderRuleLimit = 100;
const generatedSectionMarker = "# Generated static CSP rules. Do not edit: scripts/staticResponseHeaders.mjs.";
const inlineScriptPattern = /<script\b([^>]*)>([\s\S]*?)<\/script\s*>/gi;
const externalScriptAttributePattern = /(?:^|\s)src\s*=/i;

const staticResponseHeaders = [
  "Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()",
  "Referrer-Policy: strict-origin-when-cross-origin",
  "Strict-Transport-Security: max-age=31536000",
  "X-Content-Type-Options: nosniff",
  "X-Frame-Options: DENY"
];

function isGeneratedSection(source) {
  return source.indexOf(generatedSectionMarker);
}

function withoutGeneratedSection(source) {
  const markerIndex = isGeneratedSection(source);
  return (markerIndex === -1 ? source : source.slice(0, markerIndex)).trimEnd();
}

export function createStaticScriptHash(scriptContent) {
  return `'sha256-${createHash("sha256").update(scriptContent, "utf8").digest("base64")}'`;
}

export function extractInlineScriptContents(html) {
  const contents = [];

  for (const match of html.matchAll(inlineScriptPattern)) {
    const [, attributes, content] = match;
    if (externalScriptAttributePattern.test(attributes ?? "")) continue;
    contents.push(content ?? "");
  }

  return contents;
}

export function extractInlineScriptHashes(html) {
  return [...new Set(extractInlineScriptContents(html).map(createStaticScriptHash))].sort();
}

export function createStaticContentSecurityPolicy(scriptHashes) {
  return [
    "default-src 'self'",
    "base-uri 'self'",
    "object-src 'none'",
    "frame-ancestors 'none'",
    "form-action 'self'",
    `script-src 'self' ${scriptHashes.join(" ")} https://challenges.cloudflare.com`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https:",
    "font-src 'self' data:",
    "connect-src 'self' https://challenges.cloudflare.com",
    "frame-src https://challenges.cloudflare.com"
  ].join("; ");
}

async function collectExportedHtml(exportDirectory, directory = exportDirectory, files = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Static export contains an unsupported symbolic link: ${entryPath}`);
    }
    if (entry.isDirectory()) {
      await collectExportedHtml(exportDirectory, entryPath, files);
    } else if (entry.isFile() && entry.name.endsWith(".html")) {
      files.push(entryPath);
    }
  }
  return files.sort((left, right) => left.localeCompare(right));
}

function routesForHtmlFile(exportDirectory, filePath) {
  const relativePath = path.relative(exportDirectory, filePath).split(path.sep).join("/");
  const htmlRoute = `/${relativePath}`;
  const cleanRoute = relativePath === "index.html" ? "/" : `/${relativePath.slice(0, -".html".length)}`;
  return cleanRoute === htmlRoute ? [htmlRoute] : [cleanRoute, htmlRoute];
}

function renderHeaderRule(route, headers) {
  return [route, ...headers.map((header) => `  ${header}`)].join("\n");
}

export function assertCloudflareHeaderLimits(headerFile) {
  const lines = headerFile.split("\n");
  let ruleCount = 0;

  for (const line of lines) {
    if (Buffer.byteLength(line, "utf8") > cloudflareHeaderLineLimit) {
      throw new Error(
        `Cloudflare Pages header line exceeds ${cloudflareHeaderLineLimit.toLocaleString("en-US")} bytes: ${line.slice(0, 80)}`
      );
    }
    if (!line || line.startsWith("#")) continue;
    if (!line.startsWith(" ")) {
      ruleCount += 1;
      continue;
    }
  }

  if (ruleCount > cloudflareHeaderRuleLimit) {
    throw new Error(
      `Cloudflare Pages header rules exceed the ${cloudflareHeaderRuleLimit} rule limit: ${ruleCount} generated rules`
    );
  }
}

export async function writeStaticResponseHeaders(exportDirectory = defaultStaticExportDirectory) {
  const exportRoot = path.resolve(exportDirectory);
  const exportStat = await lstat(exportRoot);
  if (!exportStat.isDirectory() || exportStat.isSymbolicLink()) {
    throw new Error(`Static export root must be a real directory: ${exportRoot}`);
  }

  const headerFilePath = path.join(exportRoot, "_headers");
  const headerTemplate = withoutGeneratedSection(await readFile(headerFilePath, "utf8"));
  if (/^\s*Content-Security-Policy\s*:/mi.test(headerTemplate)) {
    throw new Error("Static header template must not define Content-Security-Policy before CSP hashes are generated.");
  }
  for (const header of staticResponseHeaders) {
    if (!headerTemplate.includes(`  ${header}`)) {
      throw new Error(`Static header template is missing the required header: ${header}`);
    }
  }

  const htmlFiles = await collectExportedHtml(exportRoot);
  if (htmlFiles.length === 0) throw new Error(`Static export contains no HTML files: ${exportRoot}`);

  const allScriptHashes = new Set();
  const generatedRules = [];
  for (const htmlFile of htmlFiles) {
    const scriptHashes = extractInlineScriptHashes(await readFile(htmlFile, "utf8"));
    for (const scriptHash of scriptHashes) allScriptHashes.add(scriptHash);
    const policy = `Content-Security-Policy: ${createStaticContentSecurityPolicy(scriptHashes)}`;
    for (const route of routesForHtmlFile(exportRoot, htmlFile)) {
      generatedRules.push(renderHeaderRule(route, [policy]));
    }
  }

  // Cloudflare applies matching _headers rules cumulatively. The generated
  // fallback therefore contains every final-HTML hash, so it cannot block a
  // narrower route policy or an unknown path served through 404.html.
  generatedRules.unshift(
    renderHeaderRule("/*", [`Content-Security-Policy: ${createStaticContentSecurityPolicy([...allScriptHashes].sort())}`])
  );

  const output = `${headerTemplate}\n\n${generatedSectionMarker}\n${generatedRules.join("\n\n")}\n`;
  assertCloudflareHeaderLimits(output);
  await writeFile(headerFilePath, output, "utf8");

  return { htmlFileCount: htmlFiles.length, ruleCount: generatedRules.length };
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  writeStaticResponseHeaders(process.argv[2] ? path.resolve(process.argv[2]) : defaultStaticExportDirectory)
    .then(({ htmlFileCount, ruleCount }) => {
      console.log(`Generated CSP hash rules for ${htmlFileCount} exported HTML file(s) across ${ruleCount} route rules.`);
    })
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
