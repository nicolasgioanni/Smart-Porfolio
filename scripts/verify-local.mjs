#!/usr/bin/env node
import path from "node:path";
import { ensureCommand, findProjectRoot, isDependencyInstallCurrent, logSection, runCommand } from "./lib/localAutomation.mjs";

async function main() {
  const projectRoot = findProjectRoot();
  process.chdir(projectRoot);

  ensureCommand("npm", "npm");

  if (!(await isDependencyInstallCurrent(projectRoot))) {
    logSection("Preparing dependencies before verification");
    await runCommand("node", [path.join("scripts", "setup-local.mjs")], { cwd: projectRoot });
  }

  logSection("Regenerating portfolio content");
  await runCommand("npm", ["run", "generate:content"], { cwd: projectRoot });

  logSection("Running local quality gate");
  await runCommand("npm", ["run", "verify"], { cwd: projectRoot });

  logSection("Local verification complete");
}

main().catch((error) => {
  console.error(`Local verification failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});