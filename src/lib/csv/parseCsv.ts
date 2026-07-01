import { parse } from "csv-parse/sync";

export type CsvRow = Record<string, string>;

export function parseCsv(csvText: string): CsvRow[] {
  return parse(csvText, {
    bom: true,
    columns: true,
    skip_empty_lines: true,
    trim: true
  }) as CsvRow[];
}
