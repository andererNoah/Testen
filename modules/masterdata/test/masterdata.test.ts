import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { ForbiddenError } from "@hv/access";
import { ConflictError, ValidationError, fromPgError } from "@hv/core";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";
import { seedScenario, type Scenario } from "@hv/access/test-support";
import {
  DuplicatePersonError,
  addPersonRole,
  createAsset,
  createBuilding,
  createCustomFieldDefinition,
  createMeter,
  createPerson,
  createProperty,
  createUnit,
  getCompleteness,
  getPerson,
  getPropertyOverview,
  getUnit,
  getUnitMeasureHistory,
  listDeadlines,
  listPersons,
  listProperties,
  measuresAsOf,
  mergePersons,
  setUnitMeasure,
  updateProperty,
} from "@hv/masterdata";
import { runAs } from "./helpers";

let t: TestDatabase;
let s: Scenario;
beforeAll(async () => {
  t = await createTestDatabase();
  s = await seedScenario(t.ownerDb);
});
afterAll(async () => {
  await t.destroy();
});

const admin = <T>(fn: Parameters<typeof runAs<T>>[3]) => runAs(t.appDb, s.a.tenantId, s.a.adminUserId, fn);
const manager = <T>(fn: Parameters<typeof runAs<T>>[3]) => runAs(t.appDb, s.a.tenantId, s.a.managerUserId, fn);

describe("Objekte und Einheiten", () => {
  it("Admin legt eine WEG mit Gebäude und Einheiten an", async () => {
    const result = await admin(async (ctx) => {
      const weg = await createProperty(ctx, { kind: "weg", code: "W100", name: "WEG Sonnenhof", street: "Sonnenweg", houseNumber: "3", postalCode: "04109", city: "Leipzig", state: "SN", meaDenominator: 1000 });
      const house = await createBuilding(ctx, weg.id, { name: "Haus A" });
      const u1 = await createUnit(ctx, weg.id, {
        buildingId: house.id,
        number: "WE 01",
        type: "apartment",
        measures: [
          { measure: "living_area", value: "62.5", validFrom: "2020-01-01" },
          { measure: "mea", value: "400", validFrom: "2020-01-01" },
        ],
      });
      const u2 = await createUnit(ctx, weg.id, { buildingId: house.id, number: "WE 02", type: "apartment", measures: [{ measure: "living_area", value: "80", validFrom: "2020-01-01" }, { measure: "mea", value: "600", validFrom: "2020-01-01" }] });
      return { weg, u1, u2 };
    });
    expect(result.weg.votingPrinciple).toBe("head");
    expect(result.u1.measures).toEqual({ living_area: "62.5000", mea: "400.0000" });
  });

  it("Objektnummern sind je Mandant eindeutig (verständliche Fehlermeldung)", async () => {
    const error = await admin((ctx) => createProperty(ctx, { kind: "rental", code: "P1", name: "Doppelt" })).catch((e) => e);
    const domain = fromPgError(error);
    expect(domain).toBeInstanceOf(ConflictError);
    expect(domain?.message).toBe("Diese Objektnummer ist bereits vergeben.");
  });

  it("Objektbetreuer darf keine Objekte anlegen und nur im eigenen Objekt Einheiten anlegen", async () => {
    await expect(manager((ctx) => createProperty(ctx, { kind: "rental", code: "X1", name: "Neu" }))).rejects.toThrow(ForbiddenError);
    await expect(manager((ctx) => createUnit(ctx, s.a.p2, { number: "WE 77", type: "apartment" }))).rejects.toThrow(ForbiddenError);
    const unit = await manager((ctx) => createUnit(ctx, s.a.p1, { number: "WE 77", type: "apartment" }));
    expect(unit.propertyId).toBe(s.a.p1);
  });

  it("Mietobjekte haben keine MEA", async () => {
    await expect(admin((ctx) => updateProperty(ctx, s.a.p1, { meaDenominator: 1000 }))).rejects.toThrow(ValidationError);
  });

  it("Liste filtert nach Suchbegriff", async () => {
    const found = await admin((ctx) => listProperties(ctx, { q: "sonnen" }));
    expect(found.map((p) => p.code)).toEqual(["W100"]);
  });
});

