import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { ESLint } from "eslint";
import ts from "typescript";
import { describe, expect, it } from "vitest";

const projectRoot = process.cwd();
const sourceRoot = path.join(projectRoot, "src");
const configPath = path.join(projectRoot, "tsconfig.json");
const configFile = ts.readConfigFile(configPath, ts.sys.readFile);

if (configFile.error) throw new Error(ts.flattenDiagnosticMessageText(configFile.error.messageText, "\n"));

const parsedConfig = ts.parseJsonConfigFileContent(configFile.config, ts.sys, projectRoot, undefined, configPath);
const compilerOptions = parsedConfig.options;
const crossFeatureAllowlist: Readonly<Record<string, readonly string[]>> = {
  home: ["experience", "projects", "recommendations", "research", "skills"],
  projects: ["skills"]
};
const allowedAssetExtensions = new Set([".css", ".json"]);

type ImportEdge = { from: string; specifier: string; to: string };

function isSourceFile(filePath: string): boolean {
  return /\.(?:ts|tsx)$/.test(filePath) && !/\.(?:test|fixture)\.tsx?$/.test(filePath);
}

function isGraphModule(filePath: string): boolean {
  return /\.(?:ts|tsx)$/.test(filePath) && !/\.test\.tsx?$/.test(filePath);
}

function isLocalSpecifier(specifier: string): boolean {
  if (specifier.startsWith(".")) return true;
  return Object.keys(compilerOptions.paths ?? {}).some((pattern) => specifier.startsWith(pattern.split("*")[0]!));
}

function resolveConfiguredAsset(specifier: string, fromFile: string): string | undefined {
  if (specifier.startsWith(".")) {
    const assetPath = path.resolve(path.dirname(fromFile), specifier);
    return existsSync(assetPath) ? assetPath : undefined;
  }

  for (const [pattern, targets] of Object.entries(compilerOptions.paths ?? {})) {
    const [prefix, suffix = ""] = pattern.split("*");
    if (!specifier.startsWith(prefix) || !specifier.endsWith(suffix)) continue;
    const wildcard = specifier.slice(prefix.length, specifier.length - suffix.length);
    for (const target of targets) {
      const assetPath = path.resolve(compilerOptions.baseUrl ?? projectRoot, target.replace("*", wildcard));
      if (existsSync(assetPath)) return assetPath;
    }
  }
}

function resolveLocalModule(fromFile: string, specifier: string): string | undefined {
  if (allowedAssetExtensions.has(path.extname(specifier))) return resolveConfiguredAsset(specifier, fromFile);
  return ts.resolveModuleName(specifier, fromFile, compilerOptions, ts.sys).resolvedModule?.resolvedFileName;
}

function addSpecifier(edges: ImportEdge[], sourceFile: ts.SourceFile, specifier: string, kind: string): void {
  if (!isLocalSpecifier(specifier)) return;
  const resolved = resolveLocalModule(sourceFile.fileName, specifier);
  if (!resolved) throw new Error(`${path.relative(projectRoot, sourceFile.fileName)} has an unresolved local ${kind}: ${specifier}`);
  if (allowedAssetExtensions.has(path.extname(resolved)) || !isGraphModule(resolved)) return;
  edges.push({ from: sourceFile.fileName, specifier, to: path.normalize(resolved) });
}

function addLiteralCallSpecifier(
  edges: ImportEdge[], sourceFile: ts.SourceFile, expression: ts.CallExpression, kind: "dynamic import" | "require"
): void {
  const [argument] = expression.arguments;
  if (!argument || !ts.isStringLiteralLike(argument)) {
    throw new Error(`${path.relative(projectRoot, sourceFile.fileName)} has an ambiguous ${kind}; use a literal module specifier.`);
  }
  addSpecifier(edges, sourceFile, argument.text, kind);
}

