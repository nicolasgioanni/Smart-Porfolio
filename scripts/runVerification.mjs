#!/usr/bin/env node
import { fileURLToPath } from "node:url";
import path from "node:path";
import { ensureCommand, findProjectRoot, logSection, runCommand } from "./lib/localAutomation.mjs";

export const verificationPlans = {
  verify: ["docs:check", "audit:check", "lint", "typecheck", "test"],
  priority: ["docs:check", "audit:check", "lint", "typecheck", "test:priority", "test:e2e:priority"],
  full: ["docs:check", "audit:check", "lint", "typecheck", "test", "test:e2e:full"]
};

export function resolveVerificationPlan(name) {
  const commands = verificationPlans[name];
  if (!commands) throw new Error(`Unknown verification plan: ${name}. Use verify, priority, or full.`);
  return commands;
}

export async function runVerificationPlan(name) {
  const projectRoot = findProjectRoot();
  process.chdir(projectRoot);
  ensureCommand("npm", "npm");

  logSection("Preparing one verified content snapshot");
  await runCommand("npm", ["run", "generate:content"], { cwd: projectRoot });

  for (const command of resolveVerificationPlan(name)) {
    logSection(`Running ${command}`);
    await runCommand("npm", ["run", command], { cwd: projectRoot });
  }

  logSection("Building the verified generated snapshot");
  await runCommand("npm", ["run", "build:generated"], { cwd: projectRoot });
}

const isDirectExecution = Boolean(process.argv[1]) && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);

if (isDirectExecution) {
  runVerificationPlan(process.argv[2] ?? "verify").catch((error) => {
    console.error(`Verification failed: ${error instanceof Error ? error.message : String(error)}`);
    process.exitCode = 1;
  });
}
