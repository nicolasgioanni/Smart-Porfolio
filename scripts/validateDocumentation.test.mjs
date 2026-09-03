import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { validateDocumentation } from "./validateDocumentation.mjs";

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
