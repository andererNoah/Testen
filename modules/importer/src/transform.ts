import { ENTITIES, ENTITY_ORDER, type EntityKey } from "./fields";
import type { SheetMapping } from "./mapping";
import type { Sheet } from "./parse";
import type { IssueCollector } from "./report";
import { ValueError, parseValue, type ParsedValue } from "./values";

export interface ImportRecord {
  sheet: string;
  row: number;
  values: Record<string, ParsedValue>;
}

export type RecordSet = Record<EntityKey, ImportRecord[]>;

/** Applies the column mapping and parses cell values; collects row-level issues. */
export function toRecords(sheets: Sheet[], mappings: SheetMapping[], issues: IssueCollector): RecordSet {
  const records = Object.fromEntries(ENTITY_ORDER.map((k) => [k, [] as ImportRecord[]])) as RecordSet;
  for (const sheet of sheets) {
    const mapping = mappings.find((m) => m.sheet === sheet.name);
    if (!mapping?.entity) {
      issues.warning({ sheet: sheet.name, message: "Tabelle wird nicht importiert (keine Datenart zugeordnet)." });
      continue;
    }
    const def = ENTITIES[mapping.entity];
    const columnByField = new Map<string, number>();
    sheet.headers.forEach((header, index) => {
      const field = mapping.columns[header];
      if (field) columnByField.set(field, index);
    });
    const missing = def.fields.filter((f) => f.required && !columnByField.has(f.key));
    if (missing.length) {
      issues.error({ sheet: sheet.name, message: `Pflichtspalten fehlen: ${missing.map((f) => f.label).join(", ")}` });
      continue;
    }
    sheet.rows.forEach((cells, i) => {
      const row = sheet.firstRow + i;
      const values: Record<string, ParsedValue> = {};
      let failed = false;
      for (const field of def.fields) {
        const index = columnByField.get(field.key);
        if (index === undefined) continue;
        try {
          values[field.key] = parseValue(field, cells[index] ?? "");
        } catch (error) {
          if (!(error instanceof ValueError)) throw error;
          issues.error({ sheet: sheet.name, row, column: sheet.headers[index], field: field.key, message: error.message });
          failed = true;
        }
        if (field.required && values[field.key] === null && !failed) {
          issues.error({ sheet: sheet.name, row, column: sheet.headers[index], field: field.key, message: `„${field.label}“ ist leer` });
          failed = true;
        }
      }
      if (!failed) records[mapping.entity!].push({ sheet: sheet.name, row, values });
    });
  }
  return records;
}

/** Checks within the files (no database): duplicate keys and plausibility. */
export function checkRecords(records: RecordSet, issues: IssueCollector): void {
  const dup = (entity: EntityKey, key: (r: ImportRecord) => string, label: string) => {
    const seen = new Map<string, ImportRecord>();
    for (const r of records[entity]) {
      const k = key(r);
      const first = seen.get(k);
      if (first) issues.error({ sheet: r.sheet, row: r.row, message: `${label} doppelt (zuerst in Zeile ${first.row})` });
      else seen.set(k, r);
    }
  };
  dup("properties", (r) => String(r.values.code).toLowerCase(), "Objektnummer");
  dup("buildings", (r) => `${r.values.propertyCode}|${r.values.name}`.toLowerCase(), "Gebäude");
  dup("units", (r) => `${r.values.propertyCode}|${r.values.number}`.toLowerCase(), "Einheit");
  dup("persons", (r) => String(r.values.externalKey).toLowerCase(), "Personennummer");
  dup("meters", (r) => `${r.values.kind}|${r.values.serialNumber}`.toLowerCase(), "Zähler");

  const kinds = new Map(records.properties.map((p) => [String(p.values.code).toLowerCase(), p]));
  for (const p of records.properties) {
    if (p.values.kind === "rental" && (p.values.meaDenominator || p.values.votingPrinciple)) {
      issues.warning({ sheet: p.sheet, row: p.row, message: "MEA-Nenner und Stimmrecht gelten nur für WEG und SEV und werden ignoriert." });
    }
  }
  const meaSums = new Map<string, { sum: bigint; count: number }>();
  for (const u of records.units) {
    if (u.values.type === "apartment" && !u.values.livingArea) issues.warning({ sheet: u.sheet, row: u.row, field: "livingArea", message: "Wohnung ohne Wohnfläche" });
    const property = kinds.get(String(u.values.propertyCode).toLowerCase());
    if (property?.values.kind === "weg") {
      if (!u.values.mea) issues.warning({ sheet: u.sheet, row: u.row, field: "mea", message: "WEG-Einheit ohne Miteigentumsanteil" });
      else {
        const [int, frac = ""] = String(u.values.mea).split(".");
        const entry = meaSums.get(String(property.values.code)) ?? { sum: 0n, count: 0 };
        entry.sum += BigInt(int!) * 10000n + BigInt((frac + "0000").slice(0, 4));
        entry.count++;
        meaSums.set(String(property.values.code), entry);
      }
    }
    if ((u.values.linkedPropertyCode && !u.values.linkedUnitNumber) || (!u.values.linkedPropertyCode && u.values.linkedUnitNumber)) {
      issues.error({ sheet: u.sheet, row: u.row, message: "Für die Verknüpfung mit der WEG sind WEG-Objektnummer und WEG-Einheit nötig" });
    }
  }
  for (const [code, { sum }] of meaSums) {
    const p = kinds.get(code.toLowerCase())!;
    const denominator = p.values.meaDenominator as number | null;
    if (denominator && sum !== BigInt(denominator) * 10000n) {
      const shown = `${sum / 10000n}${sum % 10000n ? "," + (sum % 10000n).toString().padStart(4, "0").replace(/0+$/, "") : ""}`;
      issues.warning({ sheet: p.sheet, row: p.row, message: `Summe der MEA (${shown}) entspricht nicht dem Nenner ${denominator}` });
    }
  }
  for (const p of records.persons) {
    const v = p.values;
    const kind = v.kind ?? (v.companyName && !v.lastName ? "legal" : "natural");
    v.kind = kind;
    if (kind === "natural" && !v.lastName) issues.error({ sheet: p.sheet, row: p.row, field: "lastName", message: "Natürliche Person ohne Nachname" });
    if (kind === "legal" && !v.companyName) issues.error({ sheet: p.sheet, row: p.row, field: "companyName", message: "Juristische Person ohne Firmennamen" });
  }
  for (const r of records.roles) {
    if (r.values.validFrom && r.values.validTo && String(r.values.validTo) <= String(r.values.validFrom)) {
      issues.error({ sheet: r.sheet, row: r.row, field: "validTo", message: "„Bis“ muss nach „Von“ liegen" });
    }
  }
  for (const a of records.assets) {
    if (a.values.kind === "heating" && !a.values.energyCarrier) issues.error({ sheet: a.sheet, row: a.row, field: "energyCarrier", message: "Heizung ohne Energieträger" });
  }
  for (const m of records.meters) {
    if (m.values.interoperable && !m.values.remoteReadable) issues.error({ sheet: m.sheet, row: m.row, field: "interoperable", message: "Interoperabel setzt fernablesbar voraus" });
  }
}
