import { execFile } from "node:child_process";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const defaultProjectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const generatedDirectoryNames = new Set([".next", "coverage", "out"]);
const generatedRootFiles = new Set([
  "artifact-integrity.json",
  "content-version.json",
]);
const nonFunctionalRootFiles = new Set([
  ".gitattributes",
  ".git",
  ".gitignore",
  "LICENSE",
  "tsconfig.tsbuildinfo",
]);
const ownershipManifestPath = ".agents/ownership-manifest.json";
const bootstrapPaths = [
  "AGENTS.md",
  ".agents/README.md",
  ".agents/knowledge/SYSTEM_DECISIONS.md",
];
const bootstrapByteBudget = 8 * 1024;
const taskCardByteBudget = 6 * 1024;
const privatePathSegments = new Set(["private", "secrets"]);
const ignoredRepositoryDirectories = new Set([
  ".git",
  ".next",
  "coverage",
  "node_modules",
  "out",
]);
const localDevelopmentDocuments = new Set([
  "README.md",
  "docs/development/LOCAL_DEVELOPMENT.md",
  "docs/development/TROUBLESHOOTING.md",
]);

const obviousPlaceholderPatterns = [
  /\b(?:FIXME|REPLACE_ME|TBD|TODO)\b/,
  /\bYOUR_[A-Z0-9_]+\b/,
  /\[(?:insert|placeholder|replace)[^\]]*\]/i,
  /<(?:insert|replace|your)[-_ ][^>]+>/i,
];

const privateWorkbookPatterns = [
  /https?:\/\/(?:docs\.google\.com\/spreadsheets|drive\.google\.com\/(?:file|open|uc))/i,
  /PORTFOLIO_WORKBOOK_URL\s*=\s*["']?\s*https?:\/\//i,
];
const privateUnixPathPattern =
  /(?:^|[^A-Za-z0-9_.-])\/(?:Users|home)\/(?!<)[A-Za-z0-9._-]+(?:\/|$)/;
const credentialUrlPattern = /https?:\/\/([^/\s:@]+):([^/\s@]+)@/gi;
const realKeyPattern =
  /\b(?:ghp|github_pat|sk|rk)_[A-Za-z0-9_-]{20,}\b|\bAKIA[0-9A-Z]{16}\b/;
const sensitiveAssignmentPattern =
  /\b(?:[A-Z][A-Z0-9_]*_)?(?:TOKEN|SECRET|PASSWORD|PRIVATE_KEY|CREDENTIAL|API_KEY)(?:_[A-Z0-9_]+)?\s*=\s*([^\s]+)/;

function isSafeSensitivePlaceholder(value) {
  return /^(?:<[^>]+>|\$\{[^}]+\}|(?:example|redacted|placeholder|replace)[-A-Za-z0-9_]*)$/i.test(
    value,
  );
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

function diagnosticRelativePath(projectRoot, targetPath) {
  return toPosix(path.relative(projectRoot, targetPath)) || ".";
}

async function inspectRepositoryPath(projectRoot, targetPath) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);
  const relativeTarget = path.relative(resolvedProjectRoot, resolvedTarget);
  if (
    relativeTarget === ".." ||
    relativeTarget.startsWith(".." + path.sep) ||
    path.isAbsolute(relativeTarget)
  ) {
    return { exists: false, exactCase: false, escaped: true };
  }

  const segments = relativeTarget ? relativeTarget.split(path.sep) : [];
  let currentPath = resolvedProjectRoot;
  for (let index = 0; index <= segments.length; index += 1) {
    let currentStats;
    try {
      currentStats = await lstat(currentPath);
    } catch {
      return { exists: false, exactCase: false };
    }
    if (currentStats.isSymbolicLink()) {
      return { exists: false, exactCase: false, unsafe: true };
    }
    if (index === segments.length) {
      return { exists: true, exactCase: true, stats: currentStats };
    }
    if (!currentStats.isDirectory()) return { exists: false, exactCase: false };

    const segment = segments[index];
    const entries = await readdir(currentPath);
    const exactEntry = entries.find((entry) => entry === segment);
    if (exactEntry) {
      currentPath = path.join(currentPath, exactEntry);
      continue;
    }

    const caseInsensitiveEntry = entries.find(
      (entry) => entry.toLowerCase() === segment.toLowerCase(),
    );
    if (caseInsensitiveEntry) return { exists: true, exactCase: false };
    return { exists: false, exactCase: false };
  }

  return { exists: false, exactCase: false };
}

async function listMarkdownFiles(directory, projectRoot, unsafePaths) {
  const files = [];
  const inspection = await inspectRepositoryPath(projectRoot, directory);
  if (inspection.unsafe) {
    unsafePaths.add(diagnosticRelativePath(projectRoot, directory));
    return files;
  }
  if (!inspection.exists || !inspection.exactCase || !inspection.stats?.isDirectory()) {
    return files;
  }
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(absolutePath, projectRoot, unsafePaths)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(absolutePath);
    } else if (entry.isSymbolicLink()) {
      unsafePaths.add(diagnosticRelativePath(projectRoot, absolutePath));
    }
  }

  return files;
}

async function listOptionalMarkdownFiles(directory, projectRoot, unsafePaths) {
  const inspection = await inspectRepositoryPath(projectRoot, directory);
  if (inspection.unsafe) {
    unsafePaths.add(diagnosticRelativePath(projectRoot, directory));
    return [];
  }
  if (!inspection.exists || !inspection.exactCase || !inspection.stats?.isDirectory()) {
    return [];
  }

  return listMarkdownFiles(directory, projectRoot, unsafePaths);
}

async function listRepositoryFiles(directory, projectRoot) {
  const gitPaths = await listGitRepositoryFiles(projectRoot);
  if (gitPaths) return inspectRepositoryEntries(gitPaths, projectRoot);

  return listFixtureRepositoryFiles(directory, projectRoot);
}

async function listGitRepositoryFiles(projectRoot) {
  try {
    const { stdout } = await execFileAsync(
      "git",
      ["ls-files", "--cached", "--others", "--exclude-standard", "-z"],
      { cwd: projectRoot, maxBuffer: 10 * 1024 * 1024 },
    );
    return stdout.split("\0").filter(Boolean).sort();
  } catch {
    return undefined;
  }
}

