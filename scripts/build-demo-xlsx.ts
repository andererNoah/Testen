/** Builds demo/import/demo-mandant.xlsx from the demo CSV files (same data, one sheet per entity). */
import { readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import ExcelJS from "exceljs";

const dir = path.resolve(import.meta.dirname, "../demo/import");
const sheetNames: Record<string, string> = {
  "objekte.csv": "Objekte",
  "gebaeude.csv": "Gebäude",
  "einheiten.csv": "Einheiten",
  "personen.csv": "Personen",
  "rollen.csv": "Rollen",
  "anlagen.csv": "Anlagen",
  "zaehler.csv": "Zähler",
};

const wb = new ExcelJS.Workbook();
wb.creator = "[PRODUKTNAME] Demo";
for (const file of (await readdir(dir)).filter((f) => f in sheetNames).sort((a, b) => Object.keys(sheetNames).indexOf(a) - Object.keys(sheetNames).indexOf(b))) {
  const ws = wb.addWorksheet(sheetNames[file]!);
  const lines = (await readFile(path.join(dir, file), "utf8")).trim().split("\n");
  lines.forEach((line, i) => {
    const row = ws.addRow(line.split(";"));
    if (i === 0) row.font = { bold: true };
  });
  ws.columns.forEach((c) => (c.width = 18));
  ws.views = [{ state: "frozen", ySplit: 1 }];
}
await writeFile(path.join(dir, "demo-mandant.xlsx"), Buffer.from(await wb.xlsx.writeBuffer()));
console.log("demo/import/demo-mandant.xlsx geschrieben");
