import { createHash } from "node:crypto";
import ExcelJS, {
  type Cell,
  type CellFormulaValue,
  type CellSharedFormulaValue,
  type CellValue,
  type Worksheet
} from "exceljs";
import { parse } from "csv-parse/sync";
import type { GeneratedPortfolioContent } from "../../src/content/types";
import { parseCsv, type CsvRow } from "../../src/lib/csv/parseCsv";
import type { PortfolioSheetName } from "../../src/lib/content/normalizePortfolioContent";

export const portfolioWorkbookSheetNames = [
  "profile",
  "links",
  "research",
  "projects",
  "experience",
  "recommendations",
  "education",
  "skills",
  "site_settings"
] as const satisfies readonly PortfolioSheetName[];

export type PortfolioWorkbookSheetName = (typeof portfolioWorkbookSheetNames)[number];
export type PortfolioWorkbookSheets = Record<PortfolioWorkbookSheetName, CsvRow[]>;

export const portfolioWorkbookMaxRowsPerSheet = 5_000;
export const portfolioWorkbookMaxColumnsPerSheet = 128;
export const portfolioWorkbookMaxCellsPerSheet = 250_000;

const allowedProfileKeys = new Set([
  "full_name",
  "preferred_name",
  "headline",
  "role_engineer_prefixes",
  "role_engineer_suffix",
  "role_alternate",
  "current_title",
  "current_company",
  "current_experience_id",
  "previous_experience_id",
  "featured_research_id",
  "primary_education_id",
  "location",
  "timezone",
  "time_zone",
  "email",
  "pronouns",
  "university",
  "degree",
  "field_of_study",
  "graduation",
  "short_bio",
  "long_bio",
  "experience_summary",
  "portrait_image",
  "favicon_image",
  "resume_url",
  "resume_download_label",
  "primary_cta_label",
  "secondary_cta_label"
]);

const allowedSiteSettingKeys = new Set([
  "site_title",
  "site_description",
  "default_theme",
  "enable_skeletons",
  "enable_scroll_motion",
  "enable_glass_effects",
  "enable_recommendations",
  "show_empty_recommendations",
  "max_home_research_items",
  "max_home_project_items",
  "max_home_experience_items",
  "max_home_recommendation_items",
  "max_home_skill_items",
  "recommendations_nav_label",
  "license_name",
  "license_url",
  "copyright_owner",
  "repository_url",
  "legal_contact_email",
  "legal_effective_date",
  "hosting_provider_name",
  "hosting_privacy_url"
]);

const expectedHeaders: Record<PortfolioSheetName, readonly string[]> = {
  profile: ["key", "value"],
  links: ["id", "label", "url", "icon", "kind", "is_primary", "show_on_home", "show_in_header", "show_in_footer", "order"],
  research: [
    "id", "title", "home_title", "role", "organization", "organization_logo", "organization_logo_alt",
    "location", "start_date", "end_date", "home_summary", "profile_summary", "profile_byline", "profile_labs",
    "detail_summary", "impact", "bullets", "skills", "links", "pending_links", "image", "featured",
    "show_on_home", "home_order", "detail_order"
  ],
  projects: [
    "id", "title", "subtitle", "home_summary", "home_skills", "home_skill_1_summary", "home_skill_1_details",
    "home_skill_2_summary", "home_skill_2_details", "home_skill_3_summary", "home_skill_3_details", "detail_summary",
    "problem", "solution", "impact", "stack", "links", "image", "featured", "show_on_home", "home_order",
    "detail_order"
  ],
  experience: [
    "id", "title", "organization", "organization_logo", "organization_logo_alt", "type", "location", "start_date",
    "end_date", "home_summary", "detail_summary", "bullets", "skills", "featured", "show_on_home", "home_order",
    "detail_order"
  ],
  recommendations: [
    "id", "recommender_name", "recommender_title", "recommender_organization", "relationship",
    "recommendation_date", "source", "source_url", "linkedin_url", "home_quote", "full_quote",
    "full_quote_link_label", "full_quote_link_url", "context", "skills", "featured", "show_on_home", "home_order",
    "detail_order"
  ],
  education: [
    "id", "institution", "institution_logo", "institution_logo_alt", "degree", "field", "concentration", "location",
    "start_date", "end_date", "home_summary", "detail_summary", "bullets", "featured", "show_on_home", "home_order",
    "detail_order"
  ],
  skills: [
    "id", "category", "category_order", "name", "icon", "proficiency", "summary", "where_used", "priority",
    "featured", "show_on_home", "order"
  ],
  resume: ["section", "key", "value", "order"],
  site_settings: ["key", "value"]
};

