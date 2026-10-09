import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Miniflare } from "miniflare";

const moduleTypes = new Map([
  [".cjs", "cjs"],
  [".js", "esm"],
  [".json", "json"],
  [".map", "sourcemap"],
  [".mjs", "esm"],
  [".txt", "text"],
  [".wasm", "wasm"]
]);

export async function readExactWorkerModules(workerDirectory, relativeDirectory = "") {
  const modules = {};
  const entries = await readdir(path.join(workerDirectory, relativeDirectory), { withFileTypes: true });
  for (const entry of entries) {
    const relativePath = path.posix.join(relativeDirectory, entry.name);
    if (entry.isDirectory()) {
      Object.assign(modules, await readExactWorkerModules(workerDirectory, relativePath));
      continue;
    }
    if (!entry.isFile()) throw new Error(`Compiled Worker contains unsupported entry: ${relativePath}`);
    const type = moduleTypes.get(path.extname(entry.name));
    if (!type) throw new Error(`Compiled Worker contains unsupported module: ${relativePath}`);
    modules[relativePath] = {
      type,
      contents: type === "wasm"
        ? await readFile(path.join(workerDirectory, relativePath))
        : await readFile(path.join(workerDirectory, relativePath), "utf8")
    };
  }
  return modules;
}

async function readRootStaticAsset(artifactDirectory, request) {
  if (new URL(request.url).pathname !== "/") return new Response("Not Found", { status: 404 });
  return new Response(await readFile(path.join(artifactDirectory, "index.html")), {
    headers: { "content-type": "text/html; charset=utf-8" }
  });
}

export async function createExactWorkerRuntime(artifactDirectory) {
  const resolvedArtifactDirectory = path.resolve(artifactDirectory);
  const workerDirectory = path.join(resolvedArtifactDirectory, "_worker.js");
  const modules = await readExactWorkerModules(workerDirectory);
  if (!modules["index.js"]) throw new Error("Compiled Worker is missing index.js");
  return new Miniflare({
    workers: [
      {
        config: {
          name: "compiled-pages-functions",
          type: "worker",
          compatibilityDate: "2026-08-27",
          manifest: { mainModule: "index.js", modulesRoot: workerDirectory, modules },
          env: {
            ASSETS: { type: "fetcher", handler: (request) => readRootStaticAsset(resolvedArtifactDirectory, request) }
          }
        }
      }
    ]
  });
}

export async function verifyCompiledPagesWorker(artifactDirectory) {
  const resolvedArtifactDirectory = path.resolve(artifactDirectory);
  const runtime = await createExactWorkerRuntime(resolvedArtifactDirectory);
  try {
    for (const endpoint of ["/api/contact", "/api/contact/verify"]) {
      const response = await runtime.dispatchFetch(`https://local.example${endpoint}`);
      if (response.status !== 405 || JSON.stringify(await response.json()) !== JSON.stringify({ ok: false, error: "method_not_allowed" })) {
        throw new Error(`Compiled Worker did not preserve the ${endpoint} method-rejection contract`);
      }
    }
    const [fallback, missing] = await Promise.all([
      runtime.dispatchFetch("https://local.example/"),
      runtime.dispatchFetch("https://local.example/compiled-worker-probe-missing")
    ]);
    if (fallback.status !== 200 || await fallback.text() !== await readFile(path.join(resolvedArtifactDirectory, "index.html"), "utf8")) {
      throw new Error("Compiled Worker did not preserve static root fallback");
    }
    if (missing.status !== 404) throw new Error("Compiled Worker did not preserve static missing-path fallback");
  } finally {
    await runtime.dispose();
  }
}

async function runCli() {
  const [artifactDirectory] = process.argv.slice(2);
  if (!artifactDirectory || process.argv.length !== 3) {
    throw new Error("Usage: node scripts/verifyCompiledPagesWorker.mjs <artifact-directory>");
  }
  await verifyCompiledPagesWorker(artifactDirectory);
  console.log("Verified the exact compiled Pages Worker runtime.");
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
