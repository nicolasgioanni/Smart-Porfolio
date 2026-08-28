import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import type { ContentSourceMode, GeneratedContentMetadata } from "../src/content/types";
import type { PortfolioSheetName, RawPortfolioSheets } from "../src/lib/content/normalizePortfolioContent";
import { normalizePortfolioContent } from "../src/lib/content/normalizePortfolioContent";
import {
  finalizeGeneratedPortfolioContent,
  parseAndValidatePortfolioCsv,
  parsePortfolioWorkbook,
  portfolioWorkbookSheetNames,
  validatePortfolioWorkbookPayload,
  validatePortfolioWorkbookUrl
} from "./lib/portfolioContentGeneration";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDirectory = path.join(projectRoot, "src", "content", "templates");
const outputPath = path.join(projectRoot, "src", "content", "generated", "portfolio.generated.json");
const localEnvPath = path.join(projectRoot, ".env");

export const portfolioWorkbookDownloadTimeoutMs = 15_000;
export const portfolioWorkbookMaxBytes = 5 * 1024 * 1024;

const sheetConfigs: Array<{ name: PortfolioSheetName; fileName: string }> = [
  ...portfolioWorkbookSheetNames.map((name) => ({ name, fileName: `${name}.csv` })),
  { name: "resume", fileName: "resume.csv" }
];

type WorkbookFetchResponse = Pick<Response, "ok" | "status" | "statusText" | "headers" | "body" | "arrayBuffer">;
type WorkbookFetch = (url: string, init: RequestInit) => Promise<WorkbookFetchResponse>;

type GeneratePortfolioContentOptions = {
  environment?: Record<string, string | undefined>;
  fetchImplementation?: WorkbookFetch;
  generatedAt?: string;
  outputFile?: string;
  templatesDirectory?: string;
  log?: (message: string) => void;
};

class WorkbookDownloadError extends Error {}

