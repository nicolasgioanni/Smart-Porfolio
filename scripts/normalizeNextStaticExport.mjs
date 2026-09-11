import { lstat, readdir, rename, rmdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
export const defaultStaticExportDirectory = path.join(projectRoot, "out");
const encodedSegmentPattern = /^[A-Za-z0-9!$@_-]+$/;
const nestedSegmentRootPattern = /^__next\.[A-Za-z0-9!$@_-]+$/;

function isInside(parentPath, candidatePath) {
  const relativePath = path.relative(parentPath, candidatePath);
  return relativePath !== "" && !relativePath.startsWith(`..${path.sep}`) && !path.isAbsolute(relativePath);
}

async function collectNestedSegmentRoots(exportDirectory, directory = exportDirectory, roots = []) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      if (entry.name.startsWith("__next.")) {
        throw new Error(`Static export segment path cannot be a symbolic link: ${entryPath}`);
      }
      continue;
    }
    if (!entry.isDirectory()) continue;
    if (nestedSegmentRootPattern.test(entry.name)) {
      roots.push(entryPath);
      continue;
    }
    if (entry.name.startsWith("__next.")) {
      throw new Error(`Static export contains a malformed segment directory: ${entryPath}`);
    }
    await collectNestedSegmentRoots(exportDirectory, entryPath, roots);
  }
  return roots;
}

async function collectSegmentFiles(directory, files = [], directories = []) {
  directories.push(directory);
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      throw new Error(`Static export segment data contains an unsupported symbolic link: ${entryPath}`);
    }
    if (entry.isDirectory()) {
      if (!encodedSegmentPattern.test(entry.name)) {
        throw new Error(`Static export segment directory contains a malformed path segment: ${entryPath}`);
      }
      await collectSegmentFiles(entryPath, files, directories);
      continue;
    }
    const extension = path.extname(entry.name);
    const stem = entry.name.slice(0, -extension.length);
    if (!entry.isFile() || extension !== ".txt" || !encodedSegmentPattern.test(stem)) {
      throw new Error(`Static export segment directory contains an unexpected entry: ${entryPath}`);
    }
    files.push(entryPath);
  }
  return { directories, files };
}

async function pathExists(candidatePath) {
  try {
    await lstat(candidatePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

export async function normalizeNextStaticExportSegments(exportDirectory = defaultStaticExportDirectory) {
  const exportRoot = path.resolve(exportDirectory);
  const exportStat = await lstat(exportRoot);
  if (!exportStat.isDirectory() || exportStat.isSymbolicLink()) {
    throw new Error(`Static export root must be a real directory: ${exportRoot}`);
  }

  const roots = await collectNestedSegmentRoots(exportRoot);
  const operations = [];
  const directories = [];
  const plannedTargets = new Set();

  for (const nestedRoot of roots) {
    const parentDirectory = path.dirname(nestedRoot);
    const collected = await collectSegmentFiles(nestedRoot);
    if (collected.files.length === 0) {
      throw new Error(`Static export segment directory contains no segment data: ${nestedRoot}`);
    }
    directories.push(...collected.directories);

    for (const sourcePath of collected.files) {
      const flattenedName = path.relative(parentDirectory, sourcePath).split(path.sep).join(".");
      const targetPath = path.resolve(parentDirectory, flattenedName);
      if (!isInside(exportRoot, targetPath)) {
        throw new Error(`Refusing to write static export segment data outside ${exportRoot}`);
      }

      const targetKey = process.platform === "win32" ? targetPath.toLowerCase() : targetPath;
      if (plannedTargets.has(targetKey) || (await pathExists(targetPath))) {
        throw new Error(`Refusing to overwrite static export segment data: ${targetPath}`);
      }
      plannedTargets.add(targetKey);
      operations.push({ sourcePath, targetPath });
    }
  }

  for (const { sourcePath, targetPath } of operations) await rename(sourcePath, targetPath);
  for (const directory of directories.sort(
    (left, right) => right.split(path.sep).length - left.split(path.sep).length
  )) {
    await rmdir(directory);
  }

  const remainingRoots = await collectNestedSegmentRoots(exportRoot);
  if (remainingRoots.length > 0) {
    throw new Error(`Static export still contains nested segment data: ${remainingRoots.join(", ")}`);
  }

  return operations.length;
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  normalizeNextStaticExportSegments(process.argv[2] ? path.resolve(process.argv[2]) : defaultStaticExportDirectory)
    .then((normalizedCount) => console.log(`Normalized ${normalizedCount} Next.js static export segment file(s).`))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : String(error));
      process.exitCode = 1;
    });
}
