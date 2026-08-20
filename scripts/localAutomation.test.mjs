import { mkdtemp, mkdir, readFile, rm, utimes, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import net from "node:net";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  copyEnvExampleIfMissing,
  createPackageState,
  findAvailablePort,
  findProjectRoot,
  generatedContentRelativePath,
  isDependencyInstallCurrent,
  isGeneratedContentStale,
  setupStateRelativePath,
  writeSetupState
} from "./lib/localAutomation.mjs";

const temporaryDirectories = [];

async function createTemporaryProject() {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-local-automation-"));
  temporaryDirectories.push(directory);
  await writeFile(path.join(directory, "package.json"), JSON.stringify({ name: "demo", scripts: {} }), "utf8");
  await writeFile(path.join(directory, "package-lock.json"), JSON.stringify({ lockfileVersion: 3 }), "utf8");
  return directory;
}

afterEach(async () => {
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("local automation helpers", () => {
  it("finds a project root by package.json", async () => {
    const projectRoot = await createTemporaryProject();
    const childDirectory = path.join(projectRoot, "nested", "child");
    await mkdir(childDirectory, { recursive: true });

    expect(findProjectRoot(childDirectory)).toBe(projectRoot);
  });

  it("creates .env from .env.example without overwriting local configuration", async () => {
    const projectRoot = await createTemporaryProject();
    const envPath = path.join(projectRoot, ".env");
    await writeFile(path.join(projectRoot, ".env.example"), "EXAMPLE_VALUE=\n", "utf8");

    expect(await copyEnvExampleIfMissing(projectRoot)).toBe(true);
    expect(await readFile(envPath, "utf8")).toBe("EXAMPLE_VALUE=\n");

    await writeFile(envPath, "EXAMPLE_VALUE=local\n", "utf8");
    expect(await copyEnvExampleIfMissing(projectRoot)).toBe(false);
    expect(await readFile(envPath, "utf8")).toBe("EXAMPLE_VALUE=local\n");
  });

  it("marks dependencies current only when node_modules and setup hashes match", async () => {
    const projectRoot = await createTemporaryProject();
    await mkdir(path.join(projectRoot, "node_modules", "next"), { recursive: true });
    const state = await createPackageState(projectRoot, "20.0.0", "10.0.0");
    await writeSetupState(projectRoot, state);

    expect(await isDependencyInstallCurrent(projectRoot)).toBe(true);

    await writeFile(path.join(projectRoot, "package.json"), JSON.stringify({ name: "demo", version: "changed" }), "utf8");
    expect(await isDependencyInstallCurrent(projectRoot)).toBe(false);
    expect(existsSync(path.join(projectRoot, setupStateRelativePath))).toBe(true);
  });

  it("detects stale generated content when templates are newer", async () => {
    const projectRoot = await createTemporaryProject();
    const generatedPath = path.join(projectRoot, generatedContentRelativePath);
    const templateDirectory = path.join(projectRoot, "src", "content", "templates");
    await mkdir(path.dirname(generatedPath), { recursive: true });
    await mkdir(templateDirectory, { recursive: true });
    await writeFile(generatedPath, "{}", "utf8");
    const templatePath = path.join(templateDirectory, "profile.csv");
    await writeFile(templatePath, "key,value\nfull_name,Demo\n", "utf8");

    const oldDate = new Date("2024-01-01T00:00:00Z");
    const newDate = new Date("2025-01-01T00:00:00Z");
    await utimes(generatedPath, oldDate, oldDate);
    await utimes(templatePath, newDate, newDate);

    expect(await isGeneratedContentStale(projectRoot)).toBe(true);
  });

  it("finds the next available port", async () => {
    const occupiedServer = net.createServer();
    await new Promise((resolve) => occupiedServer.listen(0, "127.0.0.1", resolve));
    const address = occupiedServer.address();
    const occupiedPort = typeof address === "object" && address ? address.port : 0;

    try {
      expect(await findAvailablePort(occupiedPort, occupiedPort + 1)).toBe(occupiedPort + 1);
    } finally {
      await new Promise((resolve) => occupiedServer.close(resolve));
    }
  });
});