function collectImportEdges(filePath: string): ImportEdge[] {
  const sourceFile = ts.createSourceFile(filePath, readFileSync(filePath, "utf8"), ts.ScriptTarget.Latest, true);
  const edges: ImportEdge[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
      addSpecifier(edges, sourceFile, node.moduleSpecifier.text, "import");
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier && ts.isStringLiteralLike(node.moduleSpecifier)) {
      addSpecifier(edges, sourceFile, node.moduleSpecifier.text, "re-export");
    } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
      const expression = node.moduleReference.expression;
      if (!expression || !ts.isStringLiteralLike(expression)) {
        throw new Error(`${path.relative(projectRoot, sourceFile.fileName)} has an ambiguous import-equals module specifier.`);
      }
      addSpecifier(edges, sourceFile, expression.text, "import-equals");
    } else if (ts.isImportTypeNode(node)) {
      const argument = node.argument;
      if (!ts.isLiteralTypeNode(argument) || !ts.isStringLiteralLike(argument.literal)) {
        throw new Error(`${path.relative(projectRoot, sourceFile.fileName)} has an ambiguous import-type module specifier.`);
      }
      addSpecifier(edges, sourceFile, argument.literal.text, "import-type");
    } else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) addLiteralCallSpecifier(edges, sourceFile, node, "dynamic import");
      else if (ts.isIdentifier(node.expression) && node.expression.text === "require") addLiteralCallSpecifier(edges, sourceFile, node, "require");
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return edges;
}

function collectProjectSourceFiles(): string[] {
  return parsedConfig.fileNames.filter((filePath) => filePath.startsWith(`${sourceRoot}${path.sep}`) && isSourceFile(filePath));
}

function featureName(filePath: string): string | undefined {
  const [name] = path.relative(path.join(sourceRoot, "features"), filePath).replaceAll(path.sep, "/").split("/");
  return name && !name.startsWith("..") ? name : undefined;
}

function validateGraph(files: string[]): void {
  const graph = new Map<string, ImportEdge[]>();
  for (const filePath of files) {
    const edges = collectImportEdges(filePath);
    graph.set(filePath, edges);
    for (const edge of edges) {
      const sourceFeature = featureName(edge.from);
      const targetFeature = featureName(edge.to);
      if (edge.from.includes(`${path.sep}lib${path.sep}`) && (targetFeature || edge.to.includes(`${path.sep}components${path.sep}`))) {
        throw new Error(`${path.relative(projectRoot, edge.from)} must remain neutral; found ${edge.specifier}`);
      }
      if (edge.from.includes(`${path.sep}components${path.sep}`) && !sourceFeature && targetFeature) {
        throw new Error(`${path.relative(projectRoot, edge.from)} is shared and must not import ${edge.specifier}`);
      }
      if (sourceFeature && targetFeature && sourceFeature !== targetFeature && !(crossFeatureAllowlist[sourceFeature] ?? []).includes(targetFeature)) {
        throw new Error(`${sourceFeature} -> ${targetFeature} is not an allowed feature dependency (${edge.specifier})`);
      }
    }
  }

  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (filePath: string): void => {
    if (visiting.has(filePath)) throw new Error(`Import cycle includes ${path.relative(projectRoot, filePath)}`);
    if (visited.has(filePath)) return;
    visiting.add(filePath);
    for (const edge of graph.get(filePath) ?? []) if (graph.has(edge.to)) visit(edge.to);
    visiting.delete(filePath);
    visited.add(filePath);
  };
  for (const filePath of graph.keys()) visit(filePath);
}

async function lintImport(filePath: string, importPath: string): Promise<string[]> {
  const eslint = new ESLint({
    cwd: projectRoot,
    overrideConfigFile: path.join(projectRoot, "eslint.config.mjs")
  });
  const [result] = await eslint.lintText(`import value from "${importPath}";
void value;`, { filePath });

  return result.messages.map((message) => message.message);
}

async function expectRestrictedImport(filePath: string, importPath: string, expectedMessage: string): Promise<void> {
  expect(await lintImport(filePath, importPath)).toContainEqual(expect.stringContaining(expectedMessage));
}

function fixture(...parts: string[]): string {
  return path.join(sourceRoot, "lib", "architecture", "fixtures", ...parts);
}

