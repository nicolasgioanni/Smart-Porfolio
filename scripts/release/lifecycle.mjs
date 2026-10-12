import { execFile, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import ts from "typescript";
import { createArtifactManifest, verifyArtifactManifest } from "../artifactIntegrity.mjs";
import { runCommand as runLocalAutomationCommand } from "../lib/localAutomation.mjs";
import { readContentVersion } from "../writeContentVersion.mjs";
import { createStaticCsp } from "./csp.mjs";
import { effectivePublicBuildEnvironment, collectPublicBuildInputs, publicBuildInputDigest } from "./publicBuildInputs.mjs";
import { packageSealedRelease, verifySealedRelease } from "./sealedRelease.mjs";
import { readRegularFile } from "../lib/readRegularFile.mjs";

const execFileAsync = promisify(execFile);
const generatedRelativePath = "src/content/generated/portfolio.generated.json";
const expectedFunctionRoutes = ["/api/contact", "/api/contact/verify"];
const digestPattern = /^[a-f0-9]{64}$/;
const commitPattern = /^[a-f0-9]{40}$/;

function sha256(value) { return createHash("sha256").update(value).digest("hex"); }

async function readJson(filePath) {
  try { return JSON.parse(await readFile(filePath, "utf8")); }
  catch (error) { if (error instanceof SyntaxError) throw new Error(`${filePath} is not valid JSON`); throw error; }
}

async function commandOutput(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd: options.cwd, env: options.env ?? process.env, shell: false, stdio: ["ignore", "pipe", "pipe"] });
    const stdout = [];
    const stderr = [];
    child.stdout.on("data", (chunk) => stdout.push(chunk));
    child.stderr.on("data", (chunk) => stderr.push(chunk));
    child.once("error", reject);
    child.once("exit", (code) => code === 0
      ? resolve({ stdout: Buffer.concat(stdout).toString("utf8"), stderr: Buffer.concat(stderr).toString("utf8") })
      : reject(new Error(`${command} ${args.join(" ")} failed with exit code ${code ?? "unknown"}: ${Buffer.concat(stderr).toString("utf8")}`)));
  });
}

async function gitOutput(root, args) { return execFileAsync("git", args, { cwd: root, maxBuffer: 20 * 1024 * 1024 }); }

async function digestFile(filePath) { return sha256(await readFile(filePath)); }

async function digestDirectory(directory) {
  const files = [];
  async function visit(root, current = root) {
    for (const entry of await readdir(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name);
      if (entry.isSymbolicLink()) throw new Error(`Release input contains a symbolic link: ${absolute}`);
      if (entry.isDirectory()) await visit(root, absolute);
      else if (entry.isFile()) files.push(absolute);
      else throw new Error(`Release input has an unsupported entry: ${absolute}`);
    }
  }
  await visit(directory);
  const digest = createHash("sha256");
  for (const file of files.sort()) {
    digest.update(path.relative(directory, file).split(path.sep).join("/")).update("\0").update(await readFile(file)).update("\0");
  }
  return digest.digest("hex");
}

export function validateReleaseConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) throw new Error("Wrangler configuration must be an object");
  if (config.name !== "smart-portfolio") throw new Error("Wrangler Pages project must be smart-portfolio");
  if (config.pages_build_output_dir !== "./out") throw new Error("Wrangler Pages build output must be ./out");
  if (typeof config.compatibility_date !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(config.compatibility_date)) throw new Error("Wrangler compatibility date is required");
  const compatibilityFlags = config.compatibility_flags ?? [];
  if (!Array.isArray(compatibilityFlags) || compatibilityFlags.some((flag) => typeof flag !== "string" || !flag.trim()) || new Set(compatibilityFlags).size !== compatibilityFlags.length) throw new Error("Wrangler compatibility flags are invalid");
  return { compatibilityDate: config.compatibility_date, compatibilityFlags };
}

export function validateGeneratedSource(content, target) {
  const metadata = content?.metadata;
  const sources = metadata?.sources;
  if (!metadata || !sources || typeof sources !== "object" || Array.isArray(sources)) throw new Error("Generated content is missing source metadata");
  const strictRemoteSheets = ["profile", "links", "research", "projects", "experience", "recommendations", "education", "skills", "site_settings"];
  if (target === "local") {
    if (metadata.sourceMode !== "templates" || Object.values(sources).some((source) => source !== "template")) throw new Error("Local candidates must use checked-in templates only");
    return "templates";
  }
  if (!new Set(["preview", "production"]).has(target) || metadata.sourceMode !== "remote" || sources.resume !== "template" || strictRemoteSheets.some((sheet) => sources[sheet] !== "remote")) {
    throw new Error("Preview and production candidates must use the accepted strict remote workbook snapshot");
  }
  return "remote";
}

