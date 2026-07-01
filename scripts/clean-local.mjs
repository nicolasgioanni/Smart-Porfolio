#!/usr/bin/env node
import path from "node:path";
import {
  confirmAction,
  findProjectRoot,
  generatedContentRelativePath,
  getSetupStatePath,
  logSection,
  parseBooleanFlag,
  removePathIfPresent
} from "./lib/localAutomation.mjs";

async function main() {
  const args = process.argv.slice(2);
  const all = parseBooleanFlag(args, "--all");
  const force = parseBooleanFlag(args, "--force");
  const removeNodeModules = all || parseBooleanFlag(args, "--node-modules");
  const removeGeneratedContent = all || parseBooleanFlag(args, "--generated-content");
  const projectRoot = findProjectRoot();
  process.chdir(projectRoot);

  logSection("Cleaning local artifacts");
  const removed = [];

  for (const relativePath of [".next", "out"]) {
    if (await removePathIfPresent(path.join(projectRoot, relativePath))) {
      removed.push(relativePath);
    }
  }

  if (removeGeneratedContent) {
    if (await removePathIfPresent(path.join(projectRoot, generatedContentRelativePath))) {
      removed.push(generatedContentRelativePath);
    }
  }

  if (removeNodeModules) {
    const confirmed = force || (await confirmAction("This will delete node_modules."));
    if (!confirmed) {
      throw new Error("node_modules deletion was not confirmed.");
    }

    if (await removePathIfPresent(path.join(projectRoot, "node_modules"))) {
      removed.push("node_modules");
    }

    if (await removePathIfPresent(getSetupStatePath(projectRoot))) {
      removed.push(".local/setup-state.json");
    }
  }

  if (removed.length === 0) {
    console.log("No matching local artifacts were present.");
  } else {
    console.log(`Removed: ${removed.join(", ")}`);
  }

  console.log("Preserved src/content/templates, public assets, and .env.local.");
}

main().catch((error) => {
  console.error(`Local cleanup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});