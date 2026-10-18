import { parse as parseCsv } from "csv-parse/sync";
import ExcelJS from "exceljs";
import { createHash } from "node:crypto";
import { ValidationError } from "@hv/core";

export interface UploadedFile {
  filename: string;
  data: Buffer;
}

export interface Sheet {
  /** File name (CSV) or "file.xlsx › sheet name" */
  name: string;
  /** Name used for entity detection (sheet title or file name without extension). */
  baseName: string;
  headers: string[];
  /** Data rows as strings, aligned to headers. */
  rows: string[][];
  /** Spreadsheet row number of the first data row (for messages). */
  firstRow: number;
}

export interface SourceFileInfo {
  filename: string;
  size: number;
  sha256: string;
  encoding?: string;
}

function decodeText(data: Buffer): { text: string; encoding: string } {
  try {
    const text = new TextDecoder("utf-8", { fatal: true }).decode(data);
    return { text: text.replace(/^\uFEFF/, ""), encoding: "utf-8" };
  } catch {
    // German Excel CSV exports are often Windows-1252.
    return { text: new TextDecoder("windows-1252").decode(data), encoding: "windows-1252" };
  }
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const counts = [";", ",", "\t", "|"].map((d) => [d, firstLine.split(d).length - 1] as const);
  counts.sort((a, b) => b[1] - a[1]);
  return counts[0]![1] > 0 ? counts[0]![0] : ";";
}

function trimTrailingEmpty(rows: string[][]): string[][] {
  return rows.filter((r) => r.some((c) => c.trim() !== ""));
}

function cellToString(value: ExcelJS.CellValue): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) {
    // exceljs returns dates as UTC midnight
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === "number") return String(value);
  if (typeof value === "boolean") return value ? "ja" : "nein";
  if (typeof value === "string") return value;
  if (typeof value === "object") {
    if ("result" in value && value.result !== undefined) return cellToString(value.result as ExcelJS.CellValue);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if ("text" in value && typeof value.text === "string") return value.text;
    if ("error" in value) return "";
  }
  return String(value);
}

async function parseXlsx(file: UploadedFile): Promise<Sheet[]> {
  const workbook = new ExcelJS.Workbook();
  try {
    await workbook.xlsx.load(file.data as unknown as ArrayBuffer);
  } catch {
    throw new ValidationError(`„${file.filename}“ ist keine lesbare XLSX-Datei.`);
  }
  const sheets: Sheet[] = [];
  workbook.eachSheet((ws) => {
    if (ws.state && ws.state !== "visible") return;
    const raw: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row, rowNumber) => {
      const values: string[] = [];
      for (let c = 1; c <= ws.columnCount; c++) values.push(cellToString(row.getCell(c).value).trim());
      raw[rowNumber - 1] = values;
    });
    const rows = raw.map((r) => r ?? []);
    const headerIndex = rows.findIndex((r) => r.some((c) => c !== ""));
    if (headerIndex < 0) return;
    const headers = rows[headerIndex]!.map((h) => h.trim());
    const width = headers.length;
    const data = trimTrailingEmpty(rows.slice(headerIndex + 1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? "")));
    sheets.push({ name: `${file.filename} › ${ws.name}`, baseName: ws.name, headers, rows: data, firstRow: headerIndex + 2 });
  });
  return sheets;
}

function parseCsvFile(file: UploadedFile): { sheet: Sheet; encoding: string } {
  const { text, encoding } = decodeText(file.data);
  let records: string[][];
  try {
    records = parseCsv(text, { delimiter: detectDelimiter(text), relax_column_count: true, skip_empty_lines: false, bom: true, trim: false }) as string[][];
  } catch (error) {
    throw new ValidationError(`„${file.filename}“ ist keine lesbare CSV-Datei: ${(error as Error).message}`);
  }
  const headerIndex = records.findIndex((r) => r.some((c) => c.trim() !== ""));
  if (headerIndex < 0) throw new ValidationError(`„${file.filename}“ ist leer.`);
  const headers = records[headerIndex]!.map((h) => h.trim());
  const rows = trimTrailingEmpty(records.slice(headerIndex + 1).map((r) => Array.from({ length: headers.length }, (_, i) => (r[i] ?? "").trim())));
  return { sheet: { name: file.filename, baseName: file.filename.replace(/\.[^.]+$/, ""), headers, rows, firstRow: headerIndex + 2 }, encoding };
}

export async function parseFiles(files: UploadedFile[]): Promise<{ sheets: Sheet[]; sources: SourceFileInfo[] }> {
  if (files.length === 0) throw new ValidationError("Keine Datei hochgeladen.");
  const sheets: Sheet[] = [];
  const sources: SourceFileInfo[] = [];
  for (const file of files) {
    const info: SourceFileInfo = { filename: file.filename, size: file.data.length, sha256: createHash("sha256").update(file.data).digest("hex") };
    const lower = file.filename.toLowerCase();
    if (lower.endsWith(".xlsx")) {
      sheets.push(...(await parseXlsx(file)));
    } else if (lower.endsWith(".csv") || lower.endsWith(".txt")) {
      const { sheet, encoding } = parseCsvFile(file);
      info.encoding = encoding;
      sheets.push(sheet);
    } else {
      throw new ValidationError(`„${file.filename}“: Nur CSV- und XLSX-Dateien werden unterstützt.`);
    }
    sources.push(info);
  }
  return { sheets, sources };
}