export function parseGeneration(value, target) {
  if (value === "local") {
    if (target !== "local") throw new Error("Only local candidates may use the local producer generation");
    return { kind: "local", runId: "local", runNumber: null, attempt: null };
  }
  const match = /^(\d+):(\d+):(\d+)$/.exec(value ?? "");
  if (!match) throw new Error("CI release generations must be runId:runNumber:attempt");
  const [, runId, runNumberText, attemptText] = match;
  const runNumber = Number(runNumberText);
  const attempt = Number(attemptText);
  if (!Number.isSafeInteger(runNumber) || runNumber < 1 || !Number.isSafeInteger(attempt) || attempt < 1) throw new Error("Release producer generation is invalid");
  return { kind: "github-actions", runId, runNumber, attempt };
}

export async function assertAcceptedSnapshot({ projectRoot = process.cwd(), snapshotPath, snapshotDigest, target }) {
  if (!digestPattern.test(snapshotDigest ?? "")) throw new Error("Accepted generated snapshot digest is invalid");
  const root = path.resolve(projectRoot);
  const accepted = path.resolve(root, snapshotPath ?? generatedRelativePath);
  const generatedPath = path.join(root, generatedRelativePath);
  const bytes = await readFile(accepted);
  if (sha256(bytes) !== snapshotDigest) throw new Error("Accepted generated snapshot bytes do not match the declared digest");
  if (path.resolve(generatedPath) !== accepted && !Buffer.from(bytes).equals(await readFile(generatedPath))) throw new Error("The build input differs from the accepted generated snapshot");
  const content = JSON.parse(bytes.toString("utf8"));
  const sourceMode = validateGeneratedSource(content, target);
  if (!digestPattern.test(content.metadata?.contentHash ?? "")) throw new Error("Accepted generated snapshot is missing a semantic content hash");
  return { path: accepted, content, sourceMode, snapshotDigest };
}

/** Runs exactly build:generated against a previously accepted, byte-checked snapshot. */
export async function buildAcceptedSnapshot({
  projectRoot = process.cwd(), snapshotPath, snapshotDigest, snapshotRecordDigest, sourceCommit, target, publicBuildInputDigest: expectedPublicDigest, producer, runCommand = runLocalAutomationCommand, environment = process.env
}) {
  if (!commitPattern.test(sourceCommit ?? "")) throw new Error("Release source commit must be a full lowercase SHA");
  if (!digestPattern.test(expectedPublicDigest ?? "")) throw new Error("Release public build-input digest is invalid");
  if (!digestPattern.test(snapshotRecordDigest ?? "")) throw new Error("Release snapshot record digest is invalid");
  const root = path.resolve(projectRoot);
  if ((await gitOutput(root, ["rev-parse", "HEAD"])).stdout.trim() !== sourceCommit) throw new Error("Release source commit does not match the checked-out Git commit");
  await assertAcceptedSnapshot({ projectRoot: root, snapshotPath, snapshotDigest, target });
  const generation = typeof producer === "string" ? parseGeneration(producer, target) : producer;
  const publicInputs = await collectPublicBuildInputs({ projectRoot: root, target, sourceCommit, environment });
  if (publicBuildInputDigest(publicInputs) !== expectedPublicDigest) throw new Error("Release public build-input digest does not match effective build inputs");
  const buildEnvironment = {
    ...environment,
    ...effectivePublicBuildEnvironment(target, environment),
    DEPLOYMENT_COMMIT_SHA: sourceCommit,
    RELEASE_TARGET: target,
    RELEASE_PUBLIC_BUILD_INPUT_DIGEST: expectedPublicDigest,
    RELEASE_RUN_ID: generation.kind === "github-actions" ? generation.runId : undefined,
    RELEASE_RUN_NUMBER: generation.kind === "github-actions" ? String(generation.runNumber) : "",
    RELEASE_PRODUCER_ATTEMPT: generation.kind === "github-actions" ? String(generation.attempt) : ""
  };
  await runCommand("npm", ["run", "build:generated"], { cwd: root, env: buildEnvironment });
  const after = await assertAcceptedSnapshot({ projectRoot: root, snapshotPath, snapshotDigest, target });
  const version = await readContentVersion(path.join(root, "out", "content-version.json"));
  if (version.schemaVersion !== 2 || version.commitSha !== sourceCommit || version.contentHash !== after.content.metadata.contentHash || version.target !== target || version.publicBuildInputDigest !== expectedPublicDigest || JSON.stringify(version.producer) !== JSON.stringify(generation)) {
    throw new Error("Generated content version does not match the accepted build identity");
  }
  return { ...after, version, producer: generation };
}

