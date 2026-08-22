import { access, readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultProjectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const generatedDirectoryNames = new Set([".next", "coverage", "out"]);
const generatedRootFiles = new Set([
  "artifact-integrity.json",
  "content-version.json",
]);
const localDevelopmentDocuments = new Set([
  "README.md",
  "docs/LOCAL_DEVELOPMENT.md",
  "docs/TROUBLESHOOTING.md",
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

const excludedLocalProcessPatterns = [
  /\b\x43\x6f\x64\x65\x78\b/i,
  /\b\x4d\x43\x50\b/i,
  /\b\x41\x47\x45\x4e\x54S?\.md\b/i,
];

function toPosix(relativePath) {
  return relativePath.split(path.sep).join("/");
}

async function listMarkdownFiles(directory) {
  const files = [];
  const entries = await readdir(directory, { withFileTypes: true });
  entries.sort((left, right) => left.name.localeCompare(right.name));

  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await listMarkdownFiles(absolutePath)));
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".md")) {
      files.push(absolutePath);
    }
  }

  return files;
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
  const resolvedTarget = path.resolve(targetPath);
  const relativeTarget = path.relative(projectRoot, resolvedTarget);

  if (!relativeTarget || relativeTarget === ".")
    return { exists: true, exactCase: true };
  if (relativeTarget.startsWith("..") || path.isAbsolute(relativeTarget)) {
    return { exists: false, exactCase: false, escaped: true };
  }

  let currentDirectory = projectRoot;
  for (const segment of relativeTarget.split(path.sep)) {
    const entries = await readdir(currentDirectory);
    const exactEntry = entries.find((entry) => entry === segment);
    if (exactEntry) {
      currentDirectory = path.join(currentDirectory, exactEntry);
      continue;
    }

    const caseInsensitiveEntry = entries.find(
      (entry) => entry.toLowerCase() === segment.toLowerCase(),
    );
    if (caseInsensitiveEntry) {
      return {
        exists: true,
        exactCase: false,
        actualSegment: caseInsensitiveEntry,
        expectedSegment: segment,
      };
    }

    return { exists: false, exactCase: false };
  }

  try {
    await access(resolvedTarget);
    return { exists: true, exactCase: true };
  } catch {
    return { exists: false, exactCase: false };
  }
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

  if (h1Count !== 1) errors.push(`expected exactly one H1, found ${h1Count}`);
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

  if (obviousPlaceholderPatterns.some((pattern) => pattern.test(source))) {
    errors.push("contains an obvious unresolved placeholder");
  }

  if (excludedLocalProcessPatterns.some((pattern) => pattern.test(source))) {
    errors.push("contains excluded local tooling terminology");
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

export async function validateDocumentation({
  projectRoot = defaultProjectRoot,
} = {}) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const docsDirectory = path.join(resolvedProjectRoot, "docs");
  const readmePath = path.join(resolvedProjectRoot, "README.md");
  const docsStats = await stat(docsDirectory);
  if (!docsStats.isDirectory()) throw new Error("docs must be a directory");

  const markdownFiles = [
    readmePath,
    ...(await listMarkdownFiles(docsDirectory)),
  ];
  const documents = await Promise.all(
    markdownFiles.map(async (filePath) => ({
      filePath,
      source: await readFile(filePath, "utf8"),
    })),
  );
  const headingAnchorsByPath = new Map(
    documents.map(({ filePath, source }) => [
      path.resolve(filePath),
      extractHeadingAnchors(source),
    ]),
  );
  const errors = [];

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
          await readFile(resolvedFilePath, "utf8"),
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
