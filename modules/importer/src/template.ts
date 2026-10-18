import ExcelJS from "exceljs";
import { ENTITIES, ENTITY_ORDER } from "./fields";

/** XLSX import template: one sheet per entity plus a sheet with explanations. */
export async function buildTemplateWorkbook(): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "[PRODUKTNAME]";
  for (const key of ENTITY_ORDER) {
    const def = ENTITIES[key];
    const ws = wb.addWorksheet(def.label);
    ws.columns = def.fields.map((f) => ({ header: f.label, key: f.key, width: Math.max(12, f.label.length + 4) }));
    const header = ws.getRow(1);
    header.font = { bold: true };
    def.fields.forEach((f, i) => {
      const cell = header.getCell(i + 1);
      const allowed = f.values ? [...new Set(Object.keys(f.values))].slice(0, 12).join(", ") : "";
      const note = [f.required ? "Pflichtfeld" : "", f.hint ?? "", allowed ? `Werte z. B.: ${allowed}` : ""].filter(Boolean).join("\n");
      if (note) cell.note = note;
      if (f.required) cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFFFF2CC" } };
    });
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  const help = wb.addWorksheet("Hinweise");
  help.columns = [
    { header: "Tabelle", key: "entity", width: 14 },
    { header: "Spalte", key: "field", width: 28 },
    { header: "Pflicht", key: "required", width: 8 },
    { header: "Format", key: "type", width: 12 },
    { header: "Hinweis", key: "hint", width: 70 },
  ];
  help.getRow(1).font = { bold: true };
  const formats: Record<string, string> = { text: "Text", integer: "Ganzzahl", decimal: "Zahl (62,5)", date: "TT.MM.JJJJ", boolean: "ja/nein", enum: "Auswahl", postalCode: "5 Ziffern", email: "E-Mail", iban: "IBAN" };
  for (const key of ENTITY_ORDER) {
    for (const f of ENTITIES[key].fields) {
      help.addRow({ entity: ENTITIES[key].label, field: f.label, required: f.required ? "ja" : "", type: formats[f.type], hint: f.hint ?? "" });
    }
  }
  return Buffer.from(await wb.xlsx.writeBuffer());
}
