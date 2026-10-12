import { createHash } from "node:crypto";
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const pagesHeaderLimit = 2_000;
export const pagesHeaderRuleLimit = 100;

const commonHeaders = `  Permissions-Policy: camera=(), geolocation=(), microphone=(), payment=(), usb=()
  Referrer-Policy: strict-origin-when-cross-origin
  Strict-Transport-Security: max-age=31536000
  X-Content-Type-Options: nosniff
  X-Frame-Options: DENY`;
const basePolicy = "default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; connect-src 'self' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com";

function routeForHtml(outDirectory, htmlPath) {
  const relative = path.relative(outDirectory, htmlPath).split(path.sep).join("/");
  if (relative === "index.html") return "/";
  if (relative.endsWith("/index.html")) return `/${relative.slice(0, -"/index.html".length)}`;
  return `/${relative.slice(0, -".html".length)}`;
}

async function htmlFiles(root, current = root) {
  const result = [];
  for (const entry of await readdir(current, { withFileTypes: true })) {
    const filePath = path.join(current, entry.name);
    if (entry.isDirectory()) result.push(...await htmlFiles(root, filePath));
    else if (entry.isFile() && entry.name.endsWith(".html")) result.push(filePath);
  }
  return result.sort((left, right) => left.localeCompare(right));
}

export function hashesForInlineScripts(html) {
  const hashes = new Set();
  for (const match of html.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)) {
    if (/\bsrc\s*=/i.test(match[1] ?? "")) continue;
    const source = match[2] ?? "";
    if (source) hashes.add(`'sha256-${createHash("sha256").update(source).digest("base64")}'`);
  }
  return [...hashes].sort();
}

export function cspForHashes(hashes) {
  const policy = `${basePolicy}; script-src ${["'self'", ...hashes, "https://challenges.cloudflare.com"].join(" ")}`;
  if (Buffer.byteLength(`Content-Security-Policy: ${policy}`, "utf8") > pagesHeaderLimit) {
    throw new Error(`Generated Content-Security-Policy exceeds Cloudflare Pages' ${pagesHeaderLimit}-character header limit`);
  }
  return policy;
}

function routeAliases(route) {
  return route === "/" ? ["/", "/index.html"] : [route, `${route}/`, `${route}.html`];
}

function metadataHeaders(route) {
  return `${route}\n  Cache-Control: no-store, no-cache, must-revalidate, max-age=0\n  Pragma: no-cache\n  Expires: 0`;
}

/** Replaces the exported intermediate headers with page-specific CSP hashes. */
export async function createStaticCsp(outDirectory) {
  const out = path.resolve(outDirectory);
  const routes = new Map();
  for (const htmlFile of await htmlFiles(out)) {
    const route = routeForHtml(out, htmlFile);
    const csp = cspForHashes(hashesForInlineScripts(await readFile(htmlFile, "utf8")));
    const previous = routes.get(route);
    if (previous && previous !== csp) throw new Error(`Multiple HTML files produce incompatible CSP for ${route}`);
    routes.set(route, csp);
  }
  if (!routes.size) throw new Error("Static export contains no HTML routes for CSP generation");
  const fallback = routes.get("/404") ?? routes.get("/_not-found") ?? routes.get("/");
  const routePolicies = [...routes.entries()].flatMap(([route, csp]) => routeAliases(route).map((alias) => [alias, csp]));
  if (routePolicies.length + 3 > pagesHeaderRuleLimit) {
    throw new Error(`Generated Pages header rules exceed the ${pagesHeaderRuleLimit}-rule limit`);
  }
  const routeHeaders = routePolicies
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([route, csp]) => `${route}\n  ! Content-Security-Policy\n  Content-Security-Policy: ${csp}`)
    .join("\n\n");
  const headers = `/*\n${commonHeaders}\n  Content-Security-Policy: ${fallback}\n\n${routeHeaders}\n\n${metadataHeaders("/content-version.json")}\n\n${metadataHeaders("/artifact-integrity.json")}\n`;
  await writeFile(path.join(out, "_headers"), headers, "utf8");
  return { routes: Object.fromEntries(routes), headers };
}

const direct = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (direct) {
  createStaticCsp(process.argv[2] ?? "out").catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
