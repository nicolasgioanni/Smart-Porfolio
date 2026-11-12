import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ownerFor, route, targetExists, validate } from "./agentNavigation.mjs";
import { execFileSync } from "node:child_process";

const map = JSON.parse(readFileSync(".agents/agent-map.json", "utf8"));
const scripts = JSON.parse(readFileSync("package.json", "utf8")).scripts;
const files = execFileSync("git", ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], { encoding: "utf8" }).split("\0").filter(Boolean);
const clone = () => structuredClone(map);

describe("agent navigation", () => {
  it("covers maintained paths and budgets with the checked-in registry", () => {
    expect(validate(map, files, scripts)).toEqual([]);
  });
  it.each([
    ["theme transition", "theme"], ["contact endpoint delivery", "contact-functions"],
    ["workbook content", "content"], ["no javascript fallback", "routes-seo"],
    ["skeleton alignment", "skeletons"], ["CI rerun evidence", "ci"],
    ["Terraform plan policy", "infrastructure"], ["agent navigation documentation", "documentation"],
  ])("routes %s to %s", (task, id) => {
    expect(route(map, { task }).map(r => r.card.id)).toEqual([id]);
  });
  it.each([
    ["src/lib/contact/validation.ts", "contact-functions"],
    ["src/lib/contact/ianaTlds.ts", "contact-functions"],
    ["scripts/contactTransport.integration.test.ts", "contact-functions"],
    ["scripts/updateContactTlds.mjs", "contact-functions"],
    ["scripts/updateContactTlds.test.mjs", "contact-functions"],
    ["scripts/d1Configuration.test.mjs", "migrations"],
    ["scripts/d1Reservation.integration.test.ts", "migrations"],
    ["next.config.mjs", "release"],
    ["scripts/nextBuildAdapter.mjs", "release"],
    ["scripts/normalizeNextStaticExport.mjs", "release"],
    ["scripts/normalizeNextStaticExport.test.mjs", "release"],
  ])("routes %s to its %s primary owner", (file, id) => {
    expect(route(map, { file }).map(result => result.card.id)).toEqual([id]);
  });
  it("distinguishes a primary owner, consumers, and excluded generated content", () => {
    expect(ownerFor(map, "src/lib/theme/themeTransition.ts").owners.map(c => c.id)).toEqual(["theme"]);
    expect(map.cards.find(c => c.id === "theme").consumers).toContain("shared-ui");
    expect(ownerFor(map, "src/content/generated/portfolio.generated.json").excluded).toHaveLength(1);
  });
  it("lists a compact default index in text and JSON", () => {
    const run = args => execFileSync(process.execPath, ["scripts/agentNavigation.mjs", ...args], { encoding: "utf8" });
    expect(run([])).toContain("theme: Theme preference");
    expect(JSON.parse(run(["--json"]))).toHaveLength(23);
  });
  it("rejects linked paths and traversal while using Markdown anchor rules", () => {
    const dir = mkdtempSync(path.join(tmpdir(), "agent-registry-"));
    try {
      mkdirSync(path.join(dir, "docs"));
      writeFileSync(path.join(dir, "docs", "guide.md"), "# Heading\n\n## Repeated\n## Repeated\n\n```md\n## Hidden\n```\n");
      symlinkSync("docs", path.join(dir, "linked"));
      symlinkSync("guide.md", path.join(dir, "docs", "alias.md"));
      expect(targetExists("docs/guide.md#repeated-1", dir)).toBe(true);
      expect(targetExists("docs/guide.md#hidden", dir)).toBe(false);
      expect(targetExists("linked/guide.md", dir)).toBe(false);
      expect(targetExists("docs/alias.md", dir)).toBe(false);
      expect(targetExists("../outside", dir)).toBe(false);
    } finally { rmSync(dir, { recursive: true, force: true }); }
  });
  it("rejects malformed cards and duplicate paths without throwing", () => {
    expect(validate({ ...map, cards: [null] }, files, scripts)).toContain("invalid card or exclusion schema");
    const broken = clone();
    broken.cards[0].card = broken.cards[1].card;
    expect(validate(broken, files, scripts)).toContain("duplicate card path");
    broken.cards[0].ownerPatterns = "invalid";
    expect(validate(broken, files, scripts).join("\n")).toContain("invalid card schema");
  });
  it("rejects unregistered cards", () => {
    expect(validate(map, [...files, ".agents/cards/orphan.md"], scripts).join("\n")).toContain("unregistered card: .agents/cards/orphan.md");
  });
  it("routes the CLI as JSON and reports a generic contact ambiguity", () => {
    const output = execFileSync(process.execPath, ["scripts/agentNavigation.mjs", "--path", "src/app/RouteSkeleton.tsx", "--json"], { encoding: "utf8" });
    expect(JSON.parse(output)[0]).toMatchObject({ id: "skeletons", reason: "primary owner", entrypoints: ["src/app/RouteSkeleton.tsx"], tests: ["tests/e2e/skeleton-alignment.spec.ts"] });
    expect(route(map, { task: "contact" }).map(r => r.card.id)).toEqual(["contact-ui", "contact-functions"]);
  });
  it("exposes ambiguity and no match without guessing", () => {
    expect(route(map, { task: "theme legal" }).map(r => r.card.id)).toEqual(["legal", "theme"]);
    expect(route(map, { task: "unmatched phrase" })).toEqual([]);
  });
  it("rejects missing, ambiguous and unused ownership patterns", () => {
    const broken = clone();
    broken.cards[0].ownerPatterns.push("src/lib/theme/**", "missing-path/**");
    const errors = validate(broken, [...files, "unowned-file"], scripts).join("\n");
    expect(errors).toContain("unused pattern home: missing-path/**");
    expect(errors).toContain("unowned-file: 0 exclusions, 0 owners");
    expect(errors).toContain("src/lib/theme/themeTransition.ts: 0 exclusions, 2 owners");
  });
  it("enforces all byte budgets", () => {
    const errors = validate(map, files, scripts, () => 5000).join("\n");
    expect(errors).toContain("core exceeds 6144 bytes");
    expect(errors).toContain("card exceeds 2048 bytes");
    expect(errors).toContain("specialist exceeds 4096 bytes");
    expect(errors).toContain("startup exceeds 12288 bytes");
  });
  it("rejects duplicate overlapping rules within one owner", () => {
    const broken = clone();
    broken.cards[0].ownerPatterns.push(broken.cards[0].ownerPatterns[0]);
    expect(validate(broken, files, scripts).join("\n")).toContain("overlapping patterns in home");
  });
  it("rejects missing cards, stale commands, anchors, and unknown fields", () => {
    const broken = clone();
    broken.cards.pop();
    broken.cards[0].commands.push("not-a-script");
    broken.cards[1].authority.push("docs/quality/TESTING.md#missing-anchor");
    broken.cards[2].surprise = true;
    const errors = validate(broken, files, scripts).join("\n");
    expect(errors).toContain("exactly the 23 required cards");
    expect(errors).toContain("stale command");
    expect(errors).toContain("missing target");
    expect(errors).toContain("invalid card schema");
  });
});
