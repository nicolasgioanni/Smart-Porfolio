#!/usr/bin/env node
import path from "node:path";
import { ensureCommand, findProjectRoot, runCommand, writeGeneratedContentState } from "./lib/localAutomation.mjs";

async function main() {
  const projectRoot = findProjectRoot();
  process.chdir(projectRoot);

  ensureCommand("tsx", "tsx");
  await runCommand("tsx", [path.join("scripts", "fetchPortfolioContent.ts")], { cwd: projectRoot });
  await writeGeneratedContentState(projectRoot);
}

main().catch((error) => {
  console.error(`Content generation failed: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
});