async function inspectRepositoryEntries(relativePaths, projectRoot) {
  const entriesByType = { files: [], symlinks: [] };
  for (const repositoryPath of relativePaths) {
    const absolutePath = path.resolve(projectRoot, repositoryPath);
    const relativePath = path.relative(projectRoot, absolutePath);
    if (
      !relativePath ||
      relativePath === ".." ||
      relativePath.startsWith(".." + path.sep) ||
      path.isAbsolute(relativePath)
    ) {
      continue;
    }

    try {
      const entry = await lstat(absolutePath);
      const normalizedPath = toPosix(relativePath);
      if (entry.isFile()) entriesByType.files.push(normalizedPath);
      else if (entry.isSymbolicLink()) {
        entriesByType.files.push(normalizedPath);
        entriesByType.symlinks.push(normalizedPath);
      }
    } catch {
      // A concurrent edit can make a Git-listed path disappear during validation.
    }
  }
  return entriesByType;
}

function isIgnoredFixturePath(relativePath) {
  const basename = path.posix.basename(relativePath).toLowerCase();
  return (
    basename === ".env" ||
    (basename.startsWith(".env.") && basename !== ".env.example") ||
    basename === ".dev.vars" ||
    basename.startsWith(".dev.vars.") ||
    basename === ".local" ||
    basename === "next-env.d.ts" ||
    basename.endsWith(".log")
  );
}

async function listFixtureRepositoryFiles(directory, projectRoot) {
  const entriesByType = { files: [], symlinks: [] };
  let entries;
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch {
    return entriesByType;
  }

  entries.sort((left, right) => left.name.localeCompare(right.name));
  for (const entry of entries) {
    if (ignoredRepositoryDirectories.has(entry.name)) continue;

    const absolutePath = path.join(directory, entry.name);
    const relativePath = toPosix(path.relative(projectRoot, absolutePath));
    if (isIgnoredFixturePath(relativePath)) continue;
    if (entry.isDirectory()) {
      const nestedEntries = await listFixtureRepositoryFiles(
        absolutePath,
        projectRoot,
      );
      entriesByType.files.push(...nestedEntries.files);
      entriesByType.symlinks.push(...nestedEntries.symlinks);
    } else if (entry.isFile()) {
      entriesByType.files.push(relativePath);
    } else if (entry.isSymbolicLink()) {
      entriesByType.files.push(relativePath);
      entriesByType.symlinks.push(relativePath);
    }
  }

  return entriesByType;
}

async function readRepositoryFile(projectRoot, filePath) {
  const inspection = await inspectRepositoryPath(projectRoot, filePath);
  if (!inspection.exists || !inspection.exactCase || !inspection.stats?.isFile()) {
    throw new Error("repository file is not a readable non-symlinked file");
  }

  try {
    return await readFile(filePath, "utf8");
  } catch {
    throw new Error("repository file could not be read");
  }
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function findFenceErrors(source) {
  const errors = [];
  const lines = source.split(/\r?\n/);
  let openFence;

  for (let index = 0; index < lines.length; index += 1) {
    const match = lines[index].match(/^\s*(`{3,}|~{3,})/);
    if (!match) continue;

    const marker = match[1];
    if (!openFence) {
      openFence = {
        character: marker[0],
        length: marker.length,
        line: index + 1,
      };
      continue;
    }

    if (
      marker[0] === openFence.character &&
      marker.length >= openFence.length
    ) {
      openFence = undefined;
    }
  }

  if (openFence) {
    errors.push(`unclosed fenced code block opened on line ${openFence.line}`);
  }

  return errors;
}

function linesOutsideFences(source) {
  const lines = source.split(/\r?\n/);
  let openFence;

  return lines.map((line) => {
    const match = line.match(/^\s*(`{3,}|~{3,})/);
    if (match) {
      const marker = match[1];
      if (!openFence) {
        openFence = { character: marker[0], length: marker.length };
      } else if (
        marker[0] === openFence.character &&
        marker.length >= openFence.length
      ) {
        openFence = undefined;
      }
      return "";
    }

    return openFence ? "" : line;
  });
}

function normalizeReferenceLabel(value) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function maskInlineCode(line) {
  return line
    .replace(/(`+)(.*?)\1/g, (match) => " ".repeat(match.length))
    .replace(/<code\b[^>]*>.*?<\/code>/gi, (match) => " ".repeat(match.length));
}

function extractLinkData(source) {
  const targets = [];
  const undefinedReferences = [];
  const searchableSource = linesOutsideFences(source)
    .map(maskInlineCode)
    .join("\n");
  const inlineLinkPattern =
    /!?\[[^\]]*\]\(\s*(?:<([^>\n]+)>|((?:\\.|[^()\s]|\((?:\\.|[^()\s])*\))+))(?:\s+(?:"[^"]*"|'[^']*'|\([^)]*\)))?\s*\)/g;
  const referenceLinkPattern = /^\s{0,3}\[([^\]]+)\]:\s*(?:<([^>]+)>|(\S+))/gm;
  const referenceUsagePattern = /!?\[([^\]]+)\]\[([^\]]*)\]/g;
  const htmlLinkPattern = /\b(?:href|src)=["']([^"']+)["']/gi;
  const definedReferenceLabels = new Set();

  for (const match of searchableSource.matchAll(referenceLinkPattern)) {
    definedReferenceLabels.add(normalizeReferenceLabel(match[1]));
    const target = (match[2] ?? match[3] ?? "").trim();
    if (target)
      targets.push({
        target,
        line: lineNumberAt(searchableSource, match.index ?? 0),
      });
  }

  for (const pattern of [inlineLinkPattern, htmlLinkPattern]) {
    for (const match of searchableSource.matchAll(pattern)) {
      const target = (match[1] ?? match[2] ?? "").trim();
      if (target)
        targets.push({
          target,
          line: lineNumberAt(searchableSource, match.index ?? 0),
        });
    }
  }

  for (const match of searchableSource.matchAll(referenceUsagePattern)) {
    const referenceLabel = normalizeReferenceLabel(match[2] || match[1]);
    if (!definedReferenceLabels.has(referenceLabel)) {
      undefinedReferences.push({
        label: match[2] || match[1],
        line: lineNumberAt(searchableSource, match.index ?? 0),
      });
    }
  }

  return { targets, undefinedReferences };
}

function isExternalTarget(target) {
  return /^(?:https?:|mailto:|tel:|data:|\/\/)/i.test(target);
}

function stripQueryAndFragment(target) {
  const boundary = target.search(/[?#]/);
  return boundary === -1 ? target : target.slice(0, boundary);
}

function decodeTarget(target) {
  try {
    return decodeURIComponent(target);
  } catch {
    return target;
  }
}

function unescapeMarkdownTarget(target) {
  return target.replace(/\\([!"#$%&'()*+,\-./:;<=>?@[\]^_`{|}~\\])/g, "$1");
}

