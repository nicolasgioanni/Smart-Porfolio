import { mkdtemp, readFile, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import ExcelJS, { type Workbook, type Worksheet } from "exceljs";
import { parse } from "csv-parse/sync";
import JSZip from "jszip";
import { afterEach, describe, expect, it, vi } from "vitest";
import generatedPortfolioContent from "../src/content/generated/portfolio.generated.json";
import type { GeneratedPortfolioContent } from "../src/content/types";
import {
  generatePortfolioContent,
  portfolioWorkbookDownloadMaxAttempts,
  portfolioWorkbookDownloadRetryDelayMs,
  portfolioWorkbookDownloadTimeoutMs,
  portfolioWorkbookMaxBytes
} from "./fetchPortfolioContent";
import {
  createPortfolioContentHash,
  finalizeGeneratedPortfolioContent,
  parsePortfolioWorkbook,
  portfolioWorkbookSheetNames,
  validatePortfolioWorkbookUrl,
  type PortfolioWorkbookSheetName
} from "./lib/portfolioContentGeneration";

const templatesDirectory = path.resolve(import.meta.dirname, "..", "src", "content", "templates");
const workbookUrl = "https://downloads.example.test/portfolio.xlsx?token=private-test-id";
const xlsxContentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
const temporaryDirectories: string[] = [];

type WorkbookBuildOptions = {
  sheetOrder?: PortfolioWorkbookSheetName[];
  titleFor?: (name: PortfolioWorkbookSheetName) => string;
  extraTitles?: string[];
  mutate?: (workbook: Workbook) => void | Promise<void>;
};

function contentFixture(): GeneratedPortfolioContent {
  return structuredClone(generatedPortfolioContent) as unknown as GeneratedPortfolioContent;
}

async function createTemporaryPaths(): Promise<{ directory: string; outputFile: string; githubOutput: string }> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "portfolio-workbook-generation-"));
  temporaryDirectories.push(directory);
  return {
    directory,
    outputFile: path.join(directory, "portfolio.generated.json"),
    githubOutput: path.join(directory, "github-output.txt")
  };
}

async function fileDoesNotExist(filePath: string): Promise<boolean> {
  try {
    await stat(filePath);
    return false;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return true;
    throw error;
  }
}

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

function responseFromBytes(
  bytes: Uint8Array,
  options: { contentType?: string; headers?: Record<string, string>; status?: number } = {}
): Response {
  const headers = new Headers(options.headers);
  if (options.contentType) headers.set("content-type", options.contentType);
  return new Response(bytesToArrayBuffer(bytes), { status: options.status ?? 200, headers });
}

function responseFromChunks(chunks: Uint8Array[]): Response {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(chunk);
      controller.close();
    }
  });
  return new Response(stream, { status: 200, headers: { "content-type": xlsxContentType } });
}