const requiredKeyRows: Partial<Record<PortfolioWorkbookSheetName, readonly string[]>> = {
  profile: ["full_name", "headline", "location", "email", "short_bio"],
  site_settings: ["site_title", "site_description", "default_theme"]
};

export function validatePortfolioWorkbookUrl(value: string): string {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(value.trim());
  } catch {
    throw new Error("PORTFOLIO_WORKBOOK_URL must be an anonymous HTTPS URL");
  }

  if (parsedUrl.protocol !== "https:" || parsedUrl.username || parsedUrl.password) {
    throw new Error("PORTFOLIO_WORKBOOK_URL must be an anonymous HTTPS URL");
  }

  return parsedUrl.href;
}

export function validatePortfolioWorkbookPayload(bytes: Uint8Array, contentType: string | null): void {
  const prefix = new TextDecoder("utf-8", { fatal: false }).decode(bytes.subarray(0, 1024)).trimStart().toLowerCase();
  const normalizedContentType = contentType?.toLowerCase() ?? "";

  if (
    normalizedContentType.includes("text/html") ||
    prefix.startsWith("<!doctype html") ||
    prefix.startsWith("<html") ||
    prefix.includes("<form") && /sign[ -]?in|log[ -]?in|permission|access denied/.test(prefix)
  ) {
    throw new Error("The workbook download returned an HTML, login, or permission response instead of XLSX");
  }

  const hasZipSignature =
    bytes.length >= 4 &&
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08));

  if (!hasZipSignature) {
    throw new Error("The workbook download is not a ZIP-based XLSX file");
  }
}

function validateHeaders(records: string[][], sheetName: PortfolioSheetName): void {
  const actualHeaders = records[0];
  const requiredHeaders = expectedHeaders[sheetName];

  if (!actualHeaders) {
    throw new Error(`The ${sheetName} tab is empty or missing its header row`);
  }

  const normalizedHeaders = actualHeaders.map((header) => header.trim());
  const hasExactHeaderSet =
    normalizedHeaders.length === requiredHeaders.length &&
    new Set(normalizedHeaders).size === normalizedHeaders.length &&
    requiredHeaders.every((header) => normalizedHeaders.includes(header));

  if (!hasExactHeaderSet) {
    throw new Error(`The ${sheetName} tab has an invalid header schema`);
  }
}

function validateRequiredKeyRows(rows: CsvRow[], sheetName: PortfolioSheetName): void {
  const requiredKeys = requiredKeyRows[sheetName as PortfolioWorkbookSheetName];
  if (!requiredKeys) return;

  const actualKeys = new Set(rows.map((row) => row.key?.trim()).filter(Boolean));
  if (!requiredKeys.every((key) => actualKeys.has(key))) {
    throw new Error(`The ${sheetName} tab does not contain its required key rows`);
  }
}

export function parseAndValidatePortfolioCsv(csvText: string, sheetName: PortfolioSheetName): CsvRow[] {
  let records: string[][];

  try {
    records = parse(csvText, { bom: true, skip_empty_lines: true, trim: true }) as string[][];
  } catch {
    throw new Error(`The ${sheetName} template contains malformed CSV`);
  }

  validateHeaders(records, sheetName);

  let rows: CsvRow[];
  try {
    rows = parseCsv(csvText);
  } catch {
    throw new Error(`The ${sheetName} template contains malformed CSV`);
  }

  validateRequiredKeyRows(rows, sheetName);
  return rows;
}

function validateKnownKeyRows(rows: CsvRow[], sheetName: "profile" | "site_settings", allowedKeys: Set<string>): void {
  const seenKeys = new Set<string>();

  for (const row of rows) {
    const key = row.key?.trim() ?? "";

    if (!allowedKeys.has(key)) {
      throw new Error(`The workbook ${sheetName} tab contains an unknown key`);
    }

    if (seenKeys.has(key)) {
      throw new Error(`The workbook ${sheetName} tab contains a duplicate key: ${key}`);
    }

    seenKeys.add(key);
  }
}

