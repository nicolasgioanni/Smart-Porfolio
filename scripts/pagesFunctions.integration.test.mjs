import { execFileSync, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { createServer } from "node:net";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { verifyCompiledPagesWorker } from "./verifyCompiledPagesWorker.mjs";

const projectRoot = path.resolve(import.meta.dirname, "..");
const wranglerCli = path.join(projectRoot, "node_modules", "wrangler", "wrangler-dist", "cli.js");

let temporaryDirectory;
let pagesDevProcess;

function compileFunctions(staticDirectory) {
  execFileSync(
    process.execPath,
    [
      wranglerCli,
      "pages",
      "functions",
      "build",
      "functions",
      "--outdir",
      path.join(staticDirectory, "_worker.js"),
      "--output-routes-path",
      path.join(staticDirectory, "_routes.json"),
      "--build-output-directory",
      staticDirectory
    ],
    { cwd: projectRoot, encoding: "utf8", stdio: "pipe" }
  );
}

async function getAvailablePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  const address = server.address();
  const port = typeof address === "object" && address ? address.port : undefined;
  await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  if (!port) throw new Error("Could not reserve a local Pages runtime port");
  return port;
}

async function startPagesDev(staticDirectory) {
  const port = await getAvailablePort();
  const inspectorPort = await getAvailablePort();
  pagesDevProcess = spawn(
    process.execPath,
    [wranglerCli, "pages", "dev", ".", "--port", String(port), "--inspector-port", String(inspectorPort)],
    { cwd: staticDirectory, stdio: ["ignore", "pipe", "pipe"] }
  );
  let output = "";
  await new Promise((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error(`Timed out starting Pages runtime:\n${output}`)), 20_000);
    const observe = (chunk) => {
      output += String(chunk);
      if (output.includes(`Ready on http://localhost:${port}`)) {
        clearTimeout(timeout);
        resolve();
      }
    };
    pagesDevProcess.stdout.on("data", observe);
    pagesDevProcess.stderr.on("data", observe);
    pagesDevProcess.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    pagesDevProcess.once("exit", (code) => {
      clearTimeout(timeout);
      reject(new Error(`Pages runtime exited before becoming ready (${code}):\n${output}`));
    });
  });
  return `http://127.0.0.1:${port}`;
}

async function stopPagesDev() {
  if (!pagesDevProcess || pagesDevProcess.exitCode !== null) return;
  const processToStop = pagesDevProcess;
  await new Promise((resolve) => {
    const timeout = setTimeout(resolve, 5_000);
    processToStop.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
    processToStop.kill("SIGINT");
  });
  pagesDevProcess = undefined;
}

afterEach(async () => {
  await stopPagesDev();
  if (temporaryDirectory) await rm(temporaryDirectory, { recursive: true, force: true });
  temporaryDirectory = undefined;
});

describe("compiled Pages Functions artifact", () => {
  it("runs the exact emitted Worker module, routes only the two APIs, and preserves static fallback", async () => {
    temporaryDirectory = await mkdtemp(path.join(os.tmpdir(), "portfolio-pages-functions-"));
    await Promise.all([
      writeFile(path.join(temporaryDirectory, "index.html"), "<h1>compiled static fallback</h1>", "utf8"),
      writeFile(path.join(temporaryDirectory, "asset.txt"), "compiled static asset", "utf8")
    ]);
    compileFunctions(temporaryDirectory);

    await expect(verifyCompiledPagesWorker(temporaryDirectory)).resolves.toBeUndefined();
    expect(existsSync(path.join(temporaryDirectory, "functions"))).toBe(false);
    await expect(readFile(wranglerCli, "utf8")).resolves.toContain(
      "if (!_workerJS && fs12.existsSync(functionsDirectory))"
    );

    const baseUrl = await startPagesDev(temporaryDirectory);
    const [root, asset, contact, verification] = await Promise.all([
      fetch(`${baseUrl}/`),
      fetch(`${baseUrl}/asset.txt`),
      fetch(`${baseUrl}/api/contact`),
      fetch(`${baseUrl}/api/contact/verify`)
    ]);
    expect(root.status).toBe(200);
    expect(await root.text()).toContain("compiled static fallback");
    expect(await asset.text()).toBe("compiled static asset");
    await expect(contact.json()).resolves.toEqual({ ok: false, error: "method_not_allowed" });
    await expect(verification.json()).resolves.toEqual({ ok: false, error: "method_not_allowed" });
  }, 40_000);
});