function targetFragment(target) {
  const fragmentIndex = target.indexOf("#");
  return fragmentIndex === -1
    ? ""
    : decodeTarget(target.slice(fragmentIndex + 1));
}

function markdownHeadingSlug(value) {
  return value
    .replace(/<[^>]*>/g, "")
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/!?\[([^\]]*)\]\[[^\]]*\]/g, "$1")
    .replace(/[`*_~]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[^\p{Letter}\p{Number}\s_-]/gu, "")
    .replace(/\s+/g, "-");
}

function extractHeadingAnchors(source) {
  const anchors = new Set();
  const duplicateCounts = new Map();

  for (const line of linesOutsideFences(source)) {
    const headingMatch = line.match(/^\s{0,3}#{1,6}\s+(.+?)\s*#*\s*$/);
    if (!headingMatch) continue;

    const baseSlug = markdownHeadingSlug(headingMatch[1]);
    if (!baseSlug) continue;
    const duplicateCount = duplicateCounts.get(baseSlug) ?? 0;
    anchors.add(
      duplicateCount === 0 ? baseSlug : `${baseSlug}-${duplicateCount}`,
    );
    duplicateCounts.set(baseSlug, duplicateCount + 1);
  }

  for (const match of source.matchAll(
    /<(?:h[1-6]|a)\b[^>]*\bid=["']([^"']+)["'][^>]*>/gi,
  )) {
    anchors.add(match[1]);
  }

  return anchors;
}

async function verifyExactPath(projectRoot, targetPath) {
  return inspectRepositoryPath(projectRoot, targetPath);
}

function isUnsafeEnvironmentLink(resolvedPath) {
  const basename = path.basename(resolvedPath).toLowerCase();
  return (
    basename === ".env" ||
    basename.startsWith(".env.") ||
    basename === ".dev.vars" ||
    basename.startsWith(".dev.vars.")
  );
}

function linksIntoGeneratedDirectory(projectRoot, resolvedPath) {
  const segments = path.relative(projectRoot, resolvedPath).split(path.sep);
  return segments.some((segment) => generatedDirectoryNames.has(segment));
}

function scanDocumentContent(relativePath, source) {
  const errors = [];
  const structuralLines = linesOutsideFences(source);
  const h1Count = structuralLines.filter(
    (line) => /^#(?!#)\s+\S/.test(line) || /<h1\b/i.test(line),
  ).length;

  if (relativePath !== "AGENTS.md" && h1Count !== 1) {
    errors.push(`expected exactly one H1, found ${h1Count}`);
  }
  errors.push(...findFenceErrors(source));

  if (/[A-Za-z]:[\\/]Users[\\/]/i.test(source)) {
    errors.push("contains an absolute Windows user path");
  }

  if (
    /https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\])/i.test(source) &&
    !localDevelopmentDocuments.has(relativePath)
  ) {
    errors.push(
      "contains a localhost URL outside an approved local-development document",
    );
  }

  if (privateWorkbookPatterns.some((pattern) => pattern.test(source))) {
    errors.push("contains a private-workbook URL pattern");
  }
  if (privateUnixPathPattern.test(source)) {
    errors.push("contains an absolute macOS or Linux user path");
  }
  if (
    [...source.matchAll(credentialUrlPattern)].some(
      (match) =>
        !isSafeSensitivePlaceholder(match[1]) ||
        !isSafeSensitivePlaceholder(match[2]),
    )
  ) {
    errors.push("contains a credential-bearing URL");
  }
  if (realKeyPattern.test(source)) {
    errors.push("contains a key-shaped credential value");
  }
  for (const line of source.split(/\r?\n/)) {
    const assignedValue = sensitiveAssignmentPattern.exec(line)?.[1];
    if (!assignedValue) continue;
    const normalizedValue = assignedValue.replace(/^["']|["',;)]$/g, "");
    if (!isSafeSensitivePlaceholder(normalizedValue)) {
      errors.push("contains a sensitive configuration assignment");
      break;
    }
  }

  if (obviousPlaceholderPatterns.some((pattern) => pattern.test(source))) {
    errors.push("contains an obvious unresolved placeholder");
  }

  if (
    /(?:committed|checked[- ]in).{0,80}(?:\.next\/|out\/|coverage\/)/i.test(
      source,
    ) ||
    /(?:\.next\/|out\/|coverage\/).{0,80}(?:committed source|checked[- ]in source)/i.test(
      source,
    )
  ) {
    errors.push("describes a generated output directory as committed source");
  }

  return errors;
}

function scanRepositorySkill(relativePath, source) {
  const skillPath = /^\.agents\/skills\/([^/]+)\/SKILL\.md$/.exec(relativePath);
  if (!skillPath) return [];

  const frontmatter = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source)?.[1];
  if (!frontmatter) return ["skill is missing YAML frontmatter"];

  const name = /^name:[ \t]*([^\r\n]+?)[ \t]*$/m.exec(frontmatter)?.[1]?.trim();
  const description = /^description:[ \t]*(\S(?:.*\S)?)[ \t]*$/m.exec(frontmatter)?.[1]?.trim();
  if (name !== skillPath[1]) return ["skill name must match its directory"];
  if (!description) return ["skill frontmatter requires a description"];

  return [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isSafeManifestPath(
  value,
  { allowGlob = false, allowEnvironmentExample = false } = {},
) {
  if (
    typeof value !== "string" ||
    !value ||
    value.startsWith("/") ||
    value.includes("\\")
  )
    return false;
  if (value.includes("#") || value.includes("?")) return false;

  const segments = value.split("/");
  return segments.every((segment) => {
    if (!segment || segment === "." || segment === "..") return false;
    const lowerCaseSegment = segment.toLowerCase();
    if (
      lowerCaseSegment === ".env" ||
      (lowerCaseSegment.startsWith(".env.") &&
        !(allowEnvironmentExample && value === ".env.example")) ||
      lowerCaseSegment === ".dev.vars" ||
      lowerCaseSegment.startsWith(".dev.vars.") ||
      privatePathSegments.has(lowerCaseSegment) ||
      ignoredRepositoryDirectories.has(lowerCaseSegment)
    )
      return false;
    return (
      allowGlob ||
      !["?", "*", "[", "]", "{", "}"].some((character) =>
        segment.includes(character),
      )
    );
  });
}

function isFunctionalRootFile(relativePath) {
  return !relativePath.includes("/") && !nonFunctionalRootFiles.has(relativePath);
}

function pathPatternToRegExp(pattern) {
  let expression = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*") {
      if (pattern[index + 1] === "*") {
        expression += ".*";
        index += 1;
      } else {
        expression += "[^/]*";
      }
    } else if (/[|\\{}()[\]^$+?.]/.test(character)) {
      expression += "\\" + character;
    } else {
      expression += character;
    }
  }
  return new RegExp(expression + "$");
}

function ownerCoversPath(owner, relativePath) {
  return (
    owner.entrypoints.includes(relativePath) ||
    owner.pathPatterns.some((pattern) =>
      pathPatternToRegExp(pattern).test(relativePath),
    )
  );
}

function npmScriptName(command) {
  return /^npm run ([A-Za-z0-9:_-]+)(?:\s|$)/.exec(command)?.[1];
}

function documentedNpmCommands(source) {
  return [...source.matchAll(/\bnpm\s+run\s+([A-Za-z0-9:_-]+)/g)].map(
    (match) => match[1],
  );
}

function markdownReference(reference) {
  if (typeof reference !== "string") return undefined;
  const match = /^([^#]+)#([A-Za-z0-9_-]+)$/.exec(reference);
  if (!match) return undefined;
  return { filePath: match[1], anchor: match[2] };
}

async function exactFileExists(projectRoot, relativePath) {
  try {
    const target = path.join(projectRoot, relativePath);
    const result = await verifyExactPath(projectRoot, target);
    return Boolean(result.exists && result.exactCase && result.stats?.isFile());
  } catch {
    return false;
  }
}

function isTaskCardPath(value) {
  return (
    typeof value === "string" &&
    /^\.agents\/cards\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(value)
  );
}

async function isCardInsideRepository(projectRoot, relativePath) {
  if (!isTaskCardPath(relativePath)) return false;

  try {
    const result = await inspectRepositoryPath(
      projectRoot,
      path.join(projectRoot, relativePath),
    );
    return Boolean(result.exists && result.exactCase && result.stats?.isFile());
  } catch {
    return false;
  }
}

function pushManifestError(errors, message) {
  errors.push(`${ownershipManifestPath}: ${message}`);
}

async function validateOwnershipManifest({
  projectRoot,
  documents,
  headingAnchorsByPath,
  requireOwnershipMap,
}) {
  const absoluteManifestPath = path.join(projectRoot, ownershipManifestPath);
  const errors = [];
  const documentSourcesByPath = new Map(
    documents.map(({ filePath, source }) => [path.resolve(filePath), source]),
  );
  const documentSource = (relativePath) =>
    documentSourcesByPath.get(path.resolve(projectRoot, relativePath));
  const missingBootstrapPaths = [];
  if (requireOwnershipMap) {
    for (const relativePath of bootstrapPaths) {
      if (!(await exactFileExists(projectRoot, relativePath))) {
        missingBootstrapPaths.push(relativePath);
        pushManifestError(
          errors,
          "required bootstrap file is missing: " + relativePath,
        );
      }
    }
  }
  if (!(await exactFileExists(projectRoot, ownershipManifestPath))) {
    if (requireOwnershipMap)
      pushManifestError(errors, "required ownership manifest is missing");
    return errors;
  }

  let manifest;
  try {
    manifest = JSON.parse(
      await readRepositoryFile(projectRoot, absoluteManifestPath),
    );
  } catch {
    pushManifestError(errors, "must contain valid JSON");
    return errors;
  }

  if (!isPlainObject(manifest)) {
    pushManifestError(errors, "must contain an object");
    return errors;
  }
  if (manifest.schemaVersion !== 1)
    pushManifestError(errors, "schemaVersion must be 1");
  if (
    !Array.isArray(manifest.bootstrap) ||
    manifest.bootstrap.length !== bootstrapPaths.length ||
    manifest.bootstrap.some((entry, index) => entry !== bootstrapPaths[index])
  ) {
    pushManifestError(
      errors,
      "bootstrap must list " + bootstrapPaths.join(", ") + " in order",
    );
  }

  const bootstrapSize = await Promise.all(
    bootstrapPaths.map(async (relativePath) => {
      const source = documentSource(relativePath);
      if (typeof source === "string") return Buffer.byteLength(source);
      if (!missingBootstrapPaths.includes(relativePath)) {
        pushManifestError(errors, "bootstrap file does not exist: " + relativePath);
      }
      return 0;
    }),
  );
  const totalBootstrapBytes = bootstrapSize.reduce((sum, size) => sum + size, 0);
  if (totalBootstrapBytes > bootstrapByteBudget) {
    pushManifestError(
      errors,
      "combined bootstrap size " +
        totalBootstrapBytes +
        " exceeds " +
        bootstrapByteBudget +
        " byte budget",
    );
  }

  if (
    typeof manifest.mapDocument !== "string" ||
    !isSafeManifestPath(manifest.mapDocument) ||
    !manifest.mapDocument.endsWith(".md") ||
    !(await exactFileExists(projectRoot, manifest.mapDocument))
  ) {
    pushManifestError(errors, "mapDocument must be an existing repository Markdown file");
  }

  const taskCards = new Set(
    documents
      .map(({ filePath }) => toPosix(path.relative(projectRoot, filePath)))
      .filter(
        (relativePath) =>
          /^\.agents\/cards\/[^/]+\.md$/.test(relativePath) ||
          /^\.agents\/skills\/[^/]+\/SKILL\.md$/.test(relativePath),
      ),
  );
  for (const relativePath of taskCards) {
    const source = documentSource(relativePath);
    if (typeof source !== "string") {
      pushManifestError(errors, "task card could not be read: " + relativePath);
      continue;
    }
    const size = Buffer.byteLength(source);
    if (size > taskCardByteBudget) {
      pushManifestError(
        errors,
        "task card " +
          relativePath +
          " size " +
          size +
          " exceeds " +
          taskCardByteBudget +
          " byte budget",
      );
    }
  }

  if (!Array.isArray(manifest.owners) || manifest.owners.length === 0) {
    pushManifestError(errors, "owners must be a non-empty array");
    return errors;
  }

  let packageScripts = {};
  try {
    packageScripts = JSON.parse(
      await readRepositoryFile(projectRoot, path.join(projectRoot, "package.json")),
    ).scripts;
  } catch {
    pushManifestError(errors, "could not read package.json scripts");
  }
  const documentedCommandExceptions = new Set();
  if (!Array.isArray(manifest.documentationCommandExceptions)) {
    pushManifestError(errors, "documentationCommandExceptions must be an array");
  } else {
    for (const exception of manifest.documentationCommandExceptions) {
      if (
        !isPlainObject(exception) ||
        !isSafeManifestPath(exception.document) ||
        !exception.document.endsWith(".md") ||
        !(await exactFileExists(projectRoot, exception.document)) ||
        typeof exception.command !== "string" ||
        !/^[A-Za-z0-9:_-]+$/.test(exception.command) ||
        typeof exception.reason !== "string" ||
        !exception.reason.trim()
      ) {
        pushManifestError(
          errors,
          "documentation command exceptions require a Markdown document, command, and reason",
        );
        continue;
      }
      documentedCommandExceptions.add(
        exception.document + ":" + exception.command,
      );
    }
  }
  for (const { filePath, source } of documents) {
    const relativePath = toPosix(path.relative(projectRoot, filePath));
    for (const scriptName of documentedNpmCommands(source)) {
      if (
        !packageScripts?.[scriptName] &&
        !documentedCommandExceptions.has(relativePath + ":" + scriptName)
      ) {
        pushManifestError(
          errors,
          "document references an unknown npm command: " +
            relativePath +
            " -> npm run " +
            scriptName,
        );
      }
    }
  }
  const { files: repositoryFiles, symlinks: repositorySymlinks } =
    await listRepositoryFiles(projectRoot, projectRoot);
  const ownerIds = new Set();
  const intents = new Set();

  for (const owner of manifest.owners) {
    if (!isPlainObject(owner)) {
      pushManifestError(errors, "each owner must be an object");
      continue;
    }
    if (
      typeof owner.id !== "string" ||
      !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(owner.id)
    ) {
      pushManifestError(errors, "owner id must be a lowercase kebab-case string");
      continue;
    }
    if (ownerIds.has(owner.id))
      pushManifestError(errors, "owner id is duplicated: " + owner.id);
    ownerIds.add(owner.id);

    const fields = [
      ["aliases", owner.aliases],
      ["entrypoints", owner.entrypoints],
      ["tests", owner.tests],
      ["pathPatterns", owner.pathPatterns],
      ["documentation", owner.documentation],
      ["commands", owner.commands],
      ["reuse", owner.reuse],
      ["risks", owner.risks],
    ];
    for (const [field, values] of fields) {
      if (!Array.isArray(values) || values.length === 0)
        pushManifestError(errors, "owner " + owner.id + " requires " + field);
    }
    if (!Array.isArray(owner.aliases)) continue;
    for (const intent of [owner.id, ...owner.aliases]) {
      if (
        typeof intent !== "string" ||
        !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(intent)
      ) {
        pushManifestError(errors, "owner " + owner.id + " has an invalid intent alias");
      } else if (intents.has(intent)) {
        pushManifestError(errors, "intent alias is duplicated: " + intent);
      } else {
        intents.add(intent);
      }
    }

    let cardSource;
    if (
      !isTaskCardPath(owner.card) ||
      !(await exactFileExists(projectRoot, owner.card)) ||
      !(await isCardInsideRepository(projectRoot, owner.card))
    ) {
      pushManifestError(
        errors,
        "owner " + owner.id + " requires an existing Markdown card",
      );
    } else {
      cardSource = documentSource(owner.card);
      if (typeof cardSource !== "string") {
        pushManifestError(
          errors,
          "owner " + owner.id + " requires an existing Markdown card",
        );
        cardSource = undefined;
      }
    }

    if (Array.isArray(owner.entrypoints)) {
      for (const entrypoint of owner.entrypoints) {
        if (
          !isSafeManifestPath(entrypoint) ||
          !(await exactFileExists(projectRoot, entrypoint))
        ) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " has an invalid or private entrypoint: " +
              entrypoint,
          );
        }
        if (typeof entrypoint === "string" && entrypoint.startsWith("src/features/")) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " must use src/components/portfolio instead of src/features",
          );
        }
      }
    }
    if (Array.isArray(owner.tests)) {
      for (const testPath of owner.tests) {
        if (
          !isSafeManifestPath(testPath) ||
          !(await exactFileExists(projectRoot, testPath))
        ) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " has an invalid or private test path: " +
              testPath,
          );
        }
      }
    }
    if (Array.isArray(owner.pathPatterns)) {
      for (const pattern of owner.pathPatterns) {
        if (!isSafeManifestPath(pattern, { allowGlob: true })) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " has an invalid or private path pattern: " +
              pattern,
          );
          continue;
        }
        if (
          !repositoryFiles.some((filePath) =>
            pathPatternToRegExp(pattern).test(filePath),
          )
        ) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " path pattern matches no repository file: " +
              pattern,
          );
        }
        if (pattern.startsWith("src/features/")) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " must use src/components/portfolio instead of src/features",
          );
        }
      }
    }
    if (Array.isArray(owner.documentation)) {
      for (const reference of owner.documentation) {
        const parsedReference = markdownReference(reference);
        if (!parsedReference || !isSafeManifestPath(parsedReference.filePath)) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " has an invalid documentation reference: " +
              reference,
          );
          continue;
        }
        const absoluteDocumentationPath = path.join(
          projectRoot,
          parsedReference.filePath,
        );
        if (!(await exactFileExists(projectRoot, parsedReference.filePath))) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " documentation file does not exist: " +
              reference,
          );
          continue;
        }
        let anchors = headingAnchorsByPath.get(absoluteDocumentationPath);
        if (!anchors) {
          let source = documentSource(parsedReference.filePath);
          if (typeof source !== "string") {
            try {
              source = await readRepositoryFile(projectRoot, absoluteDocumentationPath);
            } catch {
              pushManifestError(
                errors,
                "owner " +
                  owner.id +
                  " documentation file does not exist: " +
                  reference,
              );
              continue;
            }
          }
          anchors = extractHeadingAnchors(source);
          headingAnchorsByPath.set(absoluteDocumentationPath, anchors);
        }
        if (!anchors.has(parsedReference.anchor)) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " documentation anchor does not exist: " +
              reference,
          );
        }
      }
    }
    if (Array.isArray(owner.commands)) {
      for (const command of owner.commands) {
        const scriptName = typeof command === "string" && npmScriptName(command);
        if (!scriptName || !packageScripts?.[scriptName]) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " references an unknown npm command: " +
              command,
          );
        }
      }
    }
    if (Array.isArray(owner.reuse)) {
      for (const primitive of owner.reuse) {
        if (
          !isSafeManifestPath(primitive) ||
          !(await exactFileExists(projectRoot, primitive))
        ) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " has an invalid or private reuse primitive: " +
              primitive,
          );
        }
      }
    }
    if (
      Array.isArray(owner.risks) &&
      owner.risks.some((risk) => typeof risk !== "string" || !risk.trim())
    ) {
      pushManifestError(errors, "owner " + owner.id + " has an empty risk");
    }

    if (
      cardSource &&
      Array.isArray(owner.entrypoints) &&
      Array.isArray(owner.tests) &&
      Array.isArray(owner.documentation)
    ) {
      const cardTargets = new Set(
        extractLinkData(cardSource).targets.map(({ target }) => target),
      );
      const cardDirectory = path.posix.dirname(owner.card);
      const targetFromCard = (targetPath) =>
        toPosix(path.posix.relative(cardDirectory, targetPath));
      if (
        !owner.entrypoints.some((entrypoint) =>
          cardTargets.has(targetFromCard(entrypoint)),
        )
      ) {
        pushManifestError(
          errors,
          "owner " + owner.id + " card must link a concrete entrypoint",
        );
      }
      if (
        !owner.tests.some((testPath) => cardTargets.has(targetFromCard(testPath)))
      ) {
        pushManifestError(
          errors,
          "owner " + owner.id + " card must link a concrete test",
        );
      }
      for (const reference of owner.documentation) {
        const parsedReference = markdownReference(reference);
        if (!parsedReference) continue;
        const target =
          targetFromCard(parsedReference.filePath) + "#" + parsedReference.anchor;
        if (!cardTargets.has(target)) {
          pushManifestError(
            errors,
            "owner " +
              owner.id +
              " card must link documentation: " +
              reference,
          );
        }
      }
    }
  }

  const ownerById = new Map(
    manifest.owners
      .filter(
        (owner) =>
          isPlainObject(owner) &&
          typeof owner.id === "string" &&
          Array.isArray(owner.entrypoints) &&
          Array.isArray(owner.pathPatterns),
      )
      .map((owner) => [owner.id, owner]),
  );

  const exceptionPaths = new Set(
    Array.isArray(manifest.codePathExceptions)
      ? manifest.codePathExceptions
          .filter((exception) => isPlainObject(exception))
          .map((exception) => exception.path)
      : [],
  );
  const relevantRepositoryFiles = repositoryFiles.filter(
    (filePath) =>
      /^(?:src|functions|migrations|scripts|tests|docs|\.agents|\.github|infrastructure|infra)\//.test(
        filePath,
      ) ||
      filePath === "AGENTS.md" ||
      filePath === "README.md" ||
      isFunctionalRootFile(filePath),
  );
  for (const exceptionPath of exceptionPaths) {
    if (!relevantRepositoryFiles.includes(exceptionPath))
      relevantRepositoryFiles.push(exceptionPath);
  }
  for (const symlinkPath of repositorySymlinks) {
    if (relevantRepositoryFiles.includes(symlinkPath)) {
      pushManifestError(
        errors,
        "relevant repository path must not be a symlink: " + symlinkPath,
      );
    }
  }
  for (const filePath of relevantRepositoryFiles) {
    if (
      ![...ownerById.values()].some((owner) => ownerCoversPath(owner, filePath)) &&
      !exceptionPaths.has(filePath)
    ) {
      pushManifestError(
        errors,
        "relevant repository path has no owner or explicit exception: " + filePath,
      );
    }
  }

  const portfolioOwners = manifest.owners.filter(
    (owner) => typeof owner?.id === "string" && owner.id.startsWith("portfolio-"),
  );
  const portfolioRoot = path.join(projectRoot, "src/components/portfolio");
  try {
    const featureDirectories = await readdir(portfolioRoot, {
      withFileTypes: true,
    });
    for (const directory of featureDirectories.filter((entry) => entry.isDirectory())) {
      const prefix = "src/components/portfolio/" + directory.name + "/";
      const files = repositoryFiles.filter((filePath) => filePath.startsWith(prefix));
      if (
        files.length > 0 &&
        !files.every((filePath) =>
          portfolioOwners.some(
            (owner) =>
              Array.isArray(owner.entrypoints) &&
              Array.isArray(owner.pathPatterns) &&
              ownerCoversPath(owner, filePath),
          ),
        )
      ) {
        pushManifestError(
          errors,
          "portfolio feature group is not covered: " + directory.name,
        );
      }
    }
  } catch {
    pushManifestError(errors, "src/components/portfolio must exist");
  }

  if (!Array.isArray(manifest.codePathExceptions)) {
    pushManifestError(errors, "codePathExceptions must be an array");
  } else {
    for (const exception of manifest.codePathExceptions) {
      if (
        !isPlainObject(exception) ||
        !isSafeManifestPath(exception.path, { allowEnvironmentExample: true }) ||
        !(await exactFileExists(projectRoot, exception.path)) ||
        typeof exception.reason !== "string" ||
        !exception.reason.trim()
      ) {
        pushManifestError(
          errors,
          "code path exceptions require an existing public path and reason",
        );
      }
    }
  }

  const infrastructureDirectories = ["infrastructure", "infra"];
  const infrastructureExists = (
    await Promise.all(
      infrastructureDirectories.map(async (directory) => {
        const inspection = await inspectRepositoryPath(
          projectRoot,
          path.join(projectRoot, directory),
        );
        return Boolean(
          inspection.exists &&
            inspection.exactCase &&
            inspection.stats?.isDirectory(),
        );
      }),
    )
  ).some(Boolean);
  const infrastructureFuture = Array.isArray(manifest.future)
    ? manifest.future.find((entry) => entry?.id === "infrastructure")
    : undefined;
  if (
    !isPlainObject(infrastructureFuture) ||
    !["not-implemented", "implemented"].includes(infrastructureFuture.status) ||
    typeof infrastructureFuture.reason !== "string" ||
    !infrastructureFuture.reason.trim()
  ) {
    pushManifestError(
      errors,
      "infrastructure must declare implemented or not-implemented status with a reason",
    );
  }
  if (infrastructureExists && infrastructureFuture?.status === "not-implemented") {
    pushManifestError(
      errors,
      "infrastructure exists but is still marked not-implemented",
    );
  }
  if (!infrastructureExists && infrastructureFuture?.status === "implemented") {
    pushManifestError(
      errors,
      "infrastructure is marked implemented but no infrastructure directory exists",
    );
  }
  if (infrastructureFuture?.status === "implemented") {
    const infrastructureOwner = ownerById.get(infrastructureFuture.owner);
    if (!infrastructureOwner) {
      pushManifestError(
        errors,
        "implemented infrastructure requires an owning manifest owner",
      );
    } else {
      const infrastructureFiles = repositoryFiles.filter((filePath) =>
        /^(?:infrastructure|infra)\//.test(filePath),
      );
      if (
        infrastructureFiles.some(
          (filePath) => !ownerCoversPath(infrastructureOwner, filePath),
        )
      ) {
        pushManifestError(
          errors,
          "implemented infrastructure owner must cover every infrastructure path",
        );
      }
    }
  }

  return errors;
}

export async function validateDocumentation({
  projectRoot = defaultProjectRoot,
  requireOwnershipMap = true,
} = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const docsDirectory = path.join(resolvedProjectRoot, "docs");
  const readmePath = path.join(resolvedProjectRoot, "README.md");
  const agentGuidancePath = path.join(resolvedProjectRoot, "AGENTS.md");
  const agentDirectory = path.join(resolvedProjectRoot, ".agents");
  const unsafeDocumentPaths = new Set();
  const docsInspection = await inspectRepositoryPath(
    resolvedProjectRoot,
    docsDirectory,
  );
  if (
    !docsInspection.unsafe &&
    (!docsInspection.exists ||
      !docsInspection.exactCase ||
      !docsInspection.stats?.isDirectory())
  ) {
    throw new Error("docs must be a directory");
  }
  if (docsInspection.unsafe) {
    unsafeDocumentPaths.add(diagnosticRelativePath(resolvedProjectRoot, docsDirectory));
  }

  const readmeInspection = await inspectRepositoryPath(
    resolvedProjectRoot,
    readmePath,
  );
  if (
    !readmeInspection.unsafe &&
    (!readmeInspection.exists ||
      !readmeInspection.exactCase ||
      !readmeInspection.stats?.isFile())
  ) {
    throw new Error("README.md must be a file");
  }
  if (readmeInspection.unsafe) {
    unsafeDocumentPaths.add(diagnosticRelativePath(resolvedProjectRoot, readmePath));
  }
  const agentGuidanceInspection = await inspectRepositoryPath(
    resolvedProjectRoot,
    agentGuidancePath,
  );
  if (agentGuidanceInspection.unsafe) {
    unsafeDocumentPaths.add(
      diagnosticRelativePath(resolvedProjectRoot, agentGuidancePath),
    );
  }

  const documentationFiles = docsInspection.unsafe
    ? []
    : await listMarkdownFiles(
        docsDirectory,
        resolvedProjectRoot,
        unsafeDocumentPaths,
      );
  const infrastructureMarkdownFiles = (
    await Promise.all(
      ["infrastructure", "infra"].map((directory) =>
        listOptionalMarkdownFiles(
          path.join(resolvedProjectRoot, directory),
          resolvedProjectRoot,
          unsafeDocumentPaths,
        ),
      ),
    )
  ).flat();
  const agentMarkdownFiles = await listOptionalMarkdownFiles(
    agentDirectory,
    resolvedProjectRoot,
    unsafeDocumentPaths,
  );
  const markdownFiles = [...new Set([
    ...(readmeInspection.exists &&
    readmeInspection.exactCase &&
    readmeInspection.stats?.isFile()
      ? [readmePath]
      : []),
    ...documentationFiles,
    ...(agentGuidanceInspection.exists &&
    agentGuidanceInspection.exactCase &&
    agentGuidanceInspection.stats?.isFile()
      ? [agentGuidancePath]
      : []),
    ...agentMarkdownFiles,
    ...infrastructureMarkdownFiles,
  ])];
  const documents = await Promise.all(
    markdownFiles.map(async (filePath) => ({
      filePath,
      source: await readRepositoryFile(resolvedProjectRoot, filePath),
    })),
  );
  const headingAnchorsByPath = new Map(
    documents.map(({ filePath, source }) => [
      path.resolve(filePath),
      extractHeadingAnchors(source),
    ]),
  );
  const errors = [...unsafeDocumentPaths]
    .sort((left, right) => left.localeCompare(right))
    .map((relativePath) =>
      `${relativePath}: documentation path must not be a symlink`,
    );

  async function validateHeadingFragment(
    filePath,
    fragment,
    relativePath,
    line,
    target,
  ) {
    if (!fragment || path.extname(filePath).toLowerCase() !== ".md") return;

    const resolvedFilePath = path.resolve(filePath);
    let anchors = headingAnchorsByPath.get(resolvedFilePath);
    if (!anchors) {
      try {
        anchors = extractHeadingAnchors(
          await readRepositoryFile(resolvedProjectRoot, resolvedFilePath),
        );
        headingAnchorsByPath.set(resolvedFilePath, anchors);
      } catch {
        return;
      }
    }

    if (!anchors.has(fragment)) {
      errors.push(
        `${relativePath}:${line}: Markdown heading fragment does not exist: ${target}`,
      );
    }
  }

  async function validateRootRelativeTarget(
    filePath,
    relativePath,
    line,
    target,
  ) {
    const cleanTarget = unescapeMarkdownTarget(
      decodeTarget(stripQueryAndFragment(target)),
    ).replace(/^\/+/, "");
    if (!cleanTarget) return;

    const publicDirectory = path.join(resolvedProjectRoot, "public");
    const segments = cleanTarget.split("/");
    const firstSegment = segments[0];
    const basename = segments.at(-1) ?? "";

    if (isUnsafeEnvironmentLink(path.join(publicDirectory, ...segments))) {
      errors.push(`${relativePath}:${line}: links to a local environment file`);
      return;
    }

    if (generatedDirectoryNames.has(firstSegment)) {
      errors.push(
        `${relativePath}:${line}: links into a generated output directory: ${target}`,
      );
      return;
    }

    if (
      generatedRootFiles.has(cleanTarget) ||
      cleanTarget === "api" ||
      cleanTarget.startsWith("api/")
    )
      return;

    let publicEntries = [];
    try {
      publicEntries = await readdir(publicDirectory);
    } catch {
      // The normal repository always has public/. A missing directory is handled as a missing asset below.
    }

    const addressesPublicEntry = publicEntries.some(
      (entry) => entry.toLowerCase() === firstSegment.toLowerCase(),
    );
    const looksLikeAsset =
      addressesPublicEntry || Boolean(path.extname(basename));
    if (!looksLikeAsset) return;

    const resolvedTarget = path.resolve(publicDirectory, ...segments);
    const relativeToPublic = path.relative(publicDirectory, resolvedTarget);
    if (
      relativeToPublic.startsWith("..") ||
      path.isAbsolute(relativeToPublic)
    ) {
      errors.push(
        `${relativePath}:${line}: root-relative asset link escapes public/: ${target}`,
      );
      return;
    }

    let result;
    try {
      result = await verifyExactPath(resolvedProjectRoot, resolvedTarget);
    } catch {
      result = { exists: false, exactCase: false };
    }

    if (!result.exists) {
      errors.push(
        `${relativePath}:${line}: root-relative asset target does not exist: ${target}`,
      );
    } else if (!result.exactCase) {
      errors.push(
        `${relativePath}:${line}: root-relative asset capitalization does not match the filesystem: ${target}`,
      );
    }
  }

  for (const { filePath, source } of documents) {
    const relativePath = toPosix(path.relative(resolvedProjectRoot, filePath));

    for (const error of scanDocumentContent(relativePath, source)) {
      errors.push(`${relativePath}: ${error}`);
    }
    for (const error of scanRepositorySkill(relativePath, source)) {
      errors.push(`${relativePath}: ${error}`);
    }

    const { targets, undefinedReferences } = extractLinkData(source);
    for (const { label, line } of undefinedReferences) {
      errors.push(
        `${relativePath}:${line}: reference link has no definition: ${label}`,
      );
    }

    for (const { target, line } of targets) {
      if (isExternalTarget(target)) continue;

      if (target.startsWith("/")) {
        await validateRootRelativeTarget(filePath, relativePath, line, target);
        continue;
      }

      const fragment = targetFragment(target);
      const cleanTarget = unescapeMarkdownTarget(
        decodeTarget(stripQueryAndFragment(target).replaceAll("\\ ", " ")),
      );
      const resolvedTarget = cleanTarget
        ? path.resolve(path.dirname(filePath), cleanTarget)
        : filePath;
      if (!cleanTarget) {
        await validateHeadingFragment(
          resolvedTarget,
          fragment,
          relativePath,
          line,
          target,
        );
        continue;
      }

      if (isUnsafeEnvironmentLink(resolvedTarget)) {
        errors.push(
          `${relativePath}:${line}: links to a local environment file`,
        );
        continue;
      }
      if (linksIntoGeneratedDirectory(resolvedProjectRoot, resolvedTarget)) {
        errors.push(
          `${relativePath}:${line}: links into a generated output directory: ${target}`,
        );
        continue;
      }

      let result;
      try {
        result = await verifyExactPath(resolvedProjectRoot, resolvedTarget);
      } catch {
        result = { exists: false, exactCase: false };
      }

      if (result.escaped) {
        errors.push(
          `${relativePath}:${line}: relative link escapes the repository: ${target}`,
        );
      } else if (!result.exists) {
        errors.push(
          `${relativePath}:${line}: relative link target does not exist: ${target}`,
        );
      } else if (!result.exactCase) {
        errors.push(
          `${relativePath}:${line}: relative link capitalization does not match the filesystem: ${target}`,
        );
      } else {
        await validateHeadingFragment(
          resolvedTarget,
          fragment,
          relativePath,
          line,
          target,
        );
      }
    }
  }

  errors.push(
    ...(await validateOwnershipManifest({
      projectRoot: resolvedProjectRoot,
      documents,
      headingAnchorsByPath,
      requireOwnershipMap,
    })),
  );

  return {
    checkedFiles: markdownFiles.map((filePath) =>
      toPosix(path.relative(resolvedProjectRoot, filePath)),
    ),
    errors,
  };
}

async function runCli() {
  const result = await validateDocumentation();
  if (result.errors.length > 0) {
    for (const error of result.errors) console.error(error);
    throw new Error(
      `Documentation validation failed with ${result.errors.length} error(s).`,
    );
  }

  console.log(
    `Documentation validation passed for ${result.checkedFiles.length} Markdown files.`,
  );
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