export function validateWorkbookPortfolioRows(rows: CsvRow[], sheetName: PortfolioWorkbookSheetName): void {
  if (sheetName === "profile") {
    validateKnownKeyRows(rows, sheetName, allowedProfileKeys);

    for (const row of rows) {
      const key = row.key?.trim();
      if ((key === "resume_url" || key === "resume_download_label") && row.value?.trim()) {
        throw new Error(`The workbook profile tab must leave ${key} blank`);
      }
    }
  }

  if (sheetName === "site_settings") {
    validateKnownKeyRows(rows, sheetName, allowedSiteSettingKeys);
  }

  if (
    sheetName === "links" &&
    rows.some((row) => ["resume", "file"].includes(row.kind?.trim().toLowerCase() ?? ""))
  ) {
    throw new Error("The workbook links tab must not contain rows with kind=resume or kind=file");
  }
}

function isFormulaValue(value: CellValue): value is CellFormulaValue | CellSharedFormulaValue {
  return Boolean(
    value &&
      typeof value === "object" &&
      (Object.prototype.hasOwnProperty.call(value, "formula") ||
        Object.prototype.hasOwnProperty.call(value, "sharedFormula"))
  );
}

function normalizeDisplayedCellText(cell: Cell, location: string): string {
  if (isFormulaValue(cell.value)) {
    const value = cell.value;
    if (value.result === null || value.result === undefined) {
      throw new Error(`The workbook formula at ${location} is missing a cached value`);
    }
  }

  return cell.text.replace(/\r\n?/g, "\n");
}

function worksheetToRows(worksheet: Worksheet, sheetName: PortfolioWorkbookSheetName): CsvRow[] {
  if (
    worksheet.rowCount > portfolioWorkbookMaxRowsPerSheet ||
    worksheet.columnCount > portfolioWorkbookMaxColumnsPerSheet ||
    worksheet.rowCount * worksheet.columnCount > portfolioWorkbookMaxCellsPerSheet
  ) {
    throw new Error(`The ${sheetName} tab exceeds the allowed worksheet dimensions`);
  }

  const records: string[][] = [];
  let lastMeaningfulRow = 0;
  let lastMeaningfulColumn = 0;

  for (let rowIndex = 1; rowIndex <= worksheet.rowCount; rowIndex += 1) {
    const row: string[] = [];

    for (let columnIndex = 1; columnIndex <= worksheet.columnCount; columnIndex += 1) {
      const cell = worksheet.getCell(rowIndex, columnIndex);
      const text = normalizeDisplayedCellText(cell, `${sheetName}!${cell.address}`);

      if (rowIndex > 1 && columnIndex > expectedHeaders[sheetName].length && text.trim()) {
        throw new Error(`The ${sheetName} tab has a malformed row structure`);
      }

      row.push(text);

      if (text.trim()) {
        lastMeaningfulRow = Math.max(lastMeaningfulRow, rowIndex);
        lastMeaningfulColumn = Math.max(lastMeaningfulColumn, columnIndex);
      }
    }

    records.push(row);
  }

  const normalizedRecords = records
    .slice(0, lastMeaningfulRow)
    .map((row) => row.slice(0, lastMeaningfulColumn));
  validateHeaders(normalizedRecords, sheetName);

  const headers = normalizedRecords[0]!.map((header) => header.trim());
  const rows = normalizedRecords
    .slice(1)
    .filter((row) => row.some((value) => value.trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header, row[index] ?? ""])));

  validateRequiredKeyRows(rows, sheetName);
  validateWorkbookPortfolioRows(rows, sheetName);
  return rows;
}

function normalizeWorksheetTitle(title: string): string {
  return title.trim().toLowerCase();
}