function textBytes(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function normalizedWorksheetName(worksheet: Worksheet): string {
  return worksheet.name.trim().toLowerCase();
}

function getWorksheet(workbook: Workbook, name: PortfolioWorkbookSheetName): Worksheet {
  const worksheet = workbook.worksheets.find((candidate) => normalizedWorksheetName(candidate) === name);
  if (!worksheet) throw new Error(`Test workbook is missing ${name}`);
  return worksheet;
}

function findColumn(worksheet: Worksheet, header: string): number {
  for (let index = 1; index <= worksheet.columnCount; index += 1) {
    if (worksheet.getCell(1, index).text.trim() === header) return index;
  }
  throw new Error(`Test worksheet ${worksheet.name} is missing column ${header}`);
}

function setLegacyResearchHeaders(worksheet: Worksheet): void {
  const graphicalAbstractColumn = findColumn(worksheet, "graphical_abstract");
  worksheet.spliceColumns(graphicalAbstractColumn + 1, 2);
  worksheet.getCell(1, graphicalAbstractColumn).value = "image";
}

function findKeyValueCell(worksheet: Worksheet, key: string) {
  for (let rowIndex = 2; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    if (worksheet.getCell(rowIndex, 1).text.trim() === key) return worksheet.getCell(rowIndex, 2);
  }
  throw new Error(`Test worksheet ${worksheet.name} is missing key ${key}`);
}

async function writeWorkbookBytes(workbook: Workbook): Promise<Uint8Array> {
  const buffer = await workbook.xlsx.writeBuffer();
  return Uint8Array.from(buffer as unknown as ArrayLike<number>);
}

async function createWorkbookBytes(options: WorkbookBuildOptions = {}): Promise<Uint8Array> {
  const workbook = new ExcelJS.Workbook();
  const sheetOrder = options.sheetOrder ?? [...portfolioWorkbookSheetNames];

  for (const sheetName of sheetOrder) {
    const worksheet = workbook.addWorksheet(options.titleFor?.(sheetName) ?? sheetName);
    const csvText = await readFile(path.join(templatesDirectory, `${sheetName}.csv`), "utf8");
    const records = parse(csvText, { bom: true, skip_empty_lines: true, trim: true }) as string[][];
    worksheet.addRows(records);
  }

  for (const title of options.extraTitles ?? []) workbook.addWorksheet(title);
  await options.mutate?.(workbook);
  return writeWorkbookBytes(workbook);
}

async function createEmptyWorkbookBytes(): Promise<Uint8Array> {
  return writeWorkbookBytes(new ExcelJS.Workbook());
}

async function generateFromWorkbook(
  bytes: Uint8Array,
  options: {
    outputFile: string;
    githubOutput?: string;
    generatedAt?: string;
    log?: (message: string) => void;
  }
) {
  return generatePortfolioContent({
    environment: {
      PORTFOLIO_WORKBOOK_URL: workbookUrl,
      PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true",
      ...(options.githubOutput ? { GITHUB_OUTPUT: options.githubOutput } : {})
    },
    fetchImplementation: async () => responseFromBytes(bytes, { contentType: xlsxContentType }),
    generatedAt: options.generatedAt,
    outputFile: options.outputFile,
    templatesDirectory,
    log: options.log ?? (() => undefined)
  });
}

afterEach(async () => {
  vi.useRealTimers();
  await Promise.all(temporaryDirectories.splice(0).map((directory) => rm(directory, { recursive: true, force: true })));
});

describe("workbook dependency boundary", () => {
  it("pins ExcelJS directly and includes no Google API, OAuth, Drive, or Sheets clients", async () => {
    const packageJson = JSON.parse(
      await readFile(path.resolve(import.meta.dirname, "..", "package.json"), "utf8")
    ) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
      overrides?: {
        exceljs?: {
          uuid?: string;
        };
      };
    };
    const dependencies = packageJson.dependencies ?? {};
    const devDependencies = packageJson.devDependencies ?? {};
    const directPackageNames = [...Object.keys(dependencies), ...Object.keys(devDependencies)];

    expect(devDependencies.exceljs).toBe("4.4.0");
    expect(devDependencies.jszip).toBe("3.10.1");
    expect(dependencies.exceljs).toBeUndefined();
    expect(packageJson.overrides).toEqual({ exceljs: { uuid: "11.1.1" } });
    expect(
      directPackageNames.filter((name) =>
        /google.*(?:api|auth|oauth|drive|sheet)|(?:api|auth|oauth|drive|sheet).*google/i.test(name)
      )
    ).toEqual([]);
  });
});

describe("visible portfolio content hashing", () => {
  it("is stable across metadata and confirmed non-rendered fields", () => {
    const content = contentFixture();
    const expectedHash = createPortfolioContentHash(content);
    const changed = structuredClone(content);

    changed.metadata.generatedAt = "2099-01-01T00:00:00.000Z";
    changed.metadata.contentHash = "f".repeat(64);
    changed.metadata.sourceMode = "remote";
    changed.profile.previousExperienceId = "different-valid-bookkeeping-id";
    changed.profile.primaryCtaLabel = "Unused primary label";
    changed.profile.secondaryCtaLabel = "Unused secondary label";
    changed.siteSettings.maxHomeExperienceItems += 100;
    for (const education of changed.education) {
      education.homeSummary = "Unused home summary";
      education.detailSummary = "Unused detail summary";
      education.detailOrder = 999;
    }

    expect(expectedHash).toMatch(/^[a-f0-9]{64}$/);
    expect(createPortfolioContentHash(changed)).toBe(expectedHash);
  });

  it("detects visible changes, preserves unchanged generatedAt, and treats legacy snapshots as changed", () => {
    const initial = contentFixture();
    initial.metadata.generatedAt = "2026-01-01T00:00:00.000Z";
    const first = finalizeGeneratedPortfolioContent(initial, undefined);
    const later = contentFixture();
    later.metadata.generatedAt = "2026-02-01T00:00:00.000Z";
    const unchanged = finalizeGeneratedPortfolioContent(later, first.content);
    later.profile.shortBio = `${later.profile.shortBio} Visible update.`;
    const changed = finalizeGeneratedPortfolioContent(later, first.content);
    const legacy = finalizeGeneratedPortfolioContent(contentFixture(), {
      metadata: { generatedAt: "2020-01-01T00:00:00.000Z" }
    });

    expect(first.contentChanged).toBe(true);
    expect(unchanged.contentChanged).toBe(false);
    expect(unchanged.content.metadata.generatedAt).toBe("2026-01-01T00:00:00.000Z");
    expect(changed.contentChanged).toBe(true);
    expect(changed.content.metadata.generatedAt).toBe("2026-02-01T00:00:00.000Z");
    expect(legacy.contentChanged).toBe(true);
  });

  it("includes every research media field in the semantic content hash", () => {
    const content = contentFixture();
    const expectedHash = createPortfolioContentHash(content);
    const changes: Array<Partial<GeneratedPortfolioContent["research"][number]>> = [
      { graphicalAbstract: "/images/research/revised-cytocv-graphical-abstract.webp" },
      { graphicalAbstractAlt: "CytoCV graphical abstract." },
      { video: "/images/research/cytocv-workflow.webm" }
    ];

    for (const change of changes) {
      const changed = contentFixture();
      Object.assign(changed.research[0]!, change);
      expect(createPortfolioContentHash(changed)).not.toBe(expectedHash);
    }
  });
});