async function readLimitedWorkbookBody(response: WorkbookFetchResponse): Promise<Uint8Array> {
  const contentLengthHeader = response.headers.get("content-length")?.trim();

  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      throw new WorkbookDownloadError("The workbook download returned an invalid Content-Length header");
    }
    if (contentLength > portfolioWorkbookMaxBytes) {
      throw new WorkbookDownloadError("The workbook download exceeds the allowed size limit");
    }
  }

  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    if (bytes.byteLength > portfolioWorkbookMaxBytes) {
      throw new WorkbookDownloadError("The workbook download exceeds the allowed size limit");
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    totalBytes += value.byteLength;
    if (totalBytes > portfolioWorkbookMaxBytes) {
      await reader.cancel().catch(() => undefined);
      throw new WorkbookDownloadError("The workbook download exceeds the allowed size limit");
    }
    chunks.push(value);
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function downloadPortfolioWorkbook(
  workbookUrl: string,
  fetchImplementation: WorkbookFetch
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, portfolioWorkbookDownloadTimeoutMs);

  try {
    let response: WorkbookFetchResponse;

    try {
      response = await fetchImplementation(workbookUrl, {
        credentials: "omit",
        redirect: "follow",
        signal: controller.signal,
        headers: {
          Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream"
        }
      });
    } catch {
      if (timedOut) throw new WorkbookDownloadError("The workbook download timed out");
      throw new WorkbookDownloadError("Failed to download the public XLSX workbook");
    }

    if (!response.ok) {
      throw new WorkbookDownloadError("Failed to download the public XLSX workbook");
    }

    try {
      return {
        bytes: await readLimitedWorkbookBody(response),
        contentType: response.headers.get("content-type")
      };
    } catch (error: unknown) {
      if (timedOut) throw new WorkbookDownloadError("The workbook download timed out");
      if (error instanceof WorkbookDownloadError) throw error;
      throw new WorkbookDownloadError("Failed while reading the public XLSX workbook download");
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function readTemplateCsv(fileName: string, templatesDirectory: string): Promise<string> {
  return readFile(path.join(templatesDirectory, fileName), "utf8");
}

function resolveSourceMode(sources: Record<string, "template" | "remote">): ContentSourceMode {
  const sourceValues = portfolioWorkbookSheetNames.map((sheetName) => sources[sheetName]);
  const remoteCount = sourceValues.filter((source) => source === "remote").length;

  if (remoteCount === 0) return "templates";
  if (remoteCount === sourceValues.length) return "remote";
  return "mixed";
}

async function readPreviousContent(filePath: string): Promise<unknown | undefined> {
  try {
    return JSON.parse(await readFile(filePath, "utf8")) as unknown;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    if (error instanceof SyntaxError) {
      throw new Error("Existing generated portfolio content is not valid JSON");
    }
    throw error;
  }
}

async function readLocalResumeRows(templatesDirectory: string): Promise<RawPortfolioSheets["resume"]> {
  const csvText = await readTemplateCsv("resume.csv", templatesDirectory);
  const rows = parseAndValidatePortfolioCsv(csvText, "resume");

  if (rows.length > 0) {
    throw new Error("The local resume template must remain header-only");
  }

  return rows;
}

export async function generatePortfolioContent(options: GeneratePortfolioContentOptions = {}): Promise<{
  contentChanged: boolean;
  contentHash: string;
  generatedAt: string;
  outputFile: string;
}> {
  const environment = options.environment ?? process.env;
  const fetchImplementation = options.fetchImplementation ?? ((url, init) => fetch(url, init));
  const requestedGeneratedAt = options.generatedAt ?? new Date().toISOString();
  const outputFile = options.outputFile ?? outputPath;
  const templatesDirectory = options.templatesDirectory ?? templateDirectory;
  const log = options.log ?? console.log;
  const requireRemoteContent = environment.PORTFOLIO_REQUIRE_REMOTE_CONTENT === "true";
  const workbookReference = environment.PORTFOLIO_WORKBOOK_URL?.trim();

  if (requireRemoteContent && !workbookReference) {
    throw new Error("PORTFOLIO_REQUIRE_REMOTE_CONTENT=true but PORTFOLIO_WORKBOOK_URL is missing");
  }

  const workbookUrl = workbookReference ? validatePortfolioWorkbookUrl(workbookReference) : undefined;
  const sheets = {} as RawPortfolioSheets;
  const sources: Record<string, "template" | "remote"> = {};

  if (workbookUrl) {
    const download = await downloadPortfolioWorkbook(workbookUrl, fetchImplementation);
    validatePortfolioWorkbookPayload(download.bytes, download.contentType);
    const workbookSheets = await parsePortfolioWorkbook(download.bytes);

    for (const sheetName of portfolioWorkbookSheetNames) {
      sheets[sheetName] = workbookSheets[sheetName];
      sources[sheetName] = "remote";
    }

    sheets.resume = await readLocalResumeRows(templatesDirectory);
    sources.resume = "template";
  } else {
    for (const config of sheetConfigs) {
      const csvText = await readTemplateCsv(config.fileName, templatesDirectory);
      const rows = parseAndValidatePortfolioCsv(csvText, config.name);

      if (config.name === "resume" && rows.length > 0) {
        throw new Error("The local resume template must remain header-only");
      }

      sheets[config.name] = rows;
      sources[config.name] = "template";
    }
  }

  const metadata: GeneratedContentMetadata = {
    generatedAt: requestedGeneratedAt,
    contentHash: "",
    sourceMode: resolveSourceMode(sources),
    sources
  };

  const normalizedContent = normalizePortfolioContent(sheets, metadata);
  const previousContent = await readPreviousContent(outputFile);
  const { content, contentChanged } = finalizeGeneratedPortfolioContent(normalizedContent, previousContent ?? undefined);

  await mkdir(path.dirname(outputFile), { recursive: true });
  await writeFile(outputFile, `${JSON.stringify(content, null, 2)}\n`, "utf8");

  const githubOutputs = [
    `content_changed=${contentChanged}`,
    `content_hash=${content.metadata.contentHash}`,
    `generated_at=${content.metadata.generatedAt}`
  ];
  for (const output of githubOutputs) log(output);

  if (environment.GITHUB_OUTPUT?.trim()) {
    await appendFile(environment.GITHUB_OUTPUT, `${githubOutputs.join("\n")}\n`, "utf8");
  }

  log(`Generated portfolio content at ${path.relative(projectRoot, outputFile)} using ${content.metadata.sourceMode} content.`);
  return {
    contentChanged,
    contentHash: content.metadata.contentHash,
    generatedAt: content.metadata.generatedAt,
    outputFile
  };
}

async function runCli(): Promise<void> {
  if (existsSync(localEnvPath)) loadEnvFile(localEnvPath);
  await generatePortfolioContent();
}

const isDirectExecution = Boolean(process.argv[1]) && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isDirectExecution) {
  runCli().catch((error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Content generation failed: ${message}`);
    process.exitCode = 1;
  });
}
