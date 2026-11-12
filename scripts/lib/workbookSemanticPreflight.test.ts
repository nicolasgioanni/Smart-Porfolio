import JSZip from "jszip";
import { describe, expect, it } from "vitest";
import { validateWorkbookSemantics } from "./workbookSemanticPreflight";

const ns = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
async function workbook(body: string, name = "xl/worksheets/sheet1.xml") {
  const zip = new JSZip();
  zip.file(name, `<worksheet xmlns="${ns}">${body}</worksheet>`);
  return zip.generateAsync({ type: "uint8array" });
}

describe("worksheet semantic preflight", () => {
  it("accepts bounded dimensions, sparse cells, and disjoint merges", async () => {
    await expect(validateWorkbookSemantics(await workbook('<dimension ref="A1:D10"/><sheetData><row r="1"><c r="A1"/></row><row r="10"><c r="D10"/></row></sheetData><mergeCells><mergeCell ref="A2:B3"/><mergeCell ref="C2:D3"/></mergeCells>'))).resolves.toBeUndefined();
  });
  it.each([
    '<mergeCells><mergeCell ref="A1:DX5000"/></mergeCells>',
    '<sheetData><row r="5001"><c r="A5001"/></row></sheetData>',
    '<sheetData><row r="1"><c r="DY1"/></row></sheetData>',
    '<dimension ref="A1:DX5000"/>',
    '<cols><col min="1" max="999"/></cols>'
  ])("rejects expansion beyond worksheet limits", async (body) => {
    await expect(validateWorkbookSemantics(await workbook(body))).rejects.toThrow(/dimensions/);
  });
  it.each([
    '<mergeCells><mergeCell ref="B3:A1"/></mergeCells>',
    '<mergeCells><mergeCell ref="A1:B2"/><mergeCell ref="B2:C3"/></mergeCells>',
    '<mergeCells><mergeCell ref="A1:"/></mergeCells>',
    '<sheetData><row r="1"><c r="A2"/></row></sheetData>',
    '<sheetData><row r="1"><c r="A1"/><c r="A1"/></row></sheetData>',
    '<sheetData><row xmlns="urn:other" r="1"/></sheetData>',
    '<sheetData><row r="1"><c r="A1">&evil;</c></row></sheetData>'
  ])("rejects malformed or ambiguous worksheet structures", async (body) => {
    await expect(validateWorkbookSemantics(await workbook(body))).rejects.toThrow(/valid XLSX/);
  });
  it("checks names ExcelJS matches even with a suffix", async () => {
    await expect(validateWorkbookSemantics(await workbook('<mergeCells><mergeCell ref="A1:DX5000"/></mergeCells>', 'xl/worksheets/sheet1.xml.extra'))).rejects.toThrow(/dimensions/);
  });
  it("prohibits DTDs in other XML parts", async () => {
    const zip = new JSZip(); zip.file("xl/workbook.xml", '<!DOCTYPE workbook [<!ENTITY x "data">]><workbook/>');
    await expect(validateWorkbookSemantics(await zip.generateAsync({ type: "uint8array" }))).rejects.toThrow(/valid XLSX/);
  });
});
