#!/usr/bin/env node
import path from "node:path";
import { existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import {
  commandVersion,
  copyEnvExampleIfMissing,
  createPackageState,
  ensureCommand,
  findProjectRoot,
  getNodeMajorVersion,
  hasDependencyInstall,
  isDependencyInstallCurrent,
  isGeneratedContentStale,
  logSection,
  parseBooleanFlag,
  runCommand,
  writeSetupState
} from "./lib/localAutomation.mjs";

function getNodeMinorVersion(nodeVersion = process.versions.node) {
  const minorText = nodeVersion.replace(/^v/, "").split(".")[1];
  const minorVersion = Number(minorText);
  return Number.isFinite(minorVersion) ? minorVersion : 0;
}

function canAdoptExistingInstall(projectRoot) {
  if (!hasDependencyInstall(projectRoot)) return false;

  const result = spawnSync("npm", ["ls", "--depth=0", "--silent"], {
    cwd: projectRoot,
    shell: process.platform === "win32",
    stdio: "ignore"
  });

  return result.status === 0;
}

async function main() {
  const args = process.argv.slice(2);
  const forceInstall = parseBooleanFlag(args, "--force-install");
  const forceGenerate = parseBooleanFlag(args, "--force-generate");
  const projectRoot = findProjectRoot();
  process.chdir(projectRoot);

  logSection("Checking local prerequisites");
  const nodeVersion = process.versions.node;
  const npmVersion = ensureCommand("npm", "npm");
  console.log(`Project root: ${projectRoot}`);
  console.log(`Node.js: ${nodeVersion}`);
  console.log(`npm: ${npmVersion}`);

  const nodeMajorVersion = getNodeMajorVersion(nodeVersion);
  if (nodeMajorVersion < 20 || (nodeMajorVersion === 20 && getNodeMinorVersion(nodeVersion) < 19)) {
    console.warn("Warning: Node 20.19 or newer avoids engine warnings from some development dependencies.");
  }

  const envCreated = await copyEnvExampleIfMissing(projectRoot);
  if (envCreated) {
    console.log("Created .env from .env.example.");
  } else {
    console.log("No .env changes needed.");
  }

  const dependenciesCurrent = await isDependencyInstallCurrent(projectRoot);
  const packageLockExists = existsSync(path.join(projectRoot, "package-lock.json"));

  if (forceInstall) {
    logSection("Installing dependencies");
    console.log(packageLockExists ? "Force install requested. Running npm ci." : "Force install requested. Running npm install.");
    await runCommand("npm", packageLockExists ? ["ci"] : ["install"], { cwd: projectRoot });
  } else if (dependenciesCurrent) {
    console.log("Dependencies are current. Skipping npm install.");
  } else if (canAdoptExistingInstall(projectRoot)) {
    console.log("Existing node_modules install is valid. Recording local setup state without reinstalling.");
  } else {
    logSection("Installing dependencies");
    if (packageLockExists) {
      console.log("Dependencies are missing or stale. Running npm ci.");
      await runCommand("npm", ["ci"], { cwd: projectRoot });
    } else {
      console.log("package-lock.json is missing. Running npm install.");
      await runCommand("npm", ["install"], { cwd: projectRoot });
    }
  }

  await writeSetupState(projectRoot, await createPackageState(projectRoot, nodeVersion, commandVersion("npm") ?? npmVersion));

  if (forceGenerate || (await isGeneratedContentStale(projectRoot))) {
    logSection("Generating portfolio content");
    await runCommand("npm", ["run", "generate:content"], { cwd: projectRoot });
  } else {
    console.log("Generated portfolio content is current. Skipping generation.");
  }

  logSection("Local setup complete");
}

main().catch((error) => {
  console.error(`Local setup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
