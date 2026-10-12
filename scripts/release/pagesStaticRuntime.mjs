import { spawn } from "node:child_process";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const [outArgument = process.env.PLAYWRIGHT_RELEASE_OUT ?? "out", portArgument = process.env.PLAYWRIGHT_RELEASE_PORT ?? "3200"] = process.argv.slice(2);
const projectRoot = path.resolve(import.meta.dirname, "..", "..");
const sourceOut = path.resolve(projectRoot, outArgument);
const port = Number(portArgument);
if (!Number.isSafeInteger(port) || port < 1 || port > 65_535) throw new Error("A valid static Pages runtime port is required");

// A package carries its own public Wrangler configuration. Prefer it so this
// runner can check a downloaded candidate without consulting source config.
const packageConfig = path.join(path.dirname(sourceOut), "wrangler.jsonc");
const configPath = await readFile(packageConfig).then(() => packageConfig).catch(() => path.join(projectRoot, "wrangler.jsonc"));
const sourceConfig = JSON.parse(await readFile(configPath, "utf8"));
if (typeof sourceConfig.compatibility_date !== "string" || !Array.isArray(sourceConfig.compatibility_flags ?? [])) throw new Error("The reviewed Wrangler compatibility configuration is invalid");

const envelope = await mkdtemp(path.join(os.tmpdir(), "smart-portfolio-static-pages-"));
const envelopeOut = path.join(envelope, "out");
await cp(sourceOut, envelopeOut, { recursive: true, dereference: false, errorOnExist: true, force: false });
await writeFile(path.join(envelope, "wrangler.jsonc"), JSON.stringify({ name: "smart-portfolio-sealed-static-test", pages_build_output_dir: "./out", compatibility_date: sourceConfig.compatibility_date, compatibility_flags: sourceConfig.compatibility_flags ?? [] }, null, 2) + "\n", "utf8");

const wrangler = path.join(projectRoot, "node_modules", "wrangler", "bin", "wrangler.js");
const child = spawn(process.execPath, [wrangler, "pages", "dev", "out", "--ip", "127.0.0.1", "--port", String(port)], { cwd: envelope, stdio: "inherit" });
let stopping = false;
async function cleanup() { await rm(envelope, { force: true, recursive: true }); }
function stop(signal) { if (!stopping) { stopping = true; child.kill(signal); } }
process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
child.once("error", async (error) => { await cleanup(); throw error; });
child.once("exit", async (code, signal) => { await cleanup(); process.exitCode = code ?? (signal ? 1 : 0); });
