import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { ENTITIES, buildTemplateWorkbook, detectEntity, parseFiles, parseValue, suggestColumns } from "@hv/importer";

const field = (entity: keyof typeof ENTITIES, key: string) => ENTITIES[entity].fields.find((f) => f.key === key)!;

describe("Werte (deutsche Formate)", () => {
  it.each([
    ["units", "livingArea", "62,5", "62.5"],
    ["units", "livingArea", "1.234,56", "1234.56"],
    ["units", "livingArea", "74.15", "74.15"],
    ["units", "livingArea", "68,40 m²", "68.40"],
    ["roles", "validFrom", "01.07.2024", "2024-07-01"],
    ["roles", "validFrom", "1.7.24", "2024-07-01"],
    ["roles", "validFrom", "2024-07-01", "2024-07-01"],
    ["meters", "remoteReadable", "Ja", true],
    ["meters", "remoteReadable", "x", true],
    ["meters", "remoteReadable", "nein", false],
    ["properties", "kind", "Mietverwaltung", "rental"],
    ["properties", "kind", "WEG", "weg"],
    ["properties", "state", "Nordrhein-Westfalen", "NW"],
    ["properties", "state", "Thüringen", "TH"],
    ["units", "type", "Tiefgaragenstellplatz", "parking"],
    ["roles", "role", "Eigentümerin", "eigentuemer"],
    ["meters", "kind", "WMZ", "heat"],
    ["properties", "postalCode", "4107", "04107"],
    ["persons", "email", "Max@Example.ORG", "max@example.org"],
    ["persons", "iban", "de89 3704 0044 0532 0130 00", "DE89370400440532013000"],
    ["units", "mea", "", null],
  ] as const)("%s.%s: „%s“ → %o", (entity, key, raw, expected) => {
    expect(parseValue(field(entity, key), raw)).toEqual(expected);
  });

  it.each([
    ["roles", "validFrom", "31.02.2024"],
    ["units", "livingArea", "zwölf"],
    ["units", "livingArea", "1,23456"],
    ["properties", "kind", "Hotel"],
    ["meters", "remoteReadable", "vielleicht"],
    ["persons", "iban", "DE89370400440532013001"],
  ] as const)("%s.%s: „%s“ wird abgelehnt", (entity, key, raw) => {
    expect(() => parseValue(field(entity, key), raw)).toThrow();
  });
});

describe("Feld-Mapping mit Vorschlägen (V20)", () => {
  it("ordnet fremde Spaltennamen zu", () => {
    const suggestion = suggestColumns("units", ["Obj.-Nr.", "WE-Nr", "Nutzungsart", "Wohnfläche m²", "Miteigentumsanteil", "Bemerkung"]);
    expect(Object.fromEntries(suggestion.map((s) => [s.header, s.field]))).toEqual({
      "Obj.-Nr.": "propertyCode",
      "WE-Nr": "number",
      Nutzungsart: "type",
      "Wohnfläche m²": "livingArea",
      Miteigentumsanteil: "mea",
      Bemerkung: null,
    });
  });

  it("erkennt die Datenart am Namen oder an den Spalten", () => {
    expect(detectEntity({ baseName: "Zähler", headers: [] }).entity).toBe("meters");
    expect(detectEntity({ baseName: "export_2026", headers: ["Personennummer", "Vorname", "Nachname", "E-Mail"] }).entity).toBe("persons");
    expect(detectEntity({ baseName: "irgendwas", headers: ["A", "B"] }).entity).toBeNull();
  });
});

describe("Dateien lesen", () => {
  it("liest CSV in Windows-1252 mit Semikolon", async () => {
    const latin1 = Buffer.from([...Buffer.from("Objektnummer;Name;Stra"), 0xdf, ...Buffer.from("e\nW1;Haus M"), 0xfc, ...Buffer.from("ller;Hauptstra"), 0xdf, ...Buffer.from("e\n")]);
    const { sheets, sources } = await parseFiles([{ filename: "objekte.csv", data: latin1 }]);
    expect(sources[0]!.encoding).toBe("windows-1252");
    expect(sheets[0]!.headers).toEqual(["Objektnummer", "Name", "Straße"]);
    expect(sheets[0]!.rows).toEqual([["W1", "Haus Müller", "Hauptstraße"]]);
    expect(sheets[0]!.firstRow).toBe(2);
  });

  it("liest XLSX mit Datums- und Zahlenzellen", async () => {
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet("Rollen");
    ws.addRow(["Personennummer", "Rolle", "Objektnummer", "Von"]);
    ws.addRow(["P1", "Mieter", 4711, new Date(Date.UTC(2024, 6, 1))]);
    const { sheets } = await parseFiles([{ filename: "x.xlsx", data: Buffer.from(await wb.xlsx.writeBuffer()) }]);
    expect(sheets[0]!.baseName).toBe("Rollen");
    expect(sheets[0]!.rows).toEqual([["P1", "Mieter", "4711", "2024-07-01"]]);
  });

  it("lehnt andere Formate verständlich ab", async () => {
    await expect(parseFiles([{ filename: "daten.pdf", data: Buffer.from("x") }])).rejects.toThrow(/Nur CSV- und XLSX/);
  });

  it("die Vorlage enthält alle Tabellen und Pflichtspalten", async () => {
    const buffer = await buildTemplateWorkbook();
    const { sheets } = await parseFiles([{ filename: "vorlage.xlsx", data: buffer }]);
    expect(sheets.map((s) => s.baseName)).toEqual(["Objekte", "Gebäude", "Einheiten", "Personen", "Rollen", "Anlagen", "Zähler", "Hinweise"]);
    for (const sheet of sheets.slice(0, 7)) expect(detectEntity(sheet).entity).not.toBeNull();
  });
});
