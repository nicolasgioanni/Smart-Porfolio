import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const defaultProjectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const manifestPath = ".agents/ownership-manifest.json";

async function inspectRepositoryPath(projectRoot, targetPath) {
  const resolvedProjectRoot = path.resolve(projectRoot);
  const resolvedTarget = path.resolve(targetPath);
  const relativeTarget = path.relative(resolvedProjectRoot, resolvedTarget);
  if (
    relativeTarget === ".." ||
    relativeTarget.startsWith(".." + path.sep) ||
    path.isAbsolute(relativeTarget)
  ) {
    return { exists: false, exactCase: false };
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
    if (entries.some((entry) => entry.toLowerCase() === segment.toLowerCase())) {
      return { exists: true, exactCase: false };
    }
    return { exists: false, exactCase: false };
  }

  return { exists: false, exactCase: false };
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

export function normalizeIntent(intent) {
  return intent.trim().toLowerCase().replace(/\s+/g, "-");
}

export function listIntents(manifest) {
  validateManifestShape(manifest);
  return manifest.owners
    .map(({ id, aliases }) => ({ id, aliases: [...aliases].sort() }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

export function resolveIntent(manifest, intent) {
  validateManifestShape(manifest);
  const normalizedIntent = normalizeIntent(intent);
  return manifest.owners.find(
    (owner) =>
      owner.id === normalizedIntent || owner.aliases.includes(normalizedIntent),
  );
}

function validateManifestShape(manifest) {
  if (
    !manifest ||
    typeof manifest !== "object" ||
    !Array.isArray(manifest.owners) ||
    manifest.owners.some(
      (owner) =>
        !owner ||
        typeof owner.id !== "string" ||
        !Array.isArray(owner.aliases) ||
        typeof owner.card !== "string",
    )
  ) {
    throw new Error("Ownership manifest must contain valid owners");
  }
}

function isSafeCardPath(cardPath) {
  return /^\.agents\/cards\/[a-z0-9]+(?:-[a-z0-9]+)*\.md$/.test(cardPath);
}

export async function readOwnershipManifest(projectRoot = defaultProjectRoot) {
  let manifest;
  try {
    const source = await readRepositoryFile(
      projectRoot,
      path.join(projectRoot, manifestPath),
    );
    manifest = JSON.parse(source);
  } catch {
    throw new Error("Ownership manifest must contain valid JSON");
  }
  validateManifestShape(manifest);
  return manifest;
}

export async function readRouteCard(owner, projectRoot = defaultProjectRoot) {
  if (!owner || !isSafeCardPath(owner.card)) {
    throw new Error("Owner card must be a direct .agents/cards Markdown file");
  }

  try {
    const source = await readRepositoryFile(
      projectRoot,
      path.join(projectRoot, owner.card),
    );
    return source;
  } catch {
    throw new Error("Owner card must stay inside .agents/cards");
  }
}

async function runCli() {
  const [argument] = process.argv.slice(2);
  const manifest = await readOwnershipManifest();

  if (!argument || argument === "--list") {
    console.log(
      listIntents(manifest)
        .map(({ id, aliases }) => `${id}: ${aliases.join(", ")}`)
        .join("\n"),
    );
    return;
  }

  const owner = resolveIntent(manifest, argument);
  if (!owner) {
    const supported = listIntents(manifest)
      .flatMap(({ id, aliases }) => [id, ...aliases])
      .sort()
      .join(", ");
    throw new Error(`Unknown intent "${argument}". Use one of: ${supported}`);
  }

  process.stdout.write(await readRouteCard(owner));
}

const isDirectExecution =
  Boolean(process.argv[1]) &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  process.stdout.on("error", (error) => {
    if (error.code === "EPIPE") process.exit(0);
    throw error;
  });
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