describe("Bitemporale Flächen (ADR-0006)", () => {
  it("korrigiert rückwirkend und bleibt reproduzierbar", async () => {
    const unitId = s.a.u2;
    await admin((ctx) => setUnitMeasure(ctx, unitId, { measure: "living_area", value: "70", validFrom: "2020-01-01" }));
    const beforeCorrection = new Date();
    await new Promise((r) => setTimeout(r, 20));
    // Korrektur ab 2024
    await admin((ctx) => setUnitMeasure(ctx, unitId, { measure: "living_area", value: "72.15", validFrom: "2024-01-01" }));
    // Korrektur nur für 2022
    await admin((ctx) => setUnitMeasure(ctx, unitId, { measure: "living_area", value: "69", validFrom: "2022-01-01", validTo: "2023-01-01" }));

    const at = (date: string, knownAt?: Date) => admin(async (ctx) => (await measuresAsOf(ctx.trx, [unitId], date, knownAt)).get(unitId)?.living_area);
    expect(await at("2021-06-30")).toBe("70.0000");
    expect(await at("2022-06-30")).toBe("69.0000");
    expect(await at("2023-06-30")).toBe("70.0000");
    expect(await at("2025-06-30")).toBe("72.1500");
    // Wissensstand vor der Korrektur
    expect(await at("2025-06-30", beforeCorrection)).toBe("70.0000");

    const unit = await admin((ctx) => getUnit(ctx, unitId, "2022-03-01"));
    expect(unit.measures.living_area).toBe("69.0000");

    const history = await admin((ctx) => getUnitMeasureHistory(ctx, unitId, "living_area"));
    const current = history.filter((h) => h.supersededAt === null).map((h) => [h.validFrom, h.validTo, h.value]);
    expect(current).toEqual([
      ["2020-01-01", "2022-01-01", "70.0000"],
      ["2022-01-01", "2023-01-01", "69.0000"],
      ["2023-01-01", "2024-01-01", "70.0000"],
      ["2024-01-01", null, "72.1500"],
    ]);
    expect(history.some((h) => h.supersededAt !== null)).toBe(true);
  });

  it("die Datenbank verhindert überlappende aktuelle Werte", async () => {
    const error = await t.ownerDb
      .insertInto("unit_measures")
      .values({ tenant_id: s.a.tenantId, property_id: s.a.p1, unit_id: s.a.u2, measure: "living_area", value: "1", valid_from: "2025-01-01" })
      .execute()
      .catch((e) => e);
    expect(fromPgError(error)?.message).toBe("Für diesen Zeitraum ist bereits ein Wert erfasst.");
  });

  it("lehnt ein Ende vor dem Beginn ab", async () => {
    await expect(admin((ctx) => setUnitMeasure(ctx, s.a.u2, { measure: "persons", value: "2", validFrom: "2025-01-01", validTo: "2024-01-01" }))).rejects.toThrow(ValidationError);
  });
});

describe("Personen-CRM und Dublettenprüfung (V29)", () => {
  it("erkennt ähnlich klingende Namen mit gleichem Geburtsdatum", async () => {
    await admin((ctx) => createPerson(ctx, { kind: "natural", firstName: "Hans", lastName: "Maier", birthDate: "1970-05-01", email: "hans.maier@example.org" }));
    const error = await admin((ctx) => createPerson(ctx, { kind: "natural", firstName: "Hans", lastName: "Meyer", birthDate: "1970-05-01" })).catch((e) => e);
    expect(error).toBeInstanceOf(DuplicatePersonError);
    expect(error.candidates[0].reasons).toEqual(expect.arrayContaining(["ähnlich klingender Name", "gleiches Geburtsdatum"]));
  });

  it("erkennt gleiche E-Mail-Adressen und erlaubt bewusstes Neuanlegen", async () => {
    await expect(admin((ctx) => createPerson(ctx, { kind: "natural", lastName: "Anders", email: "HANS.MAIER@example.org" }))).rejects.toThrow(DuplicatePersonError);
    const person = await admin((ctx) => createPerson(ctx, { kind: "natural", lastName: "Anders", email: "hans.maier@example.org", ignoreDuplicates: true }));
    expect(person.displayName).toBe("Anders");
  });

  it("führt Personen mit Historie zusammen", async () => {
    const { a, b } = await admin(async (ctx) => {
      const a = await createPerson(ctx, { kind: "natural", firstName: "Greta", lastName: "Gans", ignoreDuplicates: true });
      const b = await createPerson(ctx, { kind: "natural", firstName: "Greta", lastName: "Ganz", phone: "0341 123", ignoreDuplicates: true });
      await addPersonRole(ctx, b.id, { role: "mieter", propertyId: s.a.p1, unitId: s.a.u2, validFrom: "2024-01-01" });
      return { a, b };
    });
    const merged = await admin((ctx) => mergePersons(ctx, b.id, a.id));
    expect(merged.roles.map((r) => r.role)).toEqual(["mieter"]);
    expect(merged.phone).toBe("0341 123");
    const listed = await admin((ctx) => listPersons(ctx, { q: "Ganz" }));
    expect(listed).toEqual([]);
  });

  it("Personenrolle muss zur Einheit des Objekts passen", async () => {
    await expect(
      admin(async (ctx) => {
        const p = await createPerson(ctx, { kind: "legal", companyName: "Dach & Rinne GmbH" });
        return addPersonRole(ctx, p.id, { role: "eigentuemer", propertyId: s.a.p1, unitId: s.a.u3 });
      }),
    ).rejects.toThrow(ValidationError);
  });

  it("protokolliert Lesezugriffe auf Personendaten", async () => {
    await admin((ctx) => getPerson(ctx, s.a.renterPersonId));
    const entries = await t.ownerDb.selectFrom("access_log").selectAll().where("entity_id", "=", s.a.renterPersonId).execute();
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]).toMatchObject({ user_id: s.a.adminUserId, action: "read", entity_type: "person" });
  });

  it("Objektbetreuer findet nur Personen seiner Objekte", async () => {
    const ids = (await manager((ctx) => listPersons(ctx))).map((p) => p.id);
    expect(ids).toEqual(expect.arrayContaining([s.a.renterPersonId, s.a.ownerU1PersonId]));
    expect(ids).not.toContain(s.a.ownerU3PersonId);
  });
});

