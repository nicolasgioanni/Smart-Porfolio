import { mkdtemp, mkdir, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { describe, expect, it } from "vitest";
import { validateDocumentation } from "./validateDocumentation.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const execFileAsync = promisify(execFile);

async function createFixture(files) {
  const root = await mkdtemp(path.join(os.tmpdir(), "portfolio-docs-test-"));

  for (const [relativePath, contents] of Object.entries(files)) {
    const filePath = path.join(root, relativePath);
    await mkdir(path.dirname(filePath), { recursive: true });
    await writeFile(filePath, contents, "utf8");
  }

  return root;
}

function validateMinimalFixture(projectRoot) {
  return validateDocumentation({ projectRoot, requireOwnershipMap: false });
}

function headingForAnchor(anchor) {
  return "## " + anchor.replaceAll("-", " ") + "\n";
}

function samplePathForPattern(pattern) {
  return pattern.replaceAll("**", "fixture").replaceAll("*", "fixture");
}

async function createOwnershipFixture(mutateManifest = () => {}) {
  const baselineManifest = JSON.parse(
    await readFile(
      path.join(projectRoot, ".agents", "ownership-manifest.json"),
      "utf8",
    ),
  );
  const manifest = structuredClone(baselineManifest);
  mutateManifest(manifest);
  const files = {
    "README.md": "# Project\n",
    "AGENTS.md": "# Agent guidance\n",
    ".agents/README.md": "# Agent map\n",
    ".agents/knowledge/SYSTEM_DECISIONS.md": "# System decisions\n",
    "docs/development/AGENT_MAP.md": "# Agent map\n",
  };
  const documentAnchors = new Map();
  const addFile = (relativePath, contents = "") => {
    if (!(relativePath in files)) files[relativePath] = contents;
  };

  for (const owner of baselineManifest.owners) {
    addFile(owner.card, await readFile(path.join(projectRoot, owner.card), "utf8"));
    for (const relativePath of [
      ...owner.entrypoints,
      ...owner.tests,
      ...owner.reuse,
    ]) {
      addFile(
        relativePath,
        relativePath.startsWith(".agents/skills/")
          ? await readFile(path.join(projectRoot, relativePath), "utf8")
          : "",
      );
    }
    for (const pattern of owner.pathPatterns) addFile(samplePathForPattern(pattern));
    for (const reference of owner.documentation) {
      const [relativePath, anchor] = reference.split("#");
      const anchors = documentAnchors.get(relativePath) ?? [];
      anchors.push(anchor);
      documentAnchors.set(relativePath, anchors);
    }
  }
  for (const exception of baselineManifest.codePathExceptions)
    addFile(exception.path);
  for (const [relativePath, anchors] of documentAnchors) {
    files[relativePath] = [
      "# Document",
      "",
      ...anchors.map((anchor) => headingForAnchor(anchor)),
    ].join("\n");
  }

  const sourcePackage = JSON.parse(
    await readFile(path.join(projectRoot, "package.json"), "utf8"),
  );
  files["package.json"] = JSON.stringify({
    scripts: Object.fromEntries(
      Object.keys(sourcePackage.scripts).map((name) => [name, "true"]),
    ),
  });
  files[".agents/ownership-manifest.json"] = JSON.stringify(manifest);
  return createFixture(files);
}

async function createGitOwnershipFixture(mutateManifest = () => {}) {
  const root = await createOwnershipFixture(mutateManifest);
  await writeFile(
    path.join(root, ".gitignore"),
    await readFile(path.join(projectRoot, ".gitignore"), "utf8"),
    "utf8",
  );
  await execFileAsync("git", ["init", "--quiet"], { cwd: root });
  return root;
}

async function expectOwnershipError(mutateManifest, expectedMessage) {
  const root = await createOwnershipFixture(mutateManifest);
  try {
    const result = await validateDocumentation({ projectRoot: root });
    expect(result.errors).toEqual(
      expect.arrayContaining([expect.stringContaining(expectedMessage)]),
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
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
        validateMinimalFixture(root),
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
      const result = await validateMinimalFixture(root);
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
      const result = await validateMinimalFixture(root);
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
      const result = await validateMinimalFixture(root);
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
      const result = await validateMinimalFixture(root);
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
      const result = await validateMinimalFixture(root);
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
      const result = await validateMinimalFixture(root);
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
      const result = await validateMinimalFixture(root);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          ".agents/skills/example/SKILL.md: skill frontmatter requires a description",
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts a complete ownership map with direct cards", async () => {
    const root = await createOwnershipFixture();

    try {
      await expect(validateDocumentation({ projectRoot: root })).resolves.toMatchObject({
        errors: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires every bootstrap file and the ownership manifest by default", async () => {
    const root = await createFixture({
      "README.md": "# Project\n",
      "docs/README.md": "# Documentation\n",
    });

    try {
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          ".agents/ownership-manifest.json: required bootstrap file is missing: AGENTS.md",
          ".agents/ownership-manifest.json: required bootstrap file is missing: .agents/README.md",
          ".agents/ownership-manifest.json: required bootstrap file is missing: .agents/knowledge/SYSTEM_DECISIONS.md",
          ".agents/ownership-manifest.json: required ownership manifest is missing",
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects moved, private, and legacy feature ownership paths", async () => {
    await expectOwnershipError((manifest) => {
      manifest.owners.find((owner) => owner.id === "routes-metadata").entrypoints[0] =
        "src/app/moved-layout.tsx";
    }, "invalid or private entrypoint: src/app/moved-layout.tsx");
    await expectOwnershipError((manifest) => {
      manifest.owners.find((owner) => owner.id === "routes-metadata").entrypoints[0] =
        ".env.local";
    }, "invalid or private entrypoint: .env.local");
    await expectOwnershipError((manifest) => {
      manifest.owners.find((owner) => owner.id === "portfolio-home-profile").pathPatterns[0] =
        "src/features/home/**";
    }, "must use src/components/portfolio instead of src/features");
  });

  it("rejects manifest references that escape through file and parent-directory symlinks", async () => {
    const root = await createOwnershipFixture((manifest) => {
      manifest.documentationCommandExceptions.push({
        document: "docs/architecture/ARCHITECTURE.md",
        command: "illustrative-command",
        reason: "This fixture exercises a contained documentation reference.",
      });
    });
    const outside = await mkdtemp(
      path.join(os.tmpdir(), "portfolio-outside-reference-"),
    );
    try {
      const directReferences = [
        ["src/app/layout.tsx", "outside-layout.tsx"],
        ["src/app/robots.test.ts", "outside-robots.test.ts"],
        ["src/lib/routing/siteRoutes.ts", "outside-site-routes.ts"],
        ["next.config.mjs", "outside-next.config.mjs"],
      ];
      for (const [relativePath, outsideName] of directReferences) {
        const target = path.join(root, relativePath);
        const outsideTarget = path.join(outside, outsideName);
        await rm(target, { force: true });
        await writeFile(outsideTarget, "export {};\n", "utf8");
        await symlink(outsideTarget, target);
      }

      await rm(path.join(root, "docs", "architecture"), {
        recursive: true,
        force: true,
      });
      const outsideArchitecture = path.join(outside, "architecture");
      await mkdir(outsideArchitecture, { recursive: true });
      await writeFile(
        path.join(outsideArchitecture, "ARCHITECTURE.md"),
        "# Outside architecture\n",
        "utf8",
      );
      await writeFile(
        path.join(outsideArchitecture, "PROJECT_STRUCTURE.md"),
        "# Outside structure\n",
        "utf8",
      );
      await symlink(outsideArchitecture, path.join(root, "docs", "architecture"));

      await rm(path.join(root, "docs", "development"), {
        recursive: true,
        force: true,
      });
      const outsideDevelopment = path.join(outside, "development");
      await mkdir(outsideDevelopment, { recursive: true });
      await writeFile(
        path.join(outsideDevelopment, "AGENT_MAP.md"),
        "# Outside map\n",
        "utf8",
      );
      await symlink(outsideDevelopment, path.join(root, "docs", "development"));

      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "mapDocument must be an existing repository Markdown file",
          ),
          expect.stringContaining(
            "owner routes-metadata has an invalid or private entrypoint: src/app/layout.tsx",
          ),
          expect.stringContaining(
            "owner routes-metadata has an invalid or private test path: src/app/robots.test.ts",
          ),
          expect.stringContaining(
            "owner architecture documentation file does not exist: docs/architecture/ARCHITECTURE.md#application-layers",
          ),
          expect.stringContaining(
            "owner routes-metadata has an invalid or private reuse primitive: src/lib/routing/siteRoutes.ts",
          ),
          expect.stringContaining(
            "code path exceptions require an existing public path and reason",
          ),
          expect.stringContaining(
            "documentation command exceptions require a Markdown document, command, and reason",
          ),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects missing commands, anchors, and unowned implementation paths", async () => {
    await expectOwnershipError((manifest) => {
      manifest.owners.find((owner) => owner.id === "content").commands[0] =
        "npm run missing-content-check";
    }, "references an unknown npm command: npm run missing-content-check");
    await expectOwnershipError((manifest) => {
      manifest.owners.find((owner) => owner.id === "docs-maintenance").documentation[0] =
        "docs/README.md#missing-section";
    }, "documentation anchor does not exist: docs/README.md#missing-section");
    await expectOwnershipError((manifest) => {
      manifest.owners = manifest.owners.filter(
        (owner) => owner.id !== "shared-theme",
      );
    }, "relevant repository path has no owner or explicit exception: src/components/theme/ThemeSwitcher.test.tsx");
  });

  it("rejects a relevant source path without an owner or explicit exception", async () => {
    const root = await createOwnershipFixture();
    try {
      await mkdir(path.join(root, "src", "lib", "unowned"), {
        recursive: true,
      });
      await writeFile(
        path.join(root, "src", "lib", "unowned", "new.ts"),
        "export {};\n",
        "utf8",
      );
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "relevant repository path has no owner or explicit exception: src/lib/unowned/new.ts",
          ),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects a new functional root configuration without an owner or exception", async () => {
    const root = await createOwnershipFixture();
    try {
      await writeFile(
        path.join(root, "unowned.config.mjs"),
        "export default {};\n",
        "utf8",
      );
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "relevant repository path has no owner or explicit exception: unowned.config.mjs",
          ),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires ownership for dotfile and extensionless root configuration", async () => {
    const root = await createOwnershipFixture();
    const rootConfigs = [
      ".npmrc",
      ".prettierrc",
      ".tool-versions",
      "Dockerfile",
      "Makefile",
    ];
    try {
      for (const filename of rootConfigs) {
        await writeFile(path.join(root, filename), "fixture\n", "utf8");
      }
      const result = await validateDocumentation({ projectRoot: root });
      for (const filename of rootConfigs) {
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.stringContaining(
              "relevant repository path has no owner or explicit exception: " +
                filename,
            ),
          ]),
        );
      }
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("requires a narrow exception for the checked-in environment template", async () => {
    await expectOwnershipError((manifest) => {
      manifest.codePathExceptions = manifest.codePathExceptions.filter(
        (exception) => exception.path !== ".env.example",
      );
    }, "relevant repository path has no owner or explicit exception: .env.example");
    await expectOwnershipError((manifest) => {
      manifest.codePathExceptions.push({
        path: ".env.local",
        reason: "Private local configuration must not be documented.",
      });
    }, "code path exceptions require an existing public path and reason");
  });

  it("uses Git ignore rules for private local files while retaining unignored configuration", async () => {
    const root = await createGitOwnershipFixture();
    try {
      await Promise.all([
        writeFile(path.join(root, ".env"), "TOKEN=private-env-sentinel\n", "utf8"),
        writeFile(path.join(root, ".dev.vars"), "SECRET=private-vars-sentinel\n", "utf8"),
        writeFile(path.join(root, "local-generated.log"), "private-log-sentinel\n", "utf8"),
        writeFile(path.join(root, "unowned.config.mjs"), "export default {};\n", "utf8"),
        writeFile(path.join(root, ".npmrc"), "registry=https://registry.npmjs.org/\n", "utf8"),
      ]);

      const result = await validateDocumentation({ projectRoot: root });
      const diagnostics = result.errors.join("\n");
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "relevant repository path has no owner or explicit exception: unowned.config.mjs",
          ),
          expect.stringContaining(
            "relevant repository path has no owner or explicit exception: .npmrc",
          ),
        ]),
      );
      expect(diagnostics).not.toContain(".env");
      expect(diagnostics).not.toContain("local-generated.log");
      expect(diagnostics).not.toContain("private-env-sentinel");
      expect(diagnostics).not.toContain("private-vars-sentinel");
      expect(diagnostics).not.toContain("private-log-sentinel");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("rejects symlinked ownership inputs before private content can be parsed or read", async () => {
    const protectedPaths = [
      ".agents/ownership-manifest.json",
      "AGENTS.md",
      ".agents/README.md",
      ".agents/knowledge/SYSTEM_DECISIONS.md",
    ];
    const outside = await mkdtemp(path.join(os.tmpdir(), "portfolio-private-symlink-"));
    try {
      for (const [index, protectedPath] of protectedPaths.entries()) {
        for (const targetType of ["internal", "external"]) {
          const root = await createOwnershipFixture();
          const sentinel = `private-symlink-sentinel-${index}-${targetType}`;
          const target =
            targetType === "internal"
              ? path.join(root, ".env")
              : path.join(outside, `${index}-${targetType}.txt`);
          try {
            await writeFile(target, `{"private":"${sentinel}"`, "utf8");
            await rm(path.join(root, protectedPath), { force: true });
            await symlink(target, path.join(root, protectedPath));

            const result = await validateDocumentation({ projectRoot: root });
            const diagnostics = result.errors.join("\n");
            expect(diagnostics).toContain(
              `${protectedPath}: documentation path must not be a symlink`,
            );
            expect(diagnostics).not.toContain(sentinel);
            expect(diagnostics).not.toContain("Unexpected token");
            expect(diagnostics).not.toContain("Expected property name");
            if (protectedPath === ".agents/ownership-manifest.json") {
              expect(diagnostics).toContain("required ownership manifest is missing");
            } else {
              expect(diagnostics).toContain(
                `required bootstrap file is missing: ${protectedPath}`,
              );
            }
          } finally {
            await rm(root, { recursive: true, force: true });
          }
        }
      }
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("does not traverse symlinked documentation roots during discovery", async () => {
    const outside = await mkdtemp(path.join(os.tmpdir(), "portfolio-docs-root-symlink-"));
    try {
      for (const [index, directory] of ["docs", ".agents"].entries()) {
        const root = await createOwnershipFixture();
        const sentinel = `private-document-root-sentinel-${index}`;
        const target = path.join(outside, `root-${index}`);
        try {
          await mkdir(target, { recursive: true });
          await writeFile(path.join(target, "PRIVATE.md"), `# ${sentinel}\n`, "utf8");
          await rm(path.join(root, directory), { recursive: true, force: true });
          await symlink(target, path.join(root, directory));

          const result = await validateDocumentation({ projectRoot: root });
          const diagnostics = result.errors.join("\n");
          expect(diagnostics).toContain(
            `${directory}: documentation path must not be a symlink`,
          );
          expect(diagnostics).not.toContain(sentinel);
        } finally {
          await rm(root, { recursive: true, force: true });
        }
      }
    } finally {
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("rejects relevant root and source symlinks without reading their targets", async () => {
    const root = await createOwnershipFixture();
    const outside = await mkdtemp(path.join(os.tmpdir(), "portfolio-symlink-"));
    try {
      const rootTarget = path.join(outside, "root-config.mjs");
      const sourceTarget = path.join(outside, "source.ts");
      await writeFile(rootTarget, "external root fixture\n", "utf8");
      await writeFile(sourceTarget, "external source fixture\n", "utf8");
      await symlink(rootTarget, path.join(root, "unowned.config.mjs"));
      await symlink(sourceTarget, path.join(root, "src", "unowned-link.ts"));

      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "relevant repository path must not be a symlink: unowned.config.mjs",
          ),
          expect.stringContaining(
            "relevant repository path must not be a symlink: src/unowned-link.ts",
          ),
        ]),
      );
      expect(result.errors.join("\n")).not.toContain("external root fixture");
      expect(result.errors.join("\n")).not.toContain("external source fixture");
    } finally {
      await rm(root, { recursive: true, force: true });
      await rm(outside, { recursive: true, force: true });
    }
  });

  it("enforces bootstrap and task-card budgets", async () => {
    const root = await createOwnershipFixture();
    try {
      await writeFile(path.join(root, "AGENTS.md"), "x".repeat(8193), "utf8");
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("combined bootstrap size"),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    const cardRoot = await createOwnershipFixture();
    try {
      await writeFile(
        path.join(cardRoot, ".agents/cards/content.md"),
        "x".repeat(6145),
        "utf8",
      );
      const result = await validateDocumentation({ projectRoot: cardRoot });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("task card .agents/cards/content.md size 6145"),
        ]),
      );
    } finally {
      await rm(cardRoot, { recursive: true, force: true });
    }
  });

  it("checks future infrastructure Markdown when the directory appears", async () => {
    const root = await createOwnershipFixture();
    try {
      await mkdir(path.join(root, "infrastructure"), { recursive: true });
      await writeFile(
        path.join(root, "infrastructure/README.md"),
        "# Infrastructure\n\nTODO\n",
        "utf8",
      );
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "infrastructure/README.md: contains an obvious unresolved placeholder",
          ),
          expect.stringContaining(
            "infrastructure exists but is still marked not-implemented",
          ),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("accepts owned implemented infrastructure", async () => {
    const root = await createOwnershipFixture((manifest) => {
      manifest.future = [
        {
          id: "infrastructure",
          status: "implemented",
          owner: "infrastructure-baseline",
          reason: "The fixture adds a reviewed infrastructure implementation.",
        },
      ];
      manifest.owners
        .find((owner) => owner.id === "infrastructure-baseline")
        .pathPatterns.push("infrastructure/**");
    });
    try {
      await mkdir(path.join(root, "infrastructure"), { recursive: true });
      await writeFile(
        path.join(root, "infrastructure", "main.tf"),
        "terraform {}\n",
        "utf8",
      );
      await expect(validateDocumentation({ projectRoot: root })).resolves.toMatchObject({
        errors: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("checks documented npm commands and allows narrow registered examples", async () => {
    const root = await createOwnershipFixture();
    try {
      const documentationPath = path.join(root, "docs", "README.md");
      await writeFile(
        documentationPath,
        (await readFile(documentationPath, "utf8")) +
          "\nUse `npm run removed-doc-command -- --help`.\n",
        "utf8",
      );
      const result = await validateDocumentation({ projectRoot: root });
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            "document references an unknown npm command: docs/README.md -> npm run removed-doc-command",
          ),
        ]),
      );
    } finally {
      await rm(root, { recursive: true, force: true });
    }

    const allowedRoot = await createOwnershipFixture((manifest) => {
      manifest.documentationCommandExceptions.push({
        document: "docs/README.md",
        command: "illustrative-command",
        reason: "The documentation labels this as a non-executable example.",
      });
    });
    try {
      const documentationPath = path.join(allowedRoot, "docs", "README.md");
      await writeFile(
        documentationPath,
        (await readFile(documentationPath, "utf8")) +
          "\nUse `npm run illustrative-command -- --example`.\n",
        "utf8",
      );
      await expect(
        validateDocumentation({ projectRoot: allowedRoot }),
      ).resolves.toMatchObject({ errors: [] });
    } finally {
      await rm(allowedRoot, { recursive: true, force: true });
    }
  });

  it("rejects private paths and sensitive Markdown without exposing their values", async () => {
    const root = await createFixture({
      "README.md": "# Project\n\nA prose path is `/Users/alice/private`.\n",
      "docs/GUIDE.md": [
        "# Guide",
        "",
        "```text",
        "/home/alice/private",
        "```",
        "",
        "API_TOKEN=not-a-real-token",
        "https://alice:not-a-real-password@example.test/path",
        "ghp_abcdefghijklmnopqrstuvwx",
      ].join("\n"),
    });
    try {
      const result = await validateMinimalFixture(root);
      expect(result.errors).toEqual(
        expect.arrayContaining([
          expect.stringContaining("absolute macOS or Linux user path"),
          expect.stringContaining("sensitive configuration assignment"),
          expect.stringContaining("credential-bearing URL"),
          expect.stringContaining("key-shaped credential value"),
        ]),
      );
      expect(result.errors.join("\n")).not.toContain("not-a-real-token");
      expect(result.errors.join("\n")).not.toContain("not-a-real-password");
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });

  it("detects every bare sensitive configuration assignment without echoing values", async () => {
    const names = [
      "TOKEN",
      "SECRET",
      "PASSWORD",
      "PRIVATE_KEY",
      "CREDENTIAL",
      "API_KEY",
    ];
    for (const name of names) {
      const root = await createFixture({
        "README.md": "# Project\n",
        "docs/GUIDE.md": `# Guide\n\n${name}=unsafe-fixture-value\n`,
      });
      try {
        const result = await validateMinimalFixture(root);
        expect(result.errors).toEqual(
          expect.arrayContaining([
            expect.stringContaining("sensitive configuration assignment"),
          ]),
        );
        expect(result.errors.join("\n")).not.toContain("unsafe-fixture-value");
      } finally {
        await rm(root, { recursive: true, force: true });
      }
    }
  });

  it("allows narrow placeholder-only configuration and credential examples", async () => {
    const root = await createFixture({
      "README.md": "# Project\n",
      "docs/GUIDE.md": [
        "# Guide",
        "",
        "TOKEN=<REDACTED>",
        "SECRET=<REDACTED>",
        "PASSWORD=<REDACTED>",
        "PRIVATE_KEY=<REDACTED>",
        "CREDENTIAL=<REDACTED>",
        "API_KEY=<REDACTED>",
        "API_TOKEN=<REDACTED>",
        "https://<username>:<password>@example.test/path",
      ].join("\n"),
    });
    try {
      await expect(validateMinimalFixture(root)).resolves.toEqual({
        checkedFiles: ["README.md", "docs/GUIDE.md"],
        errors: [],
      });
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  });
});
