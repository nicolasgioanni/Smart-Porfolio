import { parse } from "csv-parse/sync";

export type CsvRow = Record<string, string>;

const unsafeCsvHeaderNames = new Set(["__proto__", "constructor", "prototype"]);

function validateCsvHeaders(headers: string[]): string[] {
  const normalizedHeaders = headers.map((header) => header.trim());
  const seenHeaders = new Set<string>();

  for (const header of normalizedHeaders) {
    if (!header) throw new Error("CSV headers must not contain an empty field name");
    if (unsafeCsvHeaderNames.has(header)) throw new Error("CSV headers must not contain unsafe field names");
    if (seenHeaders.has(header)) throw new Error("CSV headers must not contain duplicate field names");
    seenHeaders.add(header);
  }

  return normalizedHeaders;
}

export function parseCsv(csvText: string): CsvRow[] {
  return parse(csvText, {
    bom: true,
    columns: validateCsvHeaders,
    skip_empty_lines: true,
    trim: true
  }) as CsvRow[];
}