function collectWorkerImports(worker) {
  const sourceFile = ts.createSourceFile("sealed-worker.js", worker, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
  const specifiers = new Set();
  const add = (expression, kind) => {
    if (!expression || !ts.isStringLiteralLike(expression)) throw new Error(`Compiled worker has a nonliteral ${kind} import`);
    specifiers.add(expression.text);
  };
  const visit = (node) => {
    if (ts.isImportDeclaration(node)) add(node.moduleSpecifier, "static");
    else if (ts.isExportDeclaration(node) && node.moduleSpecifier) add(node.moduleSpecifier, "re-export");
    else if (ts.isCallExpression(node)) {
      if (node.expression.kind === ts.SyntaxKind.ImportKeyword) add(node.arguments[0], "dynamic");
      else if (ts.isIdentifier(node.expression) && node.expression.text === "require") add(node.arguments[0], "require");
    }
    ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  return [...specifiers];
}

export function validatePlainWorker(worker) {
  if (!worker.trim()) throw new Error("Pages Functions build emitted an empty worker");
  for (const specifier of collectWorkerImports(worker)) if (!specifier.startsWith("node:")) throw new Error(`Compiled worker has an unsealed external import: ${specifier}`);
}

export function validateRoutes(routes) {
  if (!routes || typeof routes !== "object" || Array.isArray(routes) || routes.version !== 1 || !Array.isArray(routes.include) || !Array.isArray(routes.exclude)) throw new Error("Wrangler emitted malformed _routes.json");
  const include = [...routes.include].sort();
  if (include.length !== expectedFunctionRoutes.length || include.some((route, index) => route !== expectedFunctionRoutes[index]) || routes.exclude.length !== 0) throw new Error("Wrangler emitted routes differ from the reviewed contact API allowlist");
}

export function validateRoutingConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config) || config.baseURL !== "/" || !Array.isArray(config.routes)) throw new Error("Wrangler emitted malformed Functions routing config");
  const routes = [...config.routes].sort((a, b) => String(a?.routePath).localeCompare(String(b?.routePath)));
  if (routes.length !== expectedFunctionRoutes.length || routes.some((route, index) => !route || route.routePath !== expectedFunctionRoutes[index] || route.method !== "" || !Array.isArray(route.module) || route.module.length === 0 || route.module.some((module) => typeof module !== "string" || !module))) throw new Error("Wrangler discovered Functions outside the reviewed contact API allowlist");
}

export async function compilePagesFunctions({ projectRoot = process.cwd(), outDirectory, compatibilityDate, compatibilityFlags = [], commandRunner = runLocalAutomationCommand }) {
  const root = path.resolve(projectRoot);
  const temporary = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-pages-functions-"));
  const configPath = path.join(temporary, "config.json");
  const routesPath = path.join(temporary, "routes.json");
  const wrangler = path.join(root, "node_modules", "wrangler", "bin", "wrangler.js");
  try {
    await commandRunner(process.execPath, [wrangler, "pages", "functions", "build", "functions", "--outdir", temporary, "--output-config-path", configPath, "--output-routes-path", routesPath, "--build-output-directory", outDirectory, "--compatibility-date", compatibilityDate, ...compatibilityFlags.flatMap((flag) => ["--compatibility-flag", flag])], { cwd: root });
    const emitted = (await readdir(temporary, { withFileTypes: true })).map((entry) => entry.name).sort();
    if (emitted.join(",") !== "config.json,index.js,routes.json") throw new Error("Pages Functions build must emit one plain worker, routing config, and routes file");
    const [worker, configBytes, routesBytes] = await Promise.all([
      readRegularFile(path.join(temporary, "index.js"), { minimumBytes: 1, maximumBytes: 32 * 1024 * 1024 }),
      readRegularFile(configPath, { minimumBytes: 1, maximumBytes: 1024 * 1024 }),
      readRegularFile(routesPath, { minimumBytes: 1, maximumBytes: 1024 * 1024 })
    ]);
    const decode = (bytes) => new TextDecoder("utf-8", { fatal: true }).decode(bytes);
    validatePlainWorker(decode(worker));
    validateRoutingConfig(JSON.parse(decode(configBytes)));
    const routes = JSON.parse(decode(routesBytes));
    validateRoutes(routes);
    validateRoutes(await readJson(path.join(root, "public", "_routes.json")));
    validateRoutes(await readJson(path.join(outDirectory, "_routes.json")));
    await writeFile(path.join(outDirectory, "_worker.js"), worker);
    await writeFile(path.join(outDirectory, "_routes.json"), routesBytes);
  } finally { await rm(temporary, { force: true, recursive: true }); }
}

