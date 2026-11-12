import { existsSync } from "node:fs";
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvFile } from "node:process";
import { fileURLToPath } from "node:url";
import type { ContentSourceMode, GeneratedContentMetadata } from "../src/content/types";
import type { PortfolioSheetName, RawPortfolioSheets } from "../src/lib/content/normalizePortfolioContent";
import { normalizePortfolioContent } from "../src/lib/content/normalizePortfolioContent";
import { validatePortfolioContent } from "../src/lib/content/validatePortfolioContent";
import {
  finalizeGeneratedPortfolioContent,
  parseAndValidatePortfolioCsv,
  parsePortfolioWorkbook,
  portfolioWorkbookSheetNames,
  validatePortfolioWorkbookPayload,
  validatePortfolioWorkbookUrl
} from "./lib/portfolioContentGeneration";
import {
  createPinnedWorkbookFetch,
  type WorkbookFetch,
  type WorkbookFetchResponse,
  type WorkbookHostnameResolver,
  type WorkbookHttpsRequest,
  WorkbookTransportSafetyError
} from "./lib/workbookTransport";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const templateDirectory = path.join(projectRoot, "src", "content", "templates");
const outputPath = path.join(projectRoot, "src", "content", "generated", "portfolio.generated.json");
const localEnvPath = path.join(projectRoot, ".env");

export const portfolioWorkbookDownloadTimeoutMs = 15_000;
export const portfolioWorkbookDownloadMaxAttempts = 2;
export const portfolioWorkbookDownloadRetryDelayMs = 1_000;
export const portfolioWorkbookMaxBytes = 5 * 1024 * 1024;
export const portfolioWorkbookMaxRedirects = 5;

const sheetConfigs: Array<{ name: PortfolioSheetName; fileName: string }> = [
  ...portfolioWorkbookSheetNames.map((name) => ({ name, fileName: `${name}.csv` })),
  { name: "resume", fileName: "resume.csv" }
];

type GeneratePortfolioContentOptions = {
  environment?: Record<string, string | undefined>;
  fetchImplementation?: WorkbookFetch;
  hostnameResolver?: WorkbookHostnameResolver;
  httpsRequestImplementation?: WorkbookHttpsRequest;
  generatedAt?: string;
  outputFile?: string;
  templatesDirectory?: string;
  log?: (message: string) => void;
  waitImplementation?: (delayMs: number) => Promise<void>;
};

class WorkbookDownloadError extends Error {
  constructor(message: string, readonly retryable = false) {
    super(message);
    this.name = "WorkbookDownloadError";
  }
}

function invalidWorkbookRedirectError(): WorkbookDownloadError {
  return new WorkbookDownloadError("Failed to download the public XLSX workbook");
}

function workbookDownloadTimeoutError(): WorkbookDownloadError {
  return new WorkbookDownloadError("The workbook download timed out", true);
}

function isRetryableWorkbookStatus(status: number): boolean {
  return status === 408 || status === 429 || (status >= 500 && status <= 599);
}

function wait(delayMs: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, delayMs));
}

function discardResponseBody(response: Pick<WorkbookFetchResponse, "body"> | undefined): void {
  const body = response?.body;
  if (!body || typeof body.cancel !== "function") return;

  try {
    const cancellation = body.cancel();
    if (cancellation && typeof cancellation.catch === "function") {
      void cancellation.catch(() => undefined);
    }
  } catch {
    // A rejected response must never wait on cleanup or conceal its own error.
  }
}

function discardReader(reader: ReadableStreamDefaultReader<Uint8Array>): void {
  try {
    const cancellation = reader.cancel();
    if (cancellation && typeof cancellation.catch === "function") {
      void cancellation.catch(() => undefined);
    }
  } catch {
    // Stream cancellation is best effort under the attempt's fixed deadline.
  }
}

async function rejectOnDownloadAbort<T>(
  operation: Promise<T>,
  signal: AbortSignal,
  onAbort?: () => void
): Promise<T> {
  if (signal.aborted) {
    onAbort?.();
    throw workbookDownloadTimeoutError();
  }

  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const finish = (callback: () => void) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", handleAbort);
      callback();
    };
    const handleAbort = () => finish(() => {
      reject(workbookDownloadTimeoutError());
      onAbort?.();
    });

    signal.addEventListener("abort", handleAbort, { once: true });
    operation.then(
      (value) => finish(() => resolve(value)),
      (error: unknown) => finish(() => reject(error))
    );
  });
}

