import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError, loadPrincipal } from "@hv/access";
import { withTenant } from "@hv/db";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";
import { seedScenario, type Scenario } from "@hv/access/test-support";
import { commitImportJob, createImportJob, updateImportMapping, validateImportJob, type UploadedFile } from "@hv/importer";
import { listDeadlines, listProperties, type Ctx } from "@hv/masterdata";

const DEMO_DIR = path.resolve(import.meta.dirname, "../../../demo/import");

let t: TestDatabase;
let s: Scenario;
beforeAll(async () => {
  t = await createTestDatabase();
  s = await seedScenario(t.ownerDb);
});
afterAll(async () => {
  await t.destroy();
});

async function demoCsvFiles(): Promise<UploadedFile[]> {
  const names = (await readdir(DEMO_DIR)).filter((f) => f.endsWith(".csv"));
  return Promise.all(names.map(async (filename) => ({ filename, data: await readFile(path.join(DEMO_DIR, filename)) })));
}

function as<T>(userId: string, fn: (ctx: Ctx) => Promise<T>, actorKind: "user" | "import" = "user") {
  return withTenant(t.appDb, { tenantId: s.a.tenantId, userId, actorKind }, async (trx) => fn({ trx, principal: await loadPrincipal(trx, userId), today: "2026-10-18" }));
}

async function fullImport(files: UploadedFile[]) {
  const job = await as(s.a.adminUserId, (ctx) => createImportJob(ctx, files, { source: "Demo" }));
  const validated = await as(s.a.adminUserId, (ctx) => validateImportJob(ctx, job.id));
  return { job, validated };
}

describe("Abnahmetest Phase 0: Demo-Mandant wird aus CSV/XLSX ohne Fehler importiert", () => {
  it("erkennt alle sieben Tabellen und ordnet alle Spalten zu", async () => {
    const files = await demoCsvFiles();
    const job = await as(s.a.adminUserId, (ctx) => createImportJob(ctx, files));
    expect(job.sheets.map((x) => x.entity).sort()).toEqual(["assets", "buildings", "meters", "persons", "properties", "roles", "units"]);
    for (const sheet of job.sheets) expect(Object.values(sheet.columns).every((f) => f !== null), sheet.name).toBe(true);
  });

  it("Probeimport ohne Fehler, ohne Daten zu schreiben, dann Übernahme", async () => {
    const { job, validated } = await fullImport(await demoCsvFiles());
    expect(validated.report!.errors, JSON.stringify(validated.report!.issues.filter((i) => i.severity === "error"), null, 2)).toBe(0);
    expect(validated.status).toBe("validated");
    expect(validated.report!.counts.properties.created).toBe(4);
    // Probeimport hat nichts geschrieben
    const before = await as(s.a.adminUserId, (ctx) => listProperties(ctx));
    expect(before.map((p) => p.code)).not.toContain("W001");

    const committed = await as(s.a.adminUserId, (ctx) => commitImportJob(ctx, job.id), "import");
    expect(committed.status).toBe("committed");
    const c = committed.summary!.counts;
    expect(c.properties.created).toBe(4);
    expect(c.buildings.created).toBe(4);
    expect(c.units.created).toBe(22);
    expect(c.persons.created).toBe(25);
    expect(c.roles.created).toBe(32);
    expect(c.assets.created).toBe(10);
    expect(c.meters.created).toBe(35);
    expect(Object.values(c).every((x) => x.failed === 0)).toBe(true);
  });

  it("Änderungen stehen im Audit-Log als Import", async () => {
    const rows = await t.ownerDb.selectFrom("audit_log").select(["actor_kind", "actor_user_id"]).where("table_name", "=", "units").where("tenant_id", "=", s.a.tenantId).where("action", "=", "insert").execute();
    const imported = rows.filter((r) => r.actor_kind === "import");
    expect(imported.length).toBe(22);
    expect(imported.every((r) => r.actor_user_id === s.a.adminUserId)).toBe(true);
  });

  it("SEV-Einheiten sind mit den WEG-Einheiten verknüpft", async () => {
    const rows = await t.ownerDb
      .selectFrom("units as sev")
      .innerJoin("units as weg", "weg.id", "sev.linked_unit_id")
      .select(["sev.number as sev", "weg.number as weg"])
      .orderBy("sev.number")
      .execute();
    expect(rows).toEqual([
      { sev: "SEV TG 01", weg: "TG 01" },
      { sev: "SEV WE 02", weg: "WE 02" },
    ]);
  });

  it("aus den importierten Daten entstehen Fristen", async () => {
    const deadlines = await as(s.a.adminUserId, (ctx) => listDeadlines(ctx));
    const kinds = new Set(deadlines.map((d) => d.kind));
    expect(kinds).toEqual(new Set(["operating_cost_statement", "legionella_test", "smoke_detector_maintenance", "meter_remote_retrofit", "meter_interoperability", "meter_calibration"]));
  });

  it("ein zweiter Import derselben Dateien ändert nichts (Parallelbetrieb, idempotent)", async () => {
    const { validated } = await fullImport(await demoCsvFiles());
    const c = validated.report!.counts;
    for (const [entity, counts] of Object.entries(c)) {
      expect(counts.created, entity).toBe(0);
      expect(counts.updated, entity).toBe(0);
      expect(counts.failed, entity).toBe(0);
    }
  });

  it("dieselben Daten als XLSX: ebenfalls fehlerfrei und unverändert", async () => {
    const { validated } = await fullImport([{ filename: "demo-mandant.xlsx", data: await readFile(path.join(DEMO_DIR, "demo-mandant.xlsx")) }]);
    expect(validated.report!.errors).toBe(0);
    expect(validated.sheets).toHaveLength(7);
    expect(Object.values(validated.report!.counts).every((x) => x.created === 0 && x.updated === 0)).toBe(true);
  });

  it("geänderte Werte werden als Änderung übernommen", async () => {
    const files = await demoCsvFiles();
    const units = files.find((f) => f.filename === "einheiten.csv")!;
    units.data = Buffer.from(units.data.toString("utf8").replace("W001;WE 01;Vorderhaus;Wohnung;EG;links;68,40", "W001;WE 01;Vorderhaus;Wohnung;EG;links;68,90"));
    const { job, validated } = await fullImport(files);
    expect(validated.report!.counts.units).toMatchObject({ updated: 1, created: 0 });
    await as(s.a.adminUserId, (ctx) => commitImportJob(ctx, job.id), "import");
  });
});