export async function verifyCompiledWorker({ outDirectory, compatibilityDate, compatibilityFlags = [] }) {
  const worker = await readFile(path.join(outDirectory, "_worker.js"), "utf8");
  const { Miniflare, convertV4MiniflareOptions } = await import("miniflare");
  const providerFixture = [
    "let emailAttempts = 0;",
    "export default { async fetch(request) {",
    "  const url = new URL(request.url);",
    "  if (url.pathname === '/stats') return Response.json({ emailAttempts });",
    "  if (url.hostname === 'api.resend.com') { emailAttempts += 1; return new Response('delivery prohibited', { status: 599 }); }",
    "  if (url.hostname === 'challenges.cloudflare.com') return Response.json({ success: true, hostname: 'sealed.example', action: 'portfolio_contact', cdata: '4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9' });",
    "  return new Response('unexpected provider request', { status: 599 });",
    "} };"
  ].join("\n");
  const runtime = new Miniflare(convertV4MiniflareOptions({
    workers: [
      { name: "sealed-release-worker", modules: true, compatibilityDate, compatibilityFlags, script: worker, outboundService: "provider-fixture", bindings: { TURNSTILE_SECRET_KEY: "isolated-turnstile-secret", TURNSTILE_ALLOWED_HOSTNAMES: "sealed.example", CONTACT_ALLOWED_ORIGINS: "https://sealed.example" }, d1Databases: ["CONTACT_RATE_LIMIT_DB"], assets: { directory: outDirectory, binding: "ASSETS", run_worker_first: true, routerConfig: { has_user_worker: true } } },
      { name: "provider-fixture", modules: true, compatibilityDate, compatibilityFlags, script: providerFixture }
    ]
  }));
  try {
    await runtime.ready;
    for (const endpoint of expectedFunctionRoutes) {
      const response = await runtime.dispatchFetch(`https://sealed.example${endpoint}`);
      if (response.status !== 405 || response.headers.get("Allow") !== "POST" || !response.headers.get("Content-Type")?.startsWith("application/json") || JSON.stringify(await response.json()) !== JSON.stringify({ ok: false, error: "method_not_allowed" })) throw new Error(`Compiled worker rejected the ${endpoint} method contract`);
    }
    const verification = await runtime.dispatchFetch("https://sealed.example/api/contact/verify", { method: "POST", headers: { "Content-Type": "application/json", Origin: "https://sealed.example" }, body: JSON.stringify({ submissionId: "4e57585c-9638-4c1e-8f2f-7bd4c5a7c6e9", turnstileToken: "isolated-token" }) });
    if (verification.status !== 200 || JSON.stringify(await verification.json()) !== JSON.stringify({ ok: true })) throw new Error("Compiled worker did not use the isolated Turnstile fixture");
    const asset = await runtime.dispatchFetch("https://sealed.example/");
    if (!asset.ok || !/text\/html/i.test(asset.headers.get("Content-Type") ?? "")) throw new Error("Compiled worker did not fall back to sealed static assets");
    const provider = await runtime.getWorker("provider-fixture");
    if ((await (await provider.fetch("https://provider-fixture/stats")).json()).emailAttempts !== 0) throw new Error("Compiled worker attempted an email delivery during package verification");
  } finally { await runtime.dispose(); }
}

export async function compileReleaseOutput({ projectRoot = process.cwd(), outDirectory = "out", sourceCommit }) {
  if (!commitPattern.test(sourceCommit ?? "")) throw new Error("Release source commit must be a full lowercase SHA");
  const root = path.resolve(projectRoot);
  const out = path.resolve(root, outDirectory);
  const { compatibilityDate, compatibilityFlags } = validateReleaseConfig(await readJson(path.join(root, "wrangler.jsonc")));
  await createStaticCsp(out);
  await compilePagesFunctions({ projectRoot: root, outDirectory: out, compatibilityDate, compatibilityFlags });
  await createArtifactManifest(out);
  await verifyArtifactManifest(out, sourceCommit);
  return { outDirectory: out, compatibilityDate, compatibilityFlags };
}