describe("strict XLSX download boundary", () => {
  it("validates an anonymous HTTPS workbook URL", () => {
    expect(validatePortfolioWorkbookUrl(`  ${workbookUrl}  `)).toBe(workbookUrl);
    for (const value of ["not-a-url", "http://example.test/book.xlsx", "https://user:secret@example.test/book.xlsx"]) {
      expect(() => validatePortfolioWorkbookUrl(value)).toThrow(/anonymous HTTPS URL/);
    }
  });

  it("uses one anonymous first-attempt download with a fixed timeout and no credentials", async () => {
    const bytes = await createWorkbookBytes({
      sheetOrder: [...portfolioWorkbookSheetNames].reverse(),
      titleFor: (name) => `  ${[...name].map((character, index) => index % 2 ? character : character.toUpperCase()).join("")}  `
    });
    const { outputFile } = await createTemporaryPaths();
    const calls: Array<{ url: string; init: RequestInit }> = [];
    const logs: string[] = [];

    await generatePortfolioContent({
      environment: { PORTFOLIO_WORKBOOK_URL: workbookUrl, PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
      fetchImplementation: async (url, init) => {
        calls.push({ url, init });
        return responseFromBytes(bytes, { contentType: xlsxContentType });
      },
      outputFile,
      templatesDirectory,
      log: (message) => logs.push(message)
    });

    const generated = JSON.parse(await readFile(outputFile, "utf8")) as GeneratedPortfolioContent;
    expect(calls).toHaveLength(1);
    expect(calls[0]!.url).toBe(workbookUrl);
    expect(calls[0]!.init.credentials).toBe("omit");
    expect(calls[0]!.init.redirect).toBe("follow");
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
    const requestHeaders = new Headers(calls[0]!.init.headers);
    expect(requestHeaders.has("authorization")).toBe(false);
    expect(requestHeaders.has("cookie")).toBe(false);
    expect(generated.metadata.sourceMode).toBe("remote");
    expect(generated.profile.experienceSummary).toBe(
      "My experience spans AI engineering at the U.S. Treasury, research software and machine learning at the University of Washington, and teaching core computer science courses."
    );
    expect(generated.metadata.sources.resume).toBe("template");
    expect(logs.join("\n")).not.toContain(workbookUrl);
    expect(logs.join("\n")).not.toContain("private-test-id");
  });

  it("uses templates only when strict mode is false and no workbook URL is configured", async () => {
    const { outputFile, githubOutput } = await createTemporaryPaths();
    let fetchCount = 0;
    const logs: string[] = [];
    const first = await generatePortfolioContent({
      environment: { PORTFOLIO_REQUIRE_REMOTE_CONTENT: "false", GITHUB_OUTPUT: githubOutput },
      fetchImplementation: async () => {
        fetchCount += 1;
        throw new Error("fetch must not run");
      },
      generatedAt: "2026-03-01T00:00:00.000Z",
      outputFile,
      templatesDirectory,
      log: (message) => logs.push(message)
    });
    const second = await generatePortfolioContent({
      environment: { PORTFOLIO_REQUIRE_REMOTE_CONTENT: "false", GITHUB_OUTPUT: githubOutput },
      generatedAt: "2026-04-01T00:00:00.000Z",
      outputFile,
      templatesDirectory,
      log: (message) => logs.push(message)
    });

    expect(fetchCount).toBe(0);
    expect(first.contentChanged).toBe(true);
    expect(second.contentChanged).toBe(false);
    expect(second.generatedAt).toBe("2026-03-01T00:00:00.000Z");
    expect(await readFile(githubOutput, "utf8")).toBe(
      `content_changed=true\ncontent_hash=${first.contentHash}\ngenerated_at=2026-03-01T00:00:00.000Z\n` +
        `content_changed=false\ncontent_hash=${first.contentHash}\ngenerated_at=2026-03-01T00:00:00.000Z\n`
    );
    expect(logs.filter((message) => /^(?:content_changed|content_hash|generated_at)=/.test(message))).toEqual([
      "content_changed=true",
      `content_hash=${first.contentHash}`,
      "generated_at=2026-03-01T00:00:00.000Z",
      "content_changed=false",
      `content_hash=${first.contentHash}`,
      "generated_at=2026-03-01T00:00:00.000Z"
    ]);
  });

  it("fails closed when strict mode lacks a URL or any configured URL is invalid", async () => {
    for (const environment of [
      { PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
      { PORTFOLIO_REQUIRE_REMOTE_CONTENT: "false", PORTFOLIO_WORKBOOK_URL: "http://example.test/book.xlsx" }
    ]) {
      const { outputFile } = await createTemporaryPaths();
      await expect(
        generatePortfolioContent({ environment, outputFile, templatesDirectory, log: () => undefined })
      ).rejects.toThrow(/PORTFOLIO_WORKBOOK_URL|anonymous HTTPS URL/);
      expect(await fileDoesNotExist(outputFile)).toBe(true);
    }
  });

  it("fails closed on HTTP errors and never exposes the workbook URL", async () => {
    const { outputFile } = await createTemporaryPaths();
    let errorMessage = "";
    let fetchCount = 0;

    try {
      await generatePortfolioContent({
        environment: { PORTFOLIO_WORKBOOK_URL: workbookUrl, PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
        fetchImplementation: async () => {
          fetchCount += 1;
          return responseFromBytes(new Uint8Array(), { status: 403 });
        },
        outputFile,
        templatesDirectory,
        log: () => undefined
      });
    } catch (error: unknown) {
      errorMessage = error instanceof Error ? error.message : String(error);
    }

    expect(errorMessage).toBe("Failed to download the public XLSX workbook");
    expect(errorMessage).not.toContain(workbookUrl);
    expect(errorMessage).not.toContain("private-test-id");
    expect(fetchCount).toBe(1);
    expect(await fileDoesNotExist(outputFile)).toBe(true);
  });

  it("exhausts two bounded attempts for a stalled download and never starts a third", async () => {
    vi.useFakeTimers();
    const { outputFile } = await createTemporaryPaths();
    const receivedSignals: AbortSignal[] = [];
    const generation = generatePortfolioContent({
      environment: { PORTFOLIO_WORKBOOK_URL: workbookUrl, PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
      fetchImplementation: async (_url, init) => {
        const signal = init.signal as AbortSignal;
        receivedSignals.push(signal);
        return new Promise((_resolve, reject) => {
          signal.addEventListener("abort", () => reject(new Error("aborted")), { once: true });
        });
      },
      outputFile,
      templatesDirectory,
      log: () => undefined
    });
    const rejection = expect(generation).rejects.toThrow(/download timed out/);

    await vi.advanceTimersByTimeAsync(
      (portfolioWorkbookDownloadTimeoutMs * portfolioWorkbookDownloadMaxAttempts) +
        portfolioWorkbookDownloadRetryDelayMs
    );
    await rejection;
    expect(receivedSignals).toHaveLength(portfolioWorkbookDownloadMaxAttempts);
    expect(receivedSignals.every((signal) => signal.aborted)).toBe(true);
    expect(await fileDoesNotExist(outputFile)).toBe(true);
  });

  it("waits once, uses a fresh signal, and recovers from a transient network failure", async () => {
    const bytes = await createWorkbookBytes();
    const { outputFile } = await createTemporaryPaths();
    const receivedSignals: AbortSignal[] = [];
    const retryDelays: number[] = [];
    let releaseRetry: (() => void) | undefined;
    let fetchCount = 0;
    const generation = generatePortfolioContent({
      environment: { PORTFOLIO_WORKBOOK_URL: workbookUrl, PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
      fetchImplementation: async (_url, init) => {
        fetchCount += 1;
        receivedSignals.push(init.signal as AbortSignal);
        if (fetchCount === 1) throw new Error("transient network failure");
        return responseFromBytes(bytes, { contentType: xlsxContentType });
      },
      outputFile,
      templatesDirectory,
      log: () => undefined,
      waitImplementation: (delayMs) => {
        retryDelays.push(delayMs);
        return new Promise((resolve) => {
          releaseRetry = resolve;
        });
      }
    });

    await vi.waitFor(() => expect(releaseRetry).toBeTypeOf("function"));
    expect(fetchCount).toBe(1);
    releaseRetry!();
    await generation;

    expect(fetchCount).toBe(2);
    expect(retryDelays).toEqual([portfolioWorkbookDownloadRetryDelayMs]);
    expect(receivedSignals).toHaveLength(2);
    expect(receivedSignals[0]).not.toBe(receivedSignals[1]);
    expect(receivedSignals.every((signal) => !signal.aborted)).toBe(true);
    expect(await fileDoesNotExist(outputFile)).toBe(false);
  });

  it("retries a temporary service error with the same bounded policy", async () => {
    const bytes = await createWorkbookBytes();
    const { outputFile } = await createTemporaryPaths();
    const retryDelays: number[] = [];
    let fetchCount = 0;
    const generation = generatePortfolioContent({
      environment: { PORTFOLIO_WORKBOOK_URL: workbookUrl, PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
      fetchImplementation: async () => {
        fetchCount += 1;
        return fetchCount === 1
          ? responseFromBytes(new Uint8Array(), { status: 503 })
          : responseFromBytes(bytes, { contentType: xlsxContentType });
      },
      outputFile,
      templatesDirectory,
      log: () => undefined,
      waitImplementation: async (delayMs) => {
        retryDelays.push(delayMs);
      }
    });

    await generation;
    expect(fetchCount).toBe(2);
    expect(retryDelays).toEqual([portfolioWorkbookDownloadRetryDelayMs]);
  });

  it("cancels each stalled response body at its deadline and never writes partial bytes", async () => {
    vi.useFakeTimers();
    const { outputFile } = await createTemporaryPaths();
    let cancelCount = 0;
    let fetchCount = 0;
    const generation = generatePortfolioContent({
      environment: { PORTFOLIO_WORKBOOK_URL: workbookUrl, PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
      fetchImplementation: async () => {
        fetchCount += 1;
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(new Uint8Array([0x50, 0x4b, 0x03, 0x04]));
          },
          cancel() {
            cancelCount += 1;
          }
        });
        return new Response(stream, { status: 200, headers: { "content-type": xlsxContentType } });
      },
      outputFile,
      templatesDirectory,
      log: () => undefined
    });
    const rejection = expect(generation).rejects.toThrow(/download timed out/);

    await vi.advanceTimersByTimeAsync(
      (portfolioWorkbookDownloadTimeoutMs * portfolioWorkbookDownloadMaxAttempts) +
        portfolioWorkbookDownloadRetryDelayMs
    );
    await rejection;
    expect(fetchCount).toBe(portfolioWorkbookDownloadMaxAttempts);
    expect(cancelCount).toBe(portfolioWorkbookDownloadMaxAttempts);
    expect(await fileDoesNotExist(outputFile)).toBe(true);
  });

  it("enforces the size cap from Content-Length and from streamed bytes", async () => {
    const scenarios = [
      () => responseFromBytes(new Uint8Array([0x50, 0x4b, 0x03, 0x04]), {
        headers: { "content-length": String(portfolioWorkbookMaxBytes + 1) }
      }),
      () => responseFromChunks([new Uint8Array(portfolioWorkbookMaxBytes), new Uint8Array([1])])
    ];

    for (const responseFactory of scenarios) {
      const { outputFile } = await createTemporaryPaths();
      await expect(
        generatePortfolioContent({
          environment: { PORTFOLIO_WORKBOOK_URL: workbookUrl, PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
          fetchImplementation: async () => responseFactory(),
          outputFile,
          templatesDirectory,
          log: () => undefined
        })
      ).rejects.toThrow(/exceeds the allowed size limit/);
      expect(await fileDoesNotExist(outputFile)).toBe(true);
    }
  });

  it("rejects HTML/login/permission bodies, non-ZIP data, invalid XLSX, and an empty workbook", async () => {
    const scenarios: Array<{ bytes: Uint8Array; contentType?: string; error: RegExp }> = [
      {
        bytes: textBytes("<!doctype html><html><form>Sign in for permission</form></html>"),
        contentType: "text/html",
        error: /HTML, login, or permission/
      },
      { bytes: textBytes("plain non-zip response"), error: /not a ZIP-based XLSX/ },
      { bytes: new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 1, 2, 3]), error: /not a valid XLSX/ },
      { bytes: await createEmptyWorkbookBytes(), contentType: xlsxContentType, error: /workbook is empty/ }
    ];

    for (const scenario of scenarios) {
      const { outputFile } = await createTemporaryPaths();
      await expect(
        generatePortfolioContent({
          environment: { PORTFOLIO_WORKBOOK_URL: workbookUrl, PORTFOLIO_REQUIRE_REMOTE_CONTENT: "true" },
          fetchImplementation: async () => responseFromBytes(scenario.bytes, { contentType: scenario.contentType }),
          outputFile,
          templatesDirectory,
          log: () => undefined
        })
      ).rejects.toThrow(scenario.error);
      expect(await fileDoesNotExist(outputFile)).toBe(true);
    }
  });
});

describe("XLSX workbook structure and cells", () => {
  it("writes and reads a data-bar workbook through ExcelJS's UUID-backed extension path", async () => {
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("UUID data bars");
    worksheet.addRows([["score"], [12], [64], [100]]);
    worksheet.addConditionalFormatting({
      ref: "A2:A4",
      rules: [
        {
          type: "dataBar",
          priority: 1,
          cfvo: [{ type: "min" }, { type: "max" }],
          color: "FF638EC6",
          gradient: false
        } as unknown as ExcelJS.ConditionalFormattingRule
      ]
    });

    const bytes = await writeWorkbookBytes(workbook);
    const conditionalFormattings = (worksheet as unknown as {
      conditionalFormattings: Array<{ rules: Array<{ x14Id?: string }> }>;
    }).conditionalFormattings;
    const originalX14Id = conditionalFormattings[0]?.rules[0]?.x14Id;
    const archive = await JSZip.loadAsync(bytes);
    const worksheetFile = archive.file("xl/worksheets/sheet1.xml");
    const worksheetXml = await worksheetFile?.async("string");
    const reopened = new ExcelJS.Workbook();
    await reopened.xlsx.load(bytesToArrayBuffer(bytes));
    const reopenedWorksheet = reopened.getWorksheet("UUID data bars");
    const reopenedConditionalFormattings = (reopenedWorksheet as unknown as {
      conditionalFormattings: Array<{
        rules: Array<{ type?: string; gradient?: boolean; x14Id?: string }>;
      }>;
    } | undefined)?.conditionalFormattings;

    expect([...bytes.subarray(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(originalX14Id).toMatch(
      /^\{[0-9A-F]{8}-[0-9A-F]{4}-4[0-9A-F]{3}-[89AB][0-9A-F]{3}-[0-9A-F]{12}\}$/
    );
    expect(worksheetXml).toContain(`id="${originalX14Id}"`);
    expect(reopenedWorksheet?.getCell("A4").value).toBe(100);
    expect(reopenedConditionalFormattings).toHaveLength(1);
    expect(reopenedConditionalFormattings?.[0]?.rules[0]).toMatchObject({
      type: "dataBar",
      gradient: false,
      x14Id: originalX14Id
    });
  });

  it("matches trimmed titles case-insensitively and independently of tab order", async () => {
    const bytes = await createWorkbookBytes({
      sheetOrder: [...portfolioWorkbookSheetNames].reverse(),
      titleFor: (name) => ` ${name.toUpperCase()} `
    });
    const sheets = await parsePortfolioWorkbook(bytes);

    expect(Object.keys(sheets)).toEqual(portfolioWorkbookSheetNames);
    expect(sheets.profile.some((row) => row.key === "full_name")).toBe(true);
  });

  it("rejects hidden/veryHidden tabs and every missing, resume, unexpected, or duplicate normalized title", async () => {
    const scenarios: Array<{ bytes: Uint8Array; error: RegExp }> = [
      {
        bytes: await createWorkbookBytes({ mutate: (workbook) => { getWorksheet(workbook, "profile").state = "hidden"; } }),
        error: /hidden or veryHidden/
      },
      {
        bytes: await createWorkbookBytes({ mutate: (workbook) => { getWorksheet(workbook, "profile").state = "veryHidden"; } }),
        error: /hidden or veryHidden/
      },
      { bytes: await createWorkbookBytes({ sheetOrder: portfolioWorkbookSheetNames.filter((name) => name !== "profile") }), error: /missing required tabs: profile/ },
      { bytes: await createWorkbookBytes({ extraTitles: ["Resume"] }), error: /must not contain a resume tab/ },
      { bytes: await createWorkbookBytes({ extraTitles: ["unexpected"] }), error: /contains an unexpected tab/ },
      { bytes: await createWorkbookBytes({ extraTitles: [" profile "] }), error: /duplicate normalized tab names/ },
      {
        bytes: await createWorkbookBytes({ mutate: (workbook) => { getWorksheet(workbook, "profile").getCell(5001, 1).value = "too large"; } }),
        error: /exceeds the allowed worksheet dimensions/
      }
    ];

    for (const scenario of scenarios) {
      const { outputFile } = await createTemporaryPaths();
      await expect(generateFromWorkbook(scenario.bytes, { outputFile })).rejects.toThrow(scenario.error);
      expect(await fileDoesNotExist(outputFile)).toBe(true);
    }
  });

  it("uses cached displayed formula text and rejects formulas without a cache", async () => {
    const displayedBio = "Rich  text stays together";
    const cachedBytes = await createWorkbookBytes({
      mutate: (workbook) => {
        const profile = getWorksheet(workbook, "profile");
        findKeyValueCell(profile, "headline").value = {
          formula: '"Software Engineer"',
          result: "Software Engineer"
        };
        findKeyValueCell(profile, "short_bio").value = {
          richText: [{ text: "Rich  " }, { text: "text stays together" }]
        };
        findKeyValueCell(getWorksheet(workbook, "site_settings"), "enable_scroll_motion").value = {
          formula: '"false"',
          result: "false"
        };
        const links = getWorksheet(workbook, "links");
        const githubUrlCell = links.getCell(2, findColumn(links, "url"));
        githubUrlCell.value = { text: githubUrlCell.text, hyperlink: githubUrlCell.text };
      }
    });
    const missingCacheBytes = await createWorkbookBytes({
      mutate: (workbook) => {
        findKeyValueCell(getWorksheet(workbook, "profile"), "headline").value = {
          formula: '"Software Engineer"'
        };
      }
    });
    const success = await createTemporaryPaths();
    const failure = await createTemporaryPaths();

    await generateFromWorkbook(cachedBytes, { outputFile: success.outputFile });
    const generated = JSON.parse(await readFile(success.outputFile, "utf8")) as GeneratedPortfolioContent;
    expect(generated.profile.headline).toBe("Software Engineer");
    expect(generated.profile.shortBio).toBe(displayedBio);
    expect(generated.links[0]?.url).toBe("https://github.com/nicolasgioanni");
    expect(generated.siteSettings.enableScrollMotion).toBe(false);
    await expect(generateFromWorkbook(missingCacheBytes, { outputFile: failure.outputFile })).rejects.toThrow(
      /formula .* is missing a cached value/
    );
    expect(await fileDoesNotExist(failure.outputFile)).toBe(true);
  });

  it("normalizes line endings and trailing blank rows/columns while preserving internal whitespace", async () => {
    const textWithSpaces = "Line one  keeps   spaces";
    const firstBytes = await createWorkbookBytes({
      mutate: (workbook) => {
        findKeyValueCell(getWorksheet(workbook, "profile"), "short_bio").value = `${textWithSpaces}\r\nLine two`;
        getWorksheet(workbook, "profile").getCell("Z100").value = "";
      }
    });
    const secondBytes = await createWorkbookBytes({
      mutate: (workbook) => {
        findKeyValueCell(getWorksheet(workbook, "profile"), "short_bio").value = `${textWithSpaces}\nLine two`;
      }
    });
    const { outputFile } = await createTemporaryPaths();
    const first = await generateFromWorkbook(firstBytes, {
      outputFile,
      generatedAt: "2026-05-01T00:00:00.000Z"
    });
    const second = await generateFromWorkbook(secondBytes, {
      outputFile,
      generatedAt: "2026-06-01T00:00:00.000Z"
    });
    const generated = JSON.parse(await readFile(outputFile, "utf8")) as GeneratedPortfolioContent;

    expect(generated.profile.shortBio).toBe(`${textWithSpaces}\nLine two`);
    expect(first.contentChanged).toBe(true);
    expect(second.contentChanged).toBe(false);
    expect(second.generatedAt).toBe("2026-05-01T00:00:00.000Z");
  });

  it("canonicalizes a displayed legal date before hashing and preserves generatedAt", async () => {
    const isoBytes = await createWorkbookBytes();
    const displayedBytes = await createWorkbookBytes({
      mutate: (workbook) => {
        findKeyValueCell(getWorksheet(workbook, "site_settings"), "legal_effective_date").value = "8/30/2026";
      }
    });
    const { outputFile } = await createTemporaryPaths();
    const first = await generateFromWorkbook(isoBytes, {
      outputFile,
      generatedAt: "2026-07-01T00:00:00.000Z"
    });
    const second = await generateFromWorkbook(displayedBytes, {
      outputFile,
      generatedAt: "2026-08-01T00:00:00.000Z"
    });
    const generated = JSON.parse(await readFile(outputFile, "utf8")) as GeneratedPortfolioContent;

    expect(second.contentHash).toBe(first.contentHash);
    expect(second.contentChanged).toBe(false);
    expect(second.generatedAt).toBe("2026-07-01T00:00:00.000Z");
    expect(generated.siteSettings.legalEffectiveDate).toBe("2026-08-30");
  });

  it("fails closed on header/schema violations, private resume aliases, and unknown key rows", async () => {
    const missingResearchMediaHeaderScenarios = await Promise.all(
      (["graphical_abstract", "graphical_abstract_alt", "video"] as const).map(async (header) => ({
        bytes: await createWorkbookBytes({
          mutate: (workbook) => {
            const worksheet = getWorksheet(workbook, "research");
            worksheet.getCell(1, findColumn(worksheet, header)).value = `missing_${header}`;
          }
        }),
        error: /invalid header schema/
      }))
    );
    const scenarios: Array<{ bytes: Uint8Array; error: RegExp }> = [
      {
        bytes: await createWorkbookBytes({ mutate: (workbook) => { getWorksheet(workbook, "profile").getCell("C1").value = "extra"; } }),
        error: /invalid header schema/
      },
      {
        bytes: await createWorkbookBytes({
          mutate: (workbook) => {
            const worksheet = getWorksheet(workbook, "research");
            worksheet.getCell(1, findColumn(worksheet, "graphical_abstract")).value = "image";
          }
        }),
        error: /invalid header schema/
      },
      ...missingResearchMediaHeaderScenarios,
      {
        bytes: await createWorkbookBytes({
          mutate: (workbook) => {
            const worksheet = getWorksheet(workbook, "links");
            worksheet.getCell(2, worksheet.columnCount + 1).value = "unexpected extra cell";
          }
        }),
        error: /malformed row structure/
      },
      {
        bytes: await createWorkbookBytes({
          mutate: (workbook) => {
            const worksheet = getWorksheet(workbook, "skills");
            const featuredColumn = findColumn(worksheet, "featured");
            worksheet.getCell(2, featuredColumn).value = "invalid-boolean";
          }
        }),
        error: /Invalid boolean/
      },
      {
        bytes: await createWorkbookBytes({ mutate: (workbook) => { findKeyValueCell(getWorksheet(workbook, "profile"), "resume_url").value = "https://example.test/resume.pdf"; } }),
        error: /leave resume_url blank/
      },
      {
        bytes: await createWorkbookBytes({
          mutate: (workbook) => {
            const worksheet = getWorksheet(workbook, "links");
            worksheet.getCell(2, findColumn(worksheet, "kind")).value = "file";
          }
        }),
        error: /kind=resume or kind=file/
      },
      {
        bytes: await createWorkbookBytes({
          mutate: (workbook) => {
            const worksheet = getWorksheet(workbook, "links");
            worksheet.getCell(2, findColumn(worksheet, "kind")).value = "resume";
          }
        }),
        error: /kind=resume or kind=file/
      },
      {
        bytes: await createWorkbookBytes({ mutate: (workbook) => { getWorksheet(workbook, "site_settings").addRow(["unknown_setting", "ignored"]); } }),
        error: /contains an unknown key/
      }
    ];

    for (const scenario of scenarios) {
      const { outputFile } = await createTemporaryPaths();
      await expect(generateFromWorkbook(scenario.bytes, { outputFile })).rejects.toThrow(scenario.error);
      expect(await fileDoesNotExist(outputFile)).toBe(true);
    }
  });

  it("accepts the canonical research media schema", async () => {
    const sheets = await parsePortfolioWorkbook(await createWorkbookBytes());

    expect(sheets.research[0]).toHaveProperty(
      "graphical_abstract",
      "/images/research/cytocv-graphical-abstract.png"
    );
    expect(sheets.research[0]).toHaveProperty(
      "graphical_abstract_alt",
      "Four-step CytoCV workflow from yeast microscopy channels through segmentation and fluorescence measurement to reviewable CSV/XLSX export."
    );
    expect(sheets.research[0]).toHaveProperty("video", "");
    expect(sheets.research[0]).not.toHaveProperty("image");
  });

  it("accepts the temporary exact legacy research schema without inventing staged media", async () => {
    const bytes = await createWorkbookBytes({
      mutate: (workbook) => {
        const worksheet = getWorksheet(workbook, "research");
        setLegacyResearchHeaders(worksheet);
        worksheet.getCell(2, findColumn(worksheet, "image")).value = "/images/research/legacy-workflow.png";
      }
    });

    const sheets = await parsePortfolioWorkbook(bytes);

    expect(sheets.research[0]).toMatchObject({ image: "/images/research/legacy-workflow.png" });
    expect(sheets.research[0]).not.toHaveProperty("graphical_abstract");
    expect(sheets.research[0]).not.toHaveProperty("graphical_abstract_alt");
    expect(sheets.research[0]).not.toHaveProperty("video");
  });

  it("rejects hybrid research header schemas during the temporary compatibility window", async () => {
    const bytes = await createWorkbookBytes({
      mutate: (workbook) => {
        const worksheet = getWorksheet(workbook, "research");
        worksheet.getCell(1, findColumn(worksheet, "graphical_abstract_alt")).value = "image";
      }
    });

    await expect(parsePortfolioWorkbook(bytes)).rejects.toThrow(/invalid header schema/);
  });
});