describe("architecture import boundaries", () => {
  it("rejects UI and feature imports from library modules by alias and relative path", async () => {
    await expectRestrictedImport("src/lib/content/example.ts", "@/components/navigation/navigationItems",
      "Library modules must not depend on presentation or feature modules."
    );
    await expectRestrictedImport("src/lib/content/example.ts", "../../components/navigation/navigationItems",
      "Library modules must not depend on presentation or feature modules."
    );
    await expectRestrictedImport("src/lib/content/example.ts", "@/features/research/components/ResearchShowcase",
      "Library modules must not depend on presentation or feature modules."
    );
    await expectRestrictedImport("src/lib/content/example.ts", "../../features/example",
      "Library modules must not depend on presentation or feature modules."
    );
  });

  it("rejects feature, generated, function, and script imports from shared component modules", async () => {
    await expectRestrictedImport("src/components/example.tsx", "@/features/research/components/ResearchShowcase",
      "Shared components must not depend on feature modules."
    );
    await expectRestrictedImport("src/components/example.tsx", "../../features/research/components/ResearchShowcase",
      "Shared components must not depend on feature modules."
    );
    await expectRestrictedImport("src/components/example.tsx", "@/content/generated/portfolio.generated.json",
      "Components must receive content through supported application and library boundaries."
    );
    await expectRestrictedImport("src/components/example.tsx", "../../content/generated/portfolio.generated.json",
      "Components must receive content through supported application and library boundaries."
    );
    await expectRestrictedImport("src/components/example.tsx", "../../functions/api",
      "Components must receive content through supported application and library boundaries."
    );
    await expectRestrictedImport("src/components/example.tsx", "../../scripts/generateContent",
      "Components must receive content through supported application and library boundaries."
    );
  });

  it("permits library dependencies shared by components", async () => {
    await expect(lintImport("src/lib/content/example.ts", "@/lib/content/displayHelpers")).resolves.toEqual([]);
    await expect(lintImport("src/components/example.tsx", "@/lib/content/displayHelpers")).resolves.toEqual([]);
    await expect(lintImport("src/components/example.tsx", "@/content/types")).resolves.toEqual([]);
    await expect(lintImport("src/app/example.tsx", "@/features/research/components/ResearchShowcase")).resolves.toEqual([]);
  });

  it("permits feature-aware component tests without relaxing their external-source guards", async () => {
    await expect(lintImport("src/lib/content/example.test.ts", "@/features/home/content/selectHomeContent")).resolves.toEqual([]);
    await expect(
      lintImport("src/components/example.test.tsx", "@/features/research/components/ResearchShowcase")
    ).resolves.toEqual([]);
    await expectRestrictedImport(
      "src/components/example.test.tsx",
      "@/content/generated/portfolio.generated.json",
      "Components must receive content through supported application and library boundaries."
    );
    await expectRestrictedImport(
      "src/components/example.test.tsx",
      "../../scripts/generateContent",
      "Components must receive content through supported application and library boundaries."
    );
  });

  it("uses TypeScript resolution for local aliases, relative imports, and re-export barrels", () => {
    expect(() => validateGraph([fixture("alias.fixture.ts")])).toThrow(/must remain neutral/);
    expect(() => validateGraph([fixture("relative.fixture.ts")])).toThrow(/must remain neutral/);
    expect(() => validateGraph([fixture("barrel.fixture.ts")])).toThrow(/must remain neutral/);
    expect(() => validateGraph([fixture("import-type.fixture.ts")])).toThrow(/must remain neutral/);
  });

  it("rejects resolved cycles and ambiguous local dynamic imports", () => {
    expect(() => validateGraph([fixture("cycle-a.fixture.ts"), fixture("cycle-b.fixture.ts")])).toThrow(/Import cycle/);
    expect(() => validateGraph([fixture("dynamic.fixture.ts")])).toThrow(/ambiguous dynamic import/);
  });

  it("resolves every project source edge, permits only documented feature dependencies, and rejects cycles", () => {
    validateGraph(collectProjectSourceFiles());
  });
});
