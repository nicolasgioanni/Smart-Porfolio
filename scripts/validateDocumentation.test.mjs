import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateDocumentation } from "./validateDocumentation.mjs";
import { indexableSiteRoutePaths, siteRoutePaths } from "../src/lib/routing/siteRoutes.ts";

async function createFixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-docs-test-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, "utf8");
  }

  return root;
}

describe("documentation validation", () => {
  it("keeps the documented route inventory and indexing list aligned with the registry", async () => {
    const rootReadme = await readFile(path.resolve("README.md"), "utf8");
    const structure = await readFile(path.resolve("docs/architecture/PROJECT_STRUCTURE.md"), "utf8");
    const search = await readFile(path.resolve("docs/operations/SEARCH_INDEXING.md"), "utf8");
    const routeRows = (source, heading) => {
      const section = source.split(`## ${heading}\n`)[1]?.split("\n## ")[0] ?? "";
      return [...section.matchAll(/^\| `([^`]+)` \|/gm)].map((match) => match[1]);
    };
    const ordered = (routes) => [...routes].sort();
    const indexingSection = search.split("## Route policy")[1].split("## Generated search files")[0];
    const indexedRoutes = [...indexingSection.matchAll(/^\d+\. `([^`]+)`$/gm)].map((match) => match[1]);
    expect(ordered(routeRows(rootReadme, "Documented route map"))).toEqual(ordered(siteRoutePaths));
    expect(ordered(routeRows(structure, "Documented application routes"))).toEqual(ordered(siteRoutePaths));
    const staleReadme = rootReadme.replace("\n## Technology and project role", "\n| `/retired` | Stale route | Removed |\n\n## Technology and project role");
    expect(ordered(routeRows(staleReadme, "Documented route map"))).not.toEqual(ordered(siteRoutePaths));
    expect(indexedRoutes).toEqual(indexableSiteRoutePaths);
    for (const phrase of ["absolute canonical URLs", "URLs", "discovered URLs"]) {
      expect(search).toContain(`${indexableSiteRoutePaths.length} ${phrase}`);
    }
  });

  it("indexes each maintained guide and validates infrastructure and agent guidance", async () => {
    const result = await validateDocumentation();
    const index = await readFile(path.resolve("docs/README.md"), "utf8");
    const guides = result.checkedFiles.filter((file) => file.startsWith("docs/") && file !== "docs/README.md" && !file.startsWith("docs/quality/evidence/"));
    expect(guides.length).toBeGreaterThan(0);
    for (const guide of guides) expect(index).toContain(`(${guide.slice("docs/".length)})`);
    expect(result.checkedFiles).toEqual(expect.arrayContaining(["infra/README.md", "infra/ADOPTION.md", "AGENTS.md", ".agents/README.md"]));
    expect(result.errors).toEqual([]);
  });

  it("accepts a linked documentation set with balanced structure", async () => {
    const root = await createFixture({
      "README.md":
        "# Project\n\nSee [documentation](docs/README.md), [the app](/contact), [the resume request route](/resume), and ![hero](/images/hero.png).\n\nThe public workbook must not contain a resume worksheet.\n\nA slug can match `^[a-z0-9][a-z0-9-]*$`.\n",
      "docs/README.md":
        "# Documentation\n\nSee [guide](GUIDE_(v1).md#deep-dive) and ![diagram](assets/diagram.png).\n",
      "docs/GUIDE_(v1).md":
        "# Guide\n\n## Deep dive\n\n```bash\nnpm run verify\n```\n",
      "docs/assets/diagram.png": "fixture",
      "public/images/hero.png": "fixture",
    });

    try {
      await expect(
        validateDocumentation({ projectRoot: root }),
      ).resolves.toEqual({
        checkedFiles: ["README.md", "docs/GUIDE_(v1).md", "docs/README.md"],
        errors: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("parses nested and escaped Markdown destinations without unbounded regular-expression matching", async () => {
    const root = await createFixture({
      "README.md": `# Project\n\n[Nested guide](docs/GUIDE_(v1).md "reference")\n\n[Escaped guide](docs/GUIDE\\_(v1).md)\n\n[Incomplete](${"\\!".repeat(20_000)}`,
      "docs/GUIDE_(v1).md": "# Guide\n",
    });

    try {
      await expect(validateDocumentation({ projectRoot: root })).resolves.toMatchObject({ errors: [] });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("scans long unmatched Markdown labels and parentheses in linear time", async () => {
    const unmatchedSource = `${"[".repeat(15_000)}](${"(".repeat(15_000)}`;
    const root = await createFixture({
      "README.md": `# Project\n\n${unmatchedSource}`,
      "docs/README.md": "# Documentation\n",
    });

    try {
      await expect(validateDocumentation({ projectRoot: root })).resolves.toMatchObject({ errors: [] });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("does not rescan unterminated angle destinations for every later label", async () => {
    const root = await createFixture({
      "README.md": `# Project\n\n${"[x](<".repeat(160_000)}`,
      "docs/README.md": "# Documentation\n",
    });

    try {
      await expect(validateDocumentation({ projectRoot: root })).resolves.toMatchObject({ errors: [] });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each([
    ["bare", "[unfinished](somewhere\n\n[Missing](docs/MISSING.md)", "docs/MISSING.md"],
    ["nested", "[unfinished](somewhere(\n\n[Missing](docs/MISSING-NESTED.md)", "docs/MISSING-NESTED.md"],
    ["angle", "[unfinished](<somewhere\n\n[Missing](docs/MISSING-ANGLE.md)", "docs/MISSING-ANGLE.md"],
  ])("recovers from an incomplete %s link at a paragraph boundary and validates the next link", async (_kind, source, target) => {
    const root = await createFixture({
      "README.md": `# Project\n\n${source}\n`,
      "docs/README.md": "# Documentation\n",
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining(`relative link target does not exist: ${target}`)]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("reports structural, privacy, placeholder, and relative-link failures", async () => {
    const root = await createFixture({
      "README.md": "# Project\n# Duplicate\n\n[Wrong case](docs/guide.md)\n",
      "docs/GUIDE.md": [
        "# Guide",
        "",
        "TODO",
        "",
        "C:\\Users\\Example\\private.txt",
        "",
        'PORTFOLIO_WORKBOOK_URL="https://example.com/private.xlsx"',
        "",
        "```text",
        "unclosed",
      ].join("\n"),
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("expected exactly one H1, found 2"),
          expect.stringContaining("capitalization does not match"),
          expect.stringContaining("unclosed fenced code block"),
          expect.stringContaining("absolute Windows user path"),
          expect.stringContaining("private-workbook URL pattern"),
          expect.stringContaining("obvious unresolved placeholder"),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects missing Markdown fragments and undefined reference links", async () => {
    const root = await createFixture({
      "README.md": [
        "# Project",
        "",
        "[Missing section](docs/GUIDE.md#missing-section)",
        "",
        "[Undefined guide][missing-guide]",
      ].join("\n"),
      "docs/GUIDE.md": "# Guide\n\n## Existing section\n",
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Markdown heading fragment does not exist"),
          expect.stringContaining(
            "reference link has no definition: missing-guide",
          ),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("validates HTML links and rejects unsafe environment, generated, and root-asset targets", async () => {
    const root = await createFixture({
      "README.md":
        '# Project\n\n<a href="docs/GUIDE.md#guide">Guide</a>\n\n![Missing](/images/missing.png)\n',
      "docs/GUIDE.md": [
        "# Guide",
        "",
        "[Environment](../.env.local)",
        "",
        "[Generated](../out/index.html)",
      ].join("\n"),
      ".env.local": "SECRET=fixture",
      "out/index.html": "fixture",
      "public/images/present.png": "fixture",
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("links to a local environment file"),
          expect.stringContaining("links into a generated output directory"),
          expect.stringContaining("root-relative asset target does not exist"),
        ]),
      );
      expect(result.errors).not.toEqual(
        expect.arrayContaining([
          expect.stringContaining("docs/GUIDE.md#guide"),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("includes maintained infrastructure guides and checks their bodies", async () => {
    const root = await createFixture({
      "README.md": "# Project\n",
      "docs/README.md": "# Docs\n",
      "infra/README.md": "# Infrastructure\n\n[Adoption](ADOPTION.md#sequence)\n",
      "infra/ADOPTION.md": "# Adoption\n\n## Sequence\n\n[Missing](missing.md)\n\nhttps://docs.google.com/spreadsheets/private\n",
    });
    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.checkedFiles).toEqual(expect.arrayContaining(["infra/README.md", "infra/ADOPTION.md"]));
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("infra/ADOPTION.md: contains a private-workbook URL pattern"),
        expect.stringContaining("relative link target does not exist: missing.md"),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects escapes and symbolic links in relative and public asset targets", async () => {
    const root = await createFixture({
      "README.md": "# Project\n\n[Escape](../outside.md)\n\n[Encoded](/%2e%2e/outside)\n\n[Linked](alias/guide.md)\n\n![Linked asset](/images/link.png)\n",
      "docs/README.md": "# Docs\n",
      "real/guide.md": "# Guide\n",
      "public/images/image.png": "fixture",
    });
    try {
      await symlink(path.join(root, "real"), path.join(root, "alias"), "dir");
      await symlink(path.join(root, "public/images/image.png"), path.join(root, "public/images/link.png"));
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(expect.arrayContaining([
        expect.stringContaining("relative link escapes the repository"),
        expect.stringContaining("root-relative asset link escapes public/"),
        expect.stringContaining("relative link target contains a symbolic link"),
        expect.stringContaining("root-relative asset target contains a symbolic link"),
      ]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it.each(["description: []", "description: |", "description: first\ndescription: second", "description: # comment"])("rejects malformed skill field %s", async (field) => {
    const root = await createFixture({
      "README.md": "# Project\n",
      "docs/README.md": "# Docs\n",
      ".agents/skills/example/SKILL.md": `---\nname: example\n${field}\n---\n\n# Example\n`,
    });
    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(expect.arrayContaining([expect.stringContaining("skill frontmatter requires a description")]));
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("allows localhost only in approved local-development documents", async () => {
    const root = await createFixture({
      "README.md": "# Project\n\nUse http://localhost:3000 locally.\n",
      "docs/GUIDE.md":
        "# Guide\n\nDo not publish http://localhost:3000 here.\n",
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual([
        "docs/GUIDE.md: contains a localhost URL outside an approved local-development document",
      ]);
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("allows and validates repository-local agent guidance", async () => {
    const root = await createFixture({
      "README.md": "# Project\n\n[Agent guidance](AGENTS.md)\n",
      "AGENTS.md": "# Agent guidance\n\nUse [the skill](.agents/skills/example/SKILL.md).\n",
      ".agents/skills/example/SKILL.md": "---\nname: example\ndescription: Example repository guidance.\n---\n\n# Example\n\nUse an MCP tool when the task needs one.\n",
      "docs/GUIDE.md": "# Guide\n\nThis guide can describe Codex workflows.\n",
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual([]);
      expect(result.checkedFiles).toEqual(
        expect.arrayContaining([
          "AGENTS.md",
          ".agents/skills/example/SKILL.md",
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

 it("rejects an invalid repository skill identity", async () => {
    const root = await createFixture({
      "README.md": "# Project\n",
      "docs/GUIDE.md": "# Guide\n",
      ".agents/skills/example/SKILL.md": "---\nname: different\n---\n\n# Example\n",
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          ".agents/skills/example/SKILL.md: skill name must match its directory",
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a skill with an empty description before another key", async () => {
    const root = await createFixture({
      "README.md": "# Project\n",
      "docs/GUIDE.md": "# Guide\n",
      ".agents/skills/example/SKILL.md": "---\nname: example\ndescription:\nmetadata: ignored\n---\n\n# Example\n",
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          ".agents/skills/example/SKILL.md: skill frontmatter requires a description",
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
