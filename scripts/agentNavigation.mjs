import { execFileSync } from "node:child_process";
import { lstatSync, readFileSync, statSync } from "node:fs";
import { extractHeadingAnchors } from "./validateDocumentation.mjs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const expectedIds = ["home", "experience", "research", "projects", "recommendations", "skills", "legal", "resume", "contact-ui", "routes-seo", "content", "contact-functions", "migrations", "theme", "shared-ui", "motion", "skeletons", "tests", "tooling", "ci", "release", "infrastructure", "documentation"];
const specialists = ["portfolio-architecture", "portfolio-content-pipeline", "portfolio-interface-contracts", "portfolio-validation", "portfolio-release-security", "portfolio-skeleton-regression"];
const cardKeys = ["id", "card", "responsibility", "ownerPatterns", "ownerExclusions", "consumers", "entrypoints", "tests", "specialists", "authority", "commands", "triggers", "expandWhen"];
const listKeys = cardKeys.slice(3);
const exactKeys = (object, keys) => object && typeof object === "object" && !Array.isArray(object) && Object.keys(object).sort().join() === [...keys].sort().join();
const patternValid = p => typeof p === "string" && /^(?!\/)[^*\\]+?(?:\/\*\*)?$/.test(p) && !p.split("/").some(segment => segment === "." || segment === ".." || segment === "");
export function matches(pattern, file) {
  return pattern.endsWith("/**") ? file.startsWith(pattern.slice(0, -2)) : file === pattern;
}
export function ownerFor(map, file) {
  const excluded = map.excluded.filter(e => matches(e.pattern, file));
  const owners = map.cards.filter(c => c.ownerPatterns.some(p => matches(p, file)) && !c.ownerExclusions.some(p => matches(p, file)));
  return { excluded, owners };
}
export function route(map, { domain, file, task }) {
  if (domain) return map.cards.filter(c => c.id === domain).map(c => ({ card: c, reason: "domain" }));
  if (file) {
    const { owners, excluded } = ownerFor(map, file.replace(/^\.\//, ""));
    return owners.map(c => ({ card: c, reason: "primary owner" })).concat(excluded.map(e => ({ excluded: e.reason })));
  }
  const query = task.toLowerCase();
  const scored = map.cards.map(card => ({ card, score: Math.max(0, ...card.triggers.filter(t => new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`, "i").test(query)).map(t => t.length)) }));
  const max = Math.max(0, ...scored.map(s => s.score));
  return scored.filter(s => max && s.score === max).map(({ card }) => ({ card, reason: "task trigger" }));
}
function size(file) { try { return statSync(path.join(root, file)).size; } catch { return 0; } }
export function targetExists(target, projectRoot = root) {
  if (typeof target !== "string") return false;
  const parts = target.split("#");
  if (parts.length > 2) return false;
  const [file, anchor] = parts;
  if (!file || file.includes("\\") || file.includes("\0") || file.startsWith("/") || file.split("/").some(s => !s || s === "." || s === "..")) return false;
  try {
    let current = projectRoot;
    for (const segment of file.split("/")) {
      current = path.join(current, segment);
      if (lstatSync(current).isSymbolicLink()) return false;
    }
    const source = readFileSync(current, "utf8");
    return anchor === undefined || Boolean(anchor && extractHeadingAnchors(source).has(anchor));
  } catch { return false; }
}
export function validate(map, files, packageScripts, readSize = size) {
  const errors = [];
  if (!exactKeys(map, ["version", "patternSyntax", "excluded", "cards"]) || map.version !== 1 || typeof map.patternSyntax !== "string" || !Array.isArray(map.cards) || !Array.isArray(map.excluded)) return ["invalid registry schema or version"];
  if (map.cards.some(c => !c || typeof c !== "object" || Array.isArray(c)) || map.excluded.some(e => !e || typeof e !== "object" || Array.isArray(e))) return ["invalid card or exclusion schema"];
  if (map.cards.length !== expectedIds.length || new Set(map.cards.map(c => c.id)).size !== expectedIds.length || expectedIds.some(id => !map.cards.some(c => c.id === id))) errors.push("registry must contain exactly the 23 required cards");
  if (new Set(map.cards.map(c => c.card)).size !== map.cards.length) errors.push("duplicate card path");
  for (const file of files.filter(f => /^\.agents\/cards\/[^/]+\.md$/.test(f))) if (!map.cards.some(c => c.card === file)) errors.push(`unregistered card: ${file}`);
  for (const e of map.excluded) if (!exactKeys(e, ["pattern", "reason"]) || !patternValid(e.pattern) || typeof e.reason !== "string" || !e.reason.trim()) errors.push("invalid exclusion");
  for (const c of map.cards) {
    if (!exactKeys(c, cardKeys) || typeof c.id !== "string" || typeof c.card !== "string" || typeof c.responsibility !== "string" || !c.responsibility.trim() || listKeys.some(k => !Array.isArray(c[k]) || c[k].some(v => typeof v !== "string" || !v.trim()))) { errors.push(`invalid card schema: ${c.id}`); continue; }
    if (c.card !== `.agents/cards/${c.id}.md` || !targetExists(c.card)) errors.push(`missing card: ${c.id}`);
    if (!c.ownerPatterns.length || !c.entrypoints.length || !c.tests.length || !c.specialists.length || !c.authority.length || !c.commands.length || !c.triggers.length || !c.expandWhen.length) errors.push(`empty required field: ${c.id}`);
    for (const p of [...c.ownerPatterns, ...c.ownerExclusions]) if (!patternValid(p)) errors.push(`invalid pattern ${c.id}: ${p}`);
    for (const p of c.ownerPatterns) if (!files.some(f => matches(p, f) && !c.ownerExclusions.some(x => matches(x, f)))) errors.push(`unused pattern ${c.id}: ${p}`);
    for (const p of c.ownerExclusions) if (!files.some(f => matches(p, f) && c.ownerPatterns.some(x => matches(x, f)))) errors.push(`unused pattern ${c.id}: ${p}`);
    for (const id of c.consumers) if (!expectedIds.includes(id) || id === c.id) errors.push(`invalid consumer ${c.id}: ${id}`);
    for (const id of c.specialists) if (!specialists.includes(id) || !targetExists(`.agents/skills/${id}/SKILL.md`)) errors.push(`invalid specialist ${c.id}: ${id}`);
    for (const t of [...c.entrypoints, ...c.tests, ...c.authority]) if (!targetExists(t)) errors.push(`missing target ${c.id}: ${t}`);
    for (const t of c.authority) if (!t.includes("#")) errors.push(`authority needs a section ${c.id}: ${t}`);
    for (const cmd of c.commands) if (!Object.hasOwn(packageScripts, cmd)) errors.push(`stale command ${c.id}: ${cmd}`);
    if (readSize(c.card) > 2048) errors.push(`card exceeds 2048 bytes: ${c.card}`);
    const startup = ["AGENTS.md", ".agents/README.md", ".agents/knowledge/SYSTEM_DECISIONS.md", c.card, ...c.specialists.map(s => `.agents/skills/${s}/SKILL.md`)].reduce((sum, p) => sum + readSize(p), 0);
    if (startup > 12288) errors.push(`startup exceeds 12288 bytes: ${c.id}`);
  }
  for (const e of map.excluded) if (patternValid(e.pattern) && !files.some(f => matches(e.pattern, f))) errors.push(`unused exclusion: ${e.pattern}`);
  // Avoid operating on malformed cards after reporting schema errors.
  if (errors.some(e => e.startsWith("invalid card schema") || e === "invalid exclusion")) return errors;
  for (const f of files) {
    const { excluded, owners } = ownerFor(map, f);
    for (const c of map.cards) {
      if (!c.ownerExclusions.some(p => matches(p, f)) && c.ownerPatterns.filter(p => matches(p, f)).length > 1) errors.push(`${f}: overlapping patterns in ${c.id}`);
    }
    if (excluded.length > 1 || (excluded.length && owners.length) || (!excluded.length && owners.length !== 1)) errors.push(`${f}: ${excluded.length} exclusions, ${owners.length} owners${owners.length ? ` (${owners.map(c => c.id).join(", ")})` : ""}`);
  }
  const core = ["AGENTS.md", ".agents/README.md", ".agents/knowledge/SYSTEM_DECISIONS.md"].reduce((sum, p) => sum + readSize(p), 0);
  if (core > 6144) errors.push(`core exceeds 6144 bytes: ${core}`);
  for (const s of specialists) if (readSize(`.agents/skills/${s}/SKILL.md`) > 4096) errors.push(`specialist exceeds 4096 bytes: ${s}`);
  return errors;
}
function main(args) {
  const map = JSON.parse(readFileSync(path.join(root, ".agents/agent-map.json"), "utf8"));
  if (args.length === 1 && args[0] === "--check") {
    const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { cwd: root, encoding: "utf8" }).split("\0").filter(Boolean);
    const errors = validate(map, [...new Set(files)], JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts);
    if (errors.length) { console.error(errors.join("\n")); process.exitCode = 1; } else console.log("Agent registry valid.");
    return;
  }
  const json = args.includes("--json");
  const rest = args.filter(a => a !== "--json");
  if (!rest.length) {
    if (json) console.log(JSON.stringify(map.cards.map(c => ({ id: c.id, card: c.card, responsibility: c.responsibility })), null, 2));
    else console.log(map.cards.map(c => `${c.id}: ${c.responsibility}`).join("\n"));
    return;
  }
  if (rest.length !== 2 || !["--domain", "--path", "--task"].includes(rest[0]) || !rest[1] || rest[1].startsWith("--")) throw new Error("Usage: agents:route -- --domain ID | --path PATH | --task TEXT [--json]");
  const key = { "--domain": "domain", "--path": "file", "--task": "task" }[rest[0]];
  const results = route(map, { [key]: rest[1] });
  if (json) console.log(JSON.stringify(results.map(r => r.card ? { id: r.card.id, reason: r.reason, card: r.card.card, entrypoints: r.card.entrypoints, tests: r.card.tests, consumers: r.card.consumers, specialists: r.card.specialists, authority: r.card.authority, commands: r.card.commands } : r), null, 2));
  else if (!results.length) console.log("No match; select a domain or inspect the registry.");
  else if (results.length > 1) console.log(`Ambiguous: ${results.map(r => r.card?.id ?? "excluded").join(", ")}; select --domain or --path.`);
  else if (results[0].excluded) console.log(`Excluded: ${results[0].excluded}`);
  else { const { card, reason } = results[0]; console.log(`${card.id} (${reason}): ${card.responsibility}\nCard: ${card.card}\nEntrypoints: ${card.entrypoints.join(", ")}\nTests: ${card.tests.join(", ")}\nConsumers: ${card.consumers.join(", ") || "none recorded"}\nSpecialists: ${card.specialists.join(", ")}\nAuthority: ${card.authority.join(", ")}\nChecks: ${card.commands.map(c => `npm run ${c}`).join(", ")}`); }
  if (results.length !== 1) process.exitCode = 1;
}
if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) { try { main(process.argv.slice(2)); } catch (error) { console.error(error.message); process.exitCode = 1; } }
