#!/usr/bin/env node
import path from "node:path";
import {
  ensureCommand,
  findAvailablePort,
  findProjectRoot,
  isDependencyInstallCurrent,
  isGeneratedContentStale,
  logSection,
  parseBooleanFlag,
  parseNumberOption,
  runCommand
} from "./lib/localAutomation.mjs";

async function main() {
  const args = process.argv.slice(2);
  const forceInstall = parseBooleanFlag(args, "--force-install");
  const forceGenerate = parseBooleanFlag(args, "--force-generate");
  const verify = parseBooleanFlag(args, "--verify");
  const requestedPort = parseNumberOption(args, "--port", Number(process.env.PORT) || 3000);
  const projectRoot = findProjectRoot();
  process.chdir(projectRoot);

  ensureCommand("npm", "npm");

  if (forceInstall || !(await isDependencyInstallCurrent(projectRoot))) {
    logSection("Preparing dependencies");
    const setupArgs = [path.join("scripts", "setup-local.mjs")];
    if (forceInstall) setupArgs.push("--force-install");
    if (forceGenerate) setupArgs.push("--force-generate");
    await runCommand("node", setupArgs, { cwd: projectRoot });
  }

  if (forceGenerate || (await isGeneratedContentStale(projectRoot))) {
    logSection("Generating portfolio content");
    await runCommand("npm", ["run", "generate:content"], { cwd: projectRoot });
  }

  if (verify) {
    logSection("Running verification before dev server startup");
    await runCommand("npm", ["run", "verify"], { cwd: projectRoot });
  }

  const fallbackEndPort = requestedPort <= 3010 ? 3010 : requestedPort + 10;
  const selectedPort = await findAvailablePort(requestedPort, fallbackEndPort);
  if (selectedPort !== requestedPort) {
    console.log(`Port ${requestedPort} is in use. Using port ${selectedPort}.`);
  }

  logSection("Starting development server");
  console.log(`Local URL: http://localhost:${selectedPort}`);
  await runCommand("npm", ["run", "dev", "--", "-p", String(selectedPort)], { cwd: projectRoot });
}

main().catch((error) => {
  console.error(`Smart dev startup failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});