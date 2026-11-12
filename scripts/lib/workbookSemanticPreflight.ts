import JSZip from "jszip";
import { SaxesParser, type SaxesTagNS } from "saxes";
import { invalidXlsxWorkbookError } from "./workbookArchive";

export const portfolioWorkbookMaxRowsPerSheet = 5_000;
export const portfolioWorkbookMaxColumnsPerSheet = 128;
export const portfolioWorkbookMaxCellsPerSheet = 250_000;
const spreadsheetNamespace = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";

type Point = { row: number; column: number };
function point(value: string): Point {
  const match = /^\$?([A-Z]{1,3})\$?([1-9][0-9]*)$/.exec(value);
  if (!match) throw invalidXlsxWorkbookError();
  let column = 0;
  for (const letter of match[1]!) column = column * 26 + letter.charCodeAt(0) - 64;
  const row = Number(match[2]);
  if (!Number.isSafeInteger(row) || row > portfolioWorkbookMaxRowsPerSheet || column > portfolioWorkbookMaxColumnsPerSheet) throw dimensionError();
  return { row, column };
}
function range(value: string): [Point, Point] {
  const parts = value.split(":");
  if (parts.length > 2 || parts.length < 1) throw invalidXlsxWorkbookError();
  const start = point(parts[0]!);
  const end = point(parts[1] ?? parts[0]!);
  if (start.row > end.row || start.column > end.column) throw invalidXlsxWorkbookError();
  return [start, end];
}
function dimensionError(): Error { return new Error("The XLSX workbook exceeds the allowed worksheet dimensions"); }
function attribute(tag: SaxesTagNS, name: string): string | undefined {
  const found = tag.attributes[name];
  return found && found.uri === "" ? found.value : undefined;
}
function integer(value: string | undefined, max: number): number {
  if (!value || !/^[1-9][0-9]*$/.test(value)) throw invalidXlsxWorkbookError();
  const number = Number(value);
  if (!Number.isSafeInteger(number) || number > max) throw dimensionError();
  return number;
}

// Run only after the streamed archive byte limits. ExcelJS creates cells for
// merges and sparse indices before its public worksheet dimensions are available.
export async function validateWorkbookSemantics(bytes: Uint8Array): Promise<void> {
  const archive = await JSZip.loadAsync(bytes, { createFolders: false });
  for (const entry of Object.values(archive.files)) {
    const worksheet = /xl\/worksheets\/sheet\d+[.]xml/.test(entry.name);
    if (entry.dir || (!worksheet && !/\.(?:xml|rels|vml)/i.test(entry.name))) continue;
    let maxRow = 0, maxColumn = 0, currentRow = 0, cells = 0, rows = 0, mergeArea = 0;
    const seenRows = new Set<number>();
    const seenCells = new Set<string>();
    const occupied = new Set<number>();
    const stack: string[] = [];
    const parser = new SaxesParser({ xmlns: true });
    const extend = (p: Point) => {
      maxRow = Math.max(maxRow, p.row); maxColumn = Math.max(maxColumn, p.column);
      if (maxRow * maxColumn > portfolioWorkbookMaxCellsPerSheet) throw dimensionError();
    };
    parser.on("doctype", () => { throw invalidXlsxWorkbookError(); });
    parser.on("opentag", (tag) => {
      if (worksheet) {
        if (stack.length === 0 && (tag.local !== "worksheet" || tag.uri !== spreadsheetNamespace)) throw invalidXlsxWorkbookError();
        const relevant = ["dimension", "row", "c", "mergeCell", "col"].includes(tag.local);
        if (relevant && tag.uri !== spreadsheetNamespace) throw invalidXlsxWorkbookError();
        if (tag.uri === spreadsheetNamespace) {
          if (tag.local === "dimension") {
            const [, end] = range(attribute(tag, "ref") ?? ""); extend(end);
          } else if (tag.local === "row") {
            currentRow = integer(attribute(tag, "r"), portfolioWorkbookMaxRowsPerSheet);
            if (++rows > portfolioWorkbookMaxRowsPerSheet || seenRows.has(currentRow)) throw dimensionError();
            seenRows.add(currentRow); extend({ row: currentRow, column: 1 });
          } else if (tag.local === "c") {
            const p = point(attribute(tag, "r") ?? "");
            if (stack.at(-1) !== "row" || p.row !== currentRow || seenCells.has(`${p.row}:${p.column}`)) throw invalidXlsxWorkbookError();
            if (++cells > portfolioWorkbookMaxCellsPerSheet) throw dimensionError();
            seenCells.add(`${p.row}:${p.column}`); extend(p);
          } else if (tag.local === "col") {
            const min = integer(attribute(tag, "min"), portfolioWorkbookMaxColumnsPerSheet);
            const max = integer(attribute(tag, "max"), portfolioWorkbookMaxColumnsPerSheet);
            if (min > max) throw invalidXlsxWorkbookError();
            extend({ row: 1, column: max });
          } else if (tag.local === "mergeCell") {
            const [start, end] = range(attribute(tag, "ref") ?? ""); extend(end);
            mergeArea += (end.row - start.row + 1) * (end.column - start.column + 1);
            if (mergeArea > portfolioWorkbookMaxCellsPerSheet) throw dimensionError();
            for (let row = start.row; row <= end.row; row++) for (let col = start.column; col <= end.column; col++) {
              const index = (row - 1) * portfolioWorkbookMaxColumnsPerSheet + col;
              if (occupied.has(index)) throw invalidXlsxWorkbookError();
              occupied.add(index);
            }
          }
        }
      }
      stack.push(tag.local);
    });
    parser.on("closetag", (tag) => { stack.pop(); if (tag.local === "row") currentRow = 0; });
    try { parser.write(await entry.async("string")).close(); } catch (error) {
      if (error instanceof Error && error.message === dimensionError().message) throw error;
      throw invalidXlsxWorkbookError();
    }
  }
}