export async function parsePortfolioWorkbook(bytes: Uint8Array): Promise<PortfolioWorkbookSheets> {
  const workbook = new ExcelJS.Workbook();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;

  try {
    await workbook.xlsx.load(arrayBuffer);
  } catch {
    throw new Error("The workbook download is not a valid XLSX workbook");
  }

  if (workbook.worksheets.length === 0) {
    throw new Error("The XLSX workbook is empty");
  }

  const expectedNames = new Set<string>(portfolioWorkbookSheetNames);
  const seenNames = new Set<string>();
  const worksheetsByName = new Map<PortfolioWorkbookSheetName, Worksheet>();

  for (const worksheet of workbook.worksheets) {
    if (worksheet.state !== "visible") {
      throw new Error("The XLSX workbook must not contain hidden or veryHidden tabs");
    }

    const normalizedName = normalizeWorksheetTitle(worksheet.name);
    if (seenNames.has(normalizedName)) {
      throw new Error("The XLSX workbook contains duplicate normalized tab names");
    }
    seenNames.add(normalizedName);

    if (normalizedName === "resume") {
      throw new Error("The XLSX workbook must not contain a resume tab");
    }

    if (!expectedNames.has(normalizedName)) {
      throw new Error("The XLSX workbook contains an unexpected tab");
    }

    worksheetsByName.set(normalizedName as PortfolioWorkbookSheetName, worksheet);
  }

  const missingNames = portfolioWorkbookSheetNames.filter((name) => !worksheetsByName.has(name));
  if (missingNames.length > 0) {
    throw new Error(`The XLSX workbook is missing required tabs: ${missingNames.join(", ")}`);
  }

  if (workbook.worksheets.length !== portfolioWorkbookSheetNames.length) {
    throw new Error("The XLSX workbook must contain exactly the nine required tabs");
  }

  return Object.fromEntries(
    portfolioWorkbookSheetNames.map((name) => [name, worksheetToRows(worksheetsByName.get(name)!, name)])
  ) as PortfolioWorkbookSheets;
}

function canonicalize(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalize);

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, childValue]) => childValue !== undefined)
        .sort(([leftKey], [rightKey]) => (leftKey < rightKey ? -1 : leftKey > rightKey ? 1 : 0))
        .map(([key, childValue]) => [key, canonicalize(childValue)])
    );
  }

  return value;
}

export function createPortfolioContentHash(content: GeneratedPortfolioContent): string {
  const renderedProfile = Object.fromEntries(
    Object.entries(content.profile).filter(
      ([key]) => !["previousExperienceId", "primaryCtaLabel", "secondaryCtaLabel"].includes(key)
    )
  );
  const renderedSiteSettings = Object.fromEntries(
    Object.entries(content.siteSettings).filter(([key]) => key !== "maxHomeExperienceItems")
  );
  const renderedEducation = content.education.map((item) =>
    Object.fromEntries(
      Object.entries(item).filter(
        ([key]) => !["homeSummary", "detailSummary", "detailOrder"].includes(key)
      )
    )
  );
  const renderedContent = Object.fromEntries(
    Object.entries(content)
      .filter(([key]) => key !== "metadata")
      .map(([key, value]) => {
        if (key === "profile") return [key, renderedProfile];
        if (key === "siteSettings") return [key, renderedSiteSettings];
        if (key === "education") return [key, renderedEducation];
        return [key, value];
      })
  );
  const canonicalContent = JSON.stringify(canonicalize(renderedContent));
  return createHash("sha256").update(canonicalContent, "utf8").digest("hex");
}

type PreviousGeneratedContent = {
  metadata?: { contentHash?: unknown; generatedAt?: unknown };
};

export function finalizeGeneratedPortfolioContent(
  content: GeneratedPortfolioContent,
  previousContent: PreviousGeneratedContent | undefined
): { content: GeneratedPortfolioContent; contentChanged: boolean } {
  const contentHash = createPortfolioContentHash(content);
  const previousHash = previousContent?.metadata?.contentHash;
  const previousGeneratedAt = previousContent?.metadata?.generatedAt;
  const hasCurrentPreviousHash = typeof previousHash === "string" && /^[a-f0-9]{64}$/.test(previousHash);
  const contentChanged = !hasCurrentPreviousHash || previousHash !== contentHash;
  const generatedAt =
    !contentChanged && typeof previousGeneratedAt === "string" && previousGeneratedAt.trim()
      ? previousGeneratedAt
      : content.metadata.generatedAt;

  return {
    content: {
      ...content,
      metadata: { ...content.metadata, generatedAt, contentHash }
    },
    contentChanged
  };
}