describe("Fehlerbericht", () => {
  it("meldet Fehler mit Tabelle, Zeile und Spalte", async () => {
    const csv = ["Objektnummer;Einheit;Typ;Wohnfläche;Gültig ab", "W001;WE 99;Wohnung;viel;01.01.2026", "X999;WE 01;Wohnung;50;01.01.2026", "W001;WE 98;Wohnung;50;31.02.2026"].join("\n");
    const { validated } = await fullImport([{ filename: "einheiten.csv", data: Buffer.from(csv) }]);
    expect(validated.status).toBe("analyzed");
    const errors = validated.report!.issues.filter((i) => i.severity === "error");
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ sheet: "einheiten.csv", row: 2, column: "Wohnfläche", message: "„viel“ ist keine Zahl" }),
        expect.objectContaining({ sheet: "einheiten.csv", row: 3, message: expect.stringContaining("Objekt „X999“") }),
        expect.objectContaining({ sheet: "einheiten.csv", row: 4, column: "Gültig ab" }),
      ]),
    );
  });

  it("fehlerhafte Importe lassen sich nicht übernehmen", async () => {
    const { job } = await fullImport([{ filename: "objekte.csv", data: Buffer.from("Objektnummer;Art;Name\nZ1;Hotel;Grand\n") }]);
    await expect(as(s.a.adminUserId, (ctx) => commitImportJob(ctx, job.id))).rejects.toThrow(/zuerst prüfen/);
  });

  it("Mapping lässt sich korrigieren", async () => {
    const job = await as(s.a.adminUserId, (ctx) => createImportJob(ctx, [{ filename: "liste.csv", data: Buffer.from("Kennung;Titel;Sorte\nZ2;Haus Z;Miete\n") }]));
    expect(job.sheets[0]!.entity).toBeNull();
    const updated = await as(s.a.adminUserId, (ctx) =>
      updateImportMapping(ctx, job.id, [{ sheet: "liste.csv", entity: "properties", columns: { Kennung: "code", Titel: "name", Sorte: "kind" } }]),
    );
    expect(updated.sheets[0]!.entity).toBe("properties");
    const validated = await as(s.a.adminUserId, (ctx) => validateImportJob(ctx, job.id));
    expect(validated.report!.ok).toBe(true);
    await expect(as(s.a.adminUserId, (ctx) => updateImportMapping(ctx, job.id, [{ sheet: "liste.csv", entity: "properties", columns: { Kennung: "gibtsnicht" } }]))).rejects.toThrow(/ungültig/);
  });

  it("ohne Importrecht: verboten", async () => {
    await expect(as(s.a.renterUserId, (ctx) => createImportJob(ctx, [{ filename: "a.csv", data: Buffer.from("a\n1") }]))).rejects.toThrow(ForbiddenError);
  });
});