describe("Eigene Felder (V18)", () => {
  it("werden validiert und gespeichert", async () => {
    await admin((ctx) => createCustomFieldDefinition(ctx, { entityType: "property", key: "hausmeister", label: "Hausmeisterdienst", fieldType: "select", options: ["intern", "extern"] }));
    const updated = await admin((ctx) => updateProperty(ctx, s.a.p1, { customFields: { hausmeister: "extern" } }));
    expect(updated.customFields).toEqual({ hausmeister: "extern" });
    const error = await admin((ctx) => updateProperty(ctx, s.a.p1, { customFields: { hausmeister: "keiner", unbekannt: 1 } })).catch((e) => e);
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.issues.map((i: { path: string }) => i.path).sort()).toEqual(["customFields.hausmeister", "customFields.unbekannt"]);
  });
});

describe("Vollständigkeitsampel, Fristen und 360°-Ansicht", () => {
  it("bewertet eine WEG und zeigt Lücken", async () => {
    const weg = (await admin((ctx) => listProperties(ctx, { q: "Sonnenhof" })))[0]!;
    const c = await admin((ctx) => getCompleteness(ctx, weg.id));
    const byKey = Object.fromEntries(c.checks.map((x) => [x.key, x]));
    expect(byKey.address!.ok).toBe(true);
    expect(byKey.mea_sum!.ok).toBe(true);
    expect(byKey.owners!.ok).toBe(false);
    expect(c.trafficLight).toBe("red");
  });

  it("leitet Fristen aus Anlagen und Zählern ab", async () => {
    await admin(async (ctx) => {
      await createAsset(ctx, s.a.p1, { kind: "drinking_water", name: "Warmwasserspeicher 500 l", lastInspectionOn: "2023-11-02", attributes: { largeSystem: true } });
      await createAsset(ctx, s.a.p1, { kind: "smoke_detectors", name: "Rauchwarnmelder", lastInspectionOn: "2025-12-01" });
      await createMeter(ctx, s.a.p1, { kind: "heat", serialNumber: "WMZ-1", unitId: s.a.u1, remoteReadable: false, calibrationYear: 2021 });
    });
    const deadlines = await admin((ctx) => listDeadlines(ctx, { propertyId: s.a.p1 }));
    const kinds = deadlines.map((d) => `${d.kind}:${d.dueDate}:${d.status}`);
    expect(kinds).toEqual(
      expect.arrayContaining([
        "operating_cost_statement:2026-12-31:warn",
        "legionella_test:2026-11-02:critical",
        "smoke_detector_maintenance:2026-12-01:warn", // Vorwarnung 2 Monate
        "meter_remote_retrofit:2026-12-31:warn",
        "meter_calibration:2026-12-31:warn",
      ]),
    );
    expect(deadlines.every((d) => d.rule.sources.length > 0)).toBe(true);
  });

  it("Heizung ohne Energieträger wird abgelehnt", async () => {
    await expect(admin((ctx) => createAsset(ctx, s.a.p1, { kind: "heating", name: "Kessel" }))).rejects.toThrow(ValidationError);
  });

  it("360°-Ansicht bündelt Objekt, Einheiten mit Bewohnern, Technik, Fristen und Ampel", async () => {
    const o = await admin((ctx) => getPropertyOverview(ctx, s.a.p1));
    expect(o.property.id).toBe(s.a.p1);
    const u1 = o.units.find((u) => u.id === s.a.u1)!;
    expect(u1.occupants.map((x) => x.role).sort()).toEqual(["eigentuemer", "mieter"]);
    expect(o.meters).toHaveLength(1);
    expect(o.deadlines.length).toBeGreaterThan(0);
    expect(o.completeness.checks.length).toBeGreaterThan(3);
  });

  it("Mieter sieht keine Fristen und keine Bewohner anderer Einheiten", async () => {
    const o = await runAs(t.appDb, s.a.tenantId, s.a.renterUserId, (ctx) => getPropertyOverview(ctx, s.a.p1));
    expect(o.units.map((u) => u.id)).toEqual([s.a.u1]);
    expect(o.deadlines).toEqual([]);
    expect(o.units[0]!.occupants).toEqual([]);
  });
});