export async function createSealedPackage({ projectRoot = process.cwd(), outDirectory = "out", releaseDirectory, sourceCommit, target, snapshotDigest, snapshotRecordDigest, publicBuildInputDigest: expectedPublicDigest, producer, commandOutputRunner = commandOutput, environment = process.env }) {
  if (!commitPattern.test(sourceCommit ?? "") || !digestPattern.test(snapshotDigest ?? "") || !digestPattern.test(snapshotRecordDigest ?? "") || !digestPattern.test(expectedPublicDigest ?? "")) throw new Error("Sealed package candidate identity is invalid");
  const root = path.resolve(projectRoot);
  const out = path.resolve(root, outDirectory);
  const generated = await assertAcceptedSnapshot({ projectRoot: root, snapshotDigest, target });
  const version = await readContentVersion(path.join(out, "content-version.json"));
  const expectedProducer = typeof producer === "string" ? parseGeneration(producer, target) : producer;
  if (version.schemaVersion !== 2 || version.commitSha !== sourceCommit || version.contentHash !== generated.content.metadata.contentHash || version.target !== target || version.publicBuildInputDigest !== expectedPublicDigest || JSON.stringify(version.producer) !== JSON.stringify(expectedProducer)) throw new Error("Cannot package a content version outside the accepted identity");
  await verifyArtifactManifest(out, sourceCommit);
  const [config, inputs] = await Promise.all([readJson(path.join(root, "wrangler.jsonc")), collectPublicBuildInputs({ projectRoot: root, target, sourceCommit, environment })]);
  const { compatibilityDate, compatibilityFlags } = validateReleaseConfig(config);
  if (publicBuildInputDigest(inputs) !== expectedPublicDigest) throw new Error("Cannot package with stale public build inputs");
  const packageJson = await readJson(path.join(root, "package.json"));
  const candidate = {
    sourceCommit,
    contentHash: version.contentHash,
    contentSnapshotHash: snapshotDigest,
    snapshotRecordDigest,
    publicBuildInputDigest: expectedPublicDigest,
    producer: expectedProducer,
    migrationsHash: await digestDirectory(path.join(root, "migrations")),
    wranglerConfigHash: await digestFile(path.join(root, "wrangler.jsonc")),
    sourceMode: generated.sourceMode,
    target,
    toolchain: { node: process.version, next: inputs.nextVersion, wrangler: inputs.wranglerVersion, compatibilityDate, compatibilityFlags, lockfileHash: inputs.lockfileDigest }
  };
  if (packageJson.devDependencies?.wrangler !== candidate.toolchain.wrangler) throw new Error("Pinned Wrangler declaration changed before packaging");
  const temporary = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-sbom-"));
  try {
    const sbomPath = path.join(temporary, "sbom.cdx.json");
    const sbom = (await commandOutputRunner("npm", ["sbom", "--sbom-format", "cyclonedx", "--package-lock-only"], { cwd: root })).stdout;
    await writeFile(sbomPath, sbom, "utf8");
    const manifest = await packageSealedRelease({ outDirectory: out, configPath: path.join(root, "wrangler.jsonc"), migrationsDirectory: path.join(root, "migrations"), releaseDirectory, candidate, sbomPath });
    await verifySealedRelease(releaseDirectory, { sourceCommit, contentHash: candidate.contentHash, target, publicBuildInputDigest: expectedPublicDigest });
    return manifest;
  } finally { await rm(temporary, { force: true, recursive: true }); }
}

export async function verifyPackagedRuntime({ projectRoot = process.cwd(), releaseDirectory, runCommand = runLocalAutomationCommand, environment = process.env }) {
  const root = path.resolve(projectRoot);
  const release = path.resolve(releaseDirectory);
  const manifest = await verifySealedRelease(release);
  const { compatibilityDate, compatibilityFlags } = validateReleaseConfig(await readJson(path.join(release, "wrangler.jsonc")));
  await verifyCompiledWorker({ outDirectory: path.join(release, "out"), compatibilityDate, compatibilityFlags });
  await runCommand("npm", ["run", "test:e2e:release-static"], { cwd: root, env: { ...environment, PLAYWRIGHT_RELEASE_OUT: path.join(release, "out") } });
  await verifySealedRelease(release, { sourceCommit: manifest.candidate.sourceCommit, contentHash: manifest.candidate.contentHash, target: manifest.candidate.target, publicBuildInputDigest: manifest.candidate.publicBuildInputDigest });
  return manifest;
}