async function readLimitedWorkbookBody(response: WorkbookFetchResponse, signal: AbortSignal): Promise<Uint8Array> {
  const contentLengthHeader = response.headers.get("content-length")?.trim();

  if (contentLengthHeader) {
    const contentLength = Number(contentLengthHeader);
    if (!Number.isSafeInteger(contentLength) || contentLength < 0) {
      discardResponseBody(response);
      throw new WorkbookDownloadError("The workbook download returned an invalid Content-Length header");
    }
    if (contentLength > portfolioWorkbookMaxBytes) {
      discardResponseBody(response);
      throw new WorkbookDownloadError("The workbook download exceeds the allowed size limit");
    }
  }

  if (!response.body) {
    const bytes = new Uint8Array(await rejectOnDownloadAbort(response.arrayBuffer(), signal));
    if (bytes.byteLength > portfolioWorkbookMaxBytes) {
      throw new WorkbookDownloadError("The workbook download exceeds the allowed size limit");
    }
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  let complete = false;

  try {
    while (true) {
      const { done, value } = await rejectOnDownloadAbort(reader.read(), signal, () => discardReader(reader));
      if (done) {
        complete = true;
        break;
      }
      if (!value) continue;

      totalBytes += value.byteLength;
      if (totalBytes > portfolioWorkbookMaxBytes) {
        throw new WorkbookDownloadError("The workbook download exceeds the allowed size limit");
      }
      chunks.push(value);
    }
  } finally {
    if (!complete) discardReader(reader);
    try {
      reader.releaseLock();
    } catch {
      // The reader may already be closed after an aborted or failed stream.
    }
  }

  const bytes = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

async function downloadPortfolioWorkbookAttempt(
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
      let requestUrl = workbookUrl;
      const visitedUrls = new Set<string>();
      let redirects = 0;

      while (true) {
        if (visitedUrls.has(requestUrl)) {
          throw invalidWorkbookRedirectError();
        }
        visitedUrls.add(requestUrl);

        const fetchOperation = Promise.resolve().then(() => fetchImplementation(requestUrl, {
          credentials: "omit",
          redirect: "manual",
          signal: controller.signal,
          headers: {
            Accept: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/octet-stream"
          }
        }));
        void fetchOperation.then(
          (lateResponse) => {
            if (controller.signal.aborted) discardResponseBody(lateResponse);
          },
          () => undefined
        );

        response = await rejectOnDownloadAbort(fetchOperation, controller.signal);
        if (response.status < 300 || response.status > 399) break;

        if (redirects >= portfolioWorkbookMaxRedirects) {
          discardResponseBody(response);
          throw invalidWorkbookRedirectError();
        }

        const location = response.headers.get("location");
        let nextUrl: string;
        try {
          if (!location?.trim()) throw new Error("missing Location");
          nextUrl = validatePortfolioWorkbookUrl(new URL(location, requestUrl).href);
        } catch {
          discardResponseBody(response);
          throw invalidWorkbookRedirectError();
        }
        discardResponseBody(response);
        if (visitedUrls.has(nextUrl)) {
          throw invalidWorkbookRedirectError();
        }
        redirects += 1;
        requestUrl = nextUrl;
      }
    } catch (error: unknown) {
      if (timedOut) throw workbookDownloadTimeoutError();
      if (error instanceof WorkbookDownloadError) throw error;
      if (error instanceof WorkbookTransportSafetyError) {
        throw new WorkbookDownloadError("Failed to download the public XLSX workbook");
      }
      throw new WorkbookDownloadError("Failed to download the public XLSX workbook", true);
    }

    if (!response.ok) {
      discardResponseBody(response);
      throw new WorkbookDownloadError(
        "Failed to download the public XLSX workbook",
        isRetryableWorkbookStatus(response.status)
      );
    }

    try {
      return {
        bytes: await readLimitedWorkbookBody(response, controller.signal),
        contentType: response.headers.get("content-type")
      };
    } catch (error: unknown) {
      if (timedOut) throw workbookDownloadTimeoutError();
      if (error instanceof WorkbookDownloadError) throw error;
      throw new WorkbookDownloadError("Failed while reading the public XLSX workbook download", true);
    }
  } finally {
    clearTimeout(timeout);
  }
}

async function downloadPortfolioWorkbook(
  workbookUrl: string,
  fetchImplementation: WorkbookFetch,
  waitImplementation: (delayMs: number) => Promise<void>
): Promise<{ bytes: Uint8Array; contentType: string | null }> {
  for (let attempt = 1; attempt <= portfolioWorkbookDownloadMaxAttempts; attempt += 1) {
    try {
      return await downloadPortfolioWorkbookAttempt(workbookUrl, fetchImplementation);
    } catch (error: unknown) {
      const canRetry =
        error instanceof WorkbookDownloadError &&
        error.retryable &&
        attempt < portfolioWorkbookDownloadMaxAttempts;
      if (!canRetry) throw error;
      await waitImplementation(portfolioWorkbookDownloadRetryDelayMs);
    }
  }

  throw new WorkbookDownloadError("Failed to download the public XLSX workbook");
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
  const fetchImplementation = options.fetchImplementation ?? createPinnedWorkbookFetch({
    resolver: options.hostnameResolver,
    requestImplementation: options.httpsRequestImplementation
  });
  const requestedGeneratedAt = options.generatedAt ?? new Date().toISOString();
  const outputFile = options.outputFile ?? outputPath;
  const templatesDirectory = options.templatesDirectory ?? templateDirectory;
  const log = options.log ?? console.log;
  const waitImplementation = options.waitImplementation ?? wait;
  const requireRemoteContent = environment.PORTFOLIO_REQUIRE_REMOTE_CONTENT === "true";
  const workbookReference = environment.PORTFOLIO_WORKBOOK_URL?.trim();

  if (requireRemoteContent && !workbookReference) {
    throw new Error("PORTFOLIO_REQUIRE_REMOTE_CONTENT=true but PORTFOLIO_WORKBOOK_URL is missing");
  }

  const workbookUrl = workbookReference ? validatePortfolioWorkbookUrl(workbookReference) : undefined;
  const sheets = {} as RawPortfolioSheets;
  const sources: Record<string, "template" | "remote"> = {};

  if (workbookUrl) {
    const download = await downloadPortfolioWorkbook(workbookUrl, fetchImplementation, waitImplementation);
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
    contentHash: "0".repeat(64),
    sourceMode: resolveSourceMode(sources),
    sources
  };

  const normalizedContent = normalizePortfolioContent(sheets, metadata);
  const previousContent = await readPreviousContent(outputFile);
  const finalized = finalizeGeneratedPortfolioContent(normalizedContent, previousContent ?? undefined);
  const content = validatePortfolioContent(finalized.content);
  const { contentChanged } = finalized;

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
