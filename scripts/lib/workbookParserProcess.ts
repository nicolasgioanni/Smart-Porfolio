import { spawn } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { PortfolioWorkbookSheets } from "./portfolioContentGeneration";

const projectRoot = import.meta.url.startsWith("file:")
  ? path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..")
  : process.env.VITEST ? process.cwd() : (() => { throw new Error("Invalid workbook parser location"); })();
const childEntry = path.join(projectRoot, "scripts/lib/workbookParserChild.ts");
const maxInput = 5 * 1024 * 1024;
const maxOutput = 64 * 1024 * 1024;
const maxErrorOutput = 64 * 1024;
const deadlineMs = 15_000;
const names = ["profile", "links", "research", "projects", "experience", "recommendations", "education", "skills", "site_settings"] as const;
const safeErrors = [
  /^The workbook download is not a valid XLSX workbook$/,
  /^The XLSX workbook archive (?:exceeds the allowed decoded size limit|contains too many entries)$/,
  /^The XLSX workbook (?:is empty|exceeds the allowed worksheet dimensions|must not contain hidden or veryHidden tabs|contains duplicate normalized tab names|must not contain a resume tab|contains an unexpected tab|must contain exactly the nine required tabs)$/,
  /^The XLSX workbook is missing required tabs: (?:profile|links|research|projects|experience|recommendations|education|skills|site_settings)(?:, (?:profile|links|research|projects|experience|recommendations|education|skills|site_settings))*$/,
  /^The (?:profile|links|research|projects|experience|recommendations|education|skills|site_settings) tab (?:exceeds the allowed worksheet dimensions|is empty or missing its header row|has an invalid header schema|does not contain its required key rows|has a malformed row structure)$/,
  /^The workbook formula at (?:profile|links|research|projects|experience|recommendations|education|skills|site_settings)![A-Z]{1,3}[1-9][0-9]{0,3} is missing a cached value$/,
  /^The workbook profile tab must leave (?:resume_url|resume_download_label) blank$/,
  /^The workbook links tab must not contain rows with kind=resume or kind=file$/,
  /^The workbook (?:profile|site_settings) tab contains (?:an unknown key|a duplicate key after alias normalization)$/
];
export function safeWorkbookParserError(message: string): string {
  const sanitized = message.replace(/^(The workbook (?:profile|site_settings) tab contains (?:an unknown key|a duplicate key after alias normalization)):.*$/, "$1");
  return safeErrors.some((pattern) => pattern.test(sanitized)) ? sanitized : "The XLSX workbook could not be parsed";
}

function validSheets(value: unknown): value is PortfolioWorkbookSheets {
  if (!value || typeof value !== "object" || Array.isArray(value) || Object.keys(value).length !== names.length) return false;
  return names.every((name) => {
    const rows = (value as Record<string, unknown>)[name];
    return Array.isArray(rows) && rows.length <= 5000 && rows.every((row: unknown) =>
      row !== null && typeof row === "object" && !Array.isArray(row) && Object.keys(row).length <= 128 && Object.values(row).every((cell) => typeof cell === "string")
    );
  });
}

export async function runWorkbookParser(bytes: Uint8Array): Promise<PortfolioWorkbookSheets> {
  if (bytes.byteLength > maxInput) throw new Error("The workbook download exceeds the allowed size limit");
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ["--max-old-space-size=512", "--import", "tsx", childEntry], {
      cwd: projectRoot, env: { NODE_ENV: "production" }, stdio: ["pipe", "pipe", "pipe"], shell: false
    });
    let finished = false, outputBytes = 0, errorBytes = 0;
    const chunks: Buffer[] = [];
    const finish = (error?: Error, result?: PortfolioWorkbookSheets) => {
      if (finished) return;
      finished = true; clearTimeout(timer);
      if (error) { child.kill("SIGKILL"); reject(error); } else resolve(result!);
    };
    const fail = () => finish(new Error("The XLSX workbook parser failed"));
    const timer = setTimeout(() => finish(new Error("The XLSX workbook parser timed out")), deadlineMs);
    child.on("error", fail);
    child.stdin.on("error", fail);
    child.stdout.on("data", (chunk: Buffer) => {
      outputBytes += chunk.length;
      if (outputBytes > maxOutput) { fail(); return; }
      chunks.push(chunk);
    });
    child.stderr.on("data", (chunk: Buffer) => { errorBytes += chunk.length; if (errorBytes > maxErrorOutput) fail(); });
    child.on("close", (code, signal) => {
      if (finished) return;
      if (code !== 0 || signal) { fail(); return; }
      try {
        const result: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
        if (!result || typeof result !== "object" || Array.isArray(result)) { fail(); return; }
        const envelope = result as Record<string, unknown>;
        if (typeof envelope.error === "string" && Object.keys(envelope).length === 1) { finish(new Error(safeWorkbookParserError(envelope.error))); return; }
        if (Object.keys(envelope).length !== 1 || !validSheets(envelope.sheets)) { fail(); return; }
        finish(undefined, envelope.sheets);
      } catch { fail(); }
    });
    child.stdin.end(bytes);
  });
}
