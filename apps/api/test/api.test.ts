import type { FastifyInstance } from "fastify";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";
import { seedScenario, type Scenario } from "@hv/access/test-support";
import { syncRuleCatalog } from "../src/rules-sync";
import { buildTestApp, client } from "./helpers";

let t: TestDatabase;
let s: Scenario;
let app: FastifyInstance;
let admin: ReturnType<typeof client>;
let manager: ReturnType<typeof client>;
let renter: ReturnType<typeof client>;

beforeAll(async () => {
  t = await createTestDatabase();
  s = await seedScenario(t.ownerDb);
  const built = await buildTestApp(t);
  app = built.app;
  admin = client(app, await built.token(s.a.adminUserId, s.a.tenantId));
  manager = client(app, await built.token(s.a.managerUserId, s.a.tenantId));
  renter = client(app, await built.token(s.a.renterUserId, s.a.tenantId));
});
afterAll(async () => {
  await app.close();
  await t.destroy();
});

describe("System und Anmeldung", () => {
  it("Health ist öffentlich", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok", database: "ok" });
    expect(res.headers["x-request-id"]).toBeTruthy();
  });

  it("ohne Token: 401 als problem+json mit verständlicher Meldung (V12)", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/me" });
    expect(res.statusCode).toBe(401);
    expect(res.headers["content-type"]).toContain("application/problem+json");
    expect(res.json()).toMatchObject({ status: 401, code: "unauthenticated", detail: expect.stringContaining("melden Sie sich erneut an") });
  });

  it("gefälschte Tokens werden abgelehnt", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/me", headers: { authorization: "Bearer eyJhbGciOiJIUzI1NiJ9.e30.x" } });
    expect(res.statusCode).toBe(401);
  });

  it("/me liefert Mandant, Zuweisungen und Rechte", async () => {
    const res = await manager.get("/v1/me");
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.tenant.id).toBe(s.a.tenantId);
    expect(body.assignments).toEqual([{ roleKey: "property_manager", roleName: "Objektbetreuer", scopeType: "property", scopeId: s.a.p1 }]);
    expect(body.permissions).toContain("masterdata.write");
    expect(body.hasTenantScope).toBe(false);
  });

  it("Entwicklungs-Login stellt ein Token aus", async () => {
    const users = (await app.inject({ method: "GET", url: "/v1/dev/users" })).json().items;
    const mia = users.find((u: { displayName: string }) => u.displayName === "Mia Mieterin");
    const login = await app.inject({ method: "POST", url: "/v1/dev/login", payload: { email: mia.email, tenantSlug: mia.tenantSlug } });
    expect(login.statusCode).toBe(200);
    const me = await client(app, login.json().token).get("/v1/me");
    expect(me.json().user.personId).toBe(s.a.renterPersonId);
  });

  it("unbekannte Adressen: 404 problem+json", async () => {
    const res = await admin.get("/v1/gibt-es-nicht");
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("route_not_found");
  });

  it("OpenAPI-Spezifikation ist öffentlich und vollständig", async () => {
    const res = await app.inject({ method: "GET", url: "/v1/openapi.json" });
    expect(res.statusCode).toBe(200);
    const spec = res.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toEqual(expect.arrayContaining(["/v1/properties", "/v1/properties/{id}/overview", "/v1/persons", "/v1/rules", "/v1/deadlines", "/v1/audit"]));
    const docs = await app.inject({ method: "GET", url: "/v1/docs/" });
    expect(docs.statusCode).toBe(200);
  });
});

describe("Stammdaten über die API", () => {
  let wegId: string;

  it("legt ein Objekt an (201) und liest es wieder", async () => {
    const res = await admin.post("/v1/properties", { kind: "weg", code: "W1", name: "WEG Am Markt", postalCode: "04109", city: "Leipzig", state: "SN", meaDenominator: 1000 });
    expect(res.statusCode).toBe(201);
    wegId = res.json().id;
    expect((await admin.get(`/v1/properties/${wegId}`)).json().name).toBe("WEG Am Markt");
  });

  it("422 mit Feldhinweisen bei ungültigen Eingaben", async () => {
    const res = await admin.post("/v1/properties", { kind: "weg", code: "", name: "X", postalCode: "123" });
    expect(res.statusCode).toBe(422);
    const body = res.json();
    expect(body.code).toBe("validation_failed");
    expect(body.issues.map((i: { path: string }) => i.path)).toEqual(expect.arrayContaining(["code", "postalCode"]));
    expect(body.issues.find((i: { path: string }) => i.path === "postalCode").message).toBe("Postleitzahl hat fünf Ziffern");
  });

  it("409 bei doppelter Objektnummer", async () => {
    const res = await admin.post("/v1/properties", { kind: "rental", code: "W1", name: "Doppelt" });
    expect(res.statusCode).toBe(409);
    expect(res.json().detail).toBe("Diese Objektnummer ist bereits vergeben.");
  });

  it("403 für Objektbetreuer beim Anlegen eines Objekts", async () => {
    const res = await manager.post("/v1/properties", { kind: "rental", code: "M1", name: "Nicht erlaubt" });
    expect(res.statusCode).toBe(403);
    expect(res.json().detail).toContain("Berechtigung");
  });

  it("Einheit mit Flächen anlegen, rückwirkend korrigieren, Historie lesen", async () => {
    const unit = await admin.post(`/v1/properties/${wegId}/units`, {
      number: "WE 01",
      type: "apartment",
      measures: [
        { measure: "living_area", value: "55,5", validFrom: "2021-01-01" },
        { measure: "mea", value: 1000, validFrom: "2021-01-01" },
      ],
    });
    expect(unit.statusCode).toBe(201);
    const unitId = unit.json().id;
    expect(unit.json().measures.living_area).toBe("55.5000");
    const corrected = await admin.post(`/v1/units/${unitId}/measures`, { measure: "living_area", value: "57.25", validFrom: "2023-01-01" });
    expect(corrected.json().measures.living_area).toBe("57.2500");
    expect((await admin.get(`/v1/units/${unitId}?asOf=2022-06-01`)).json().measures.living_area).toBe("55.5000");
    const history = (await admin.get(`/v1/units/${unitId}/measures?measure=living_area`)).json().items;
    expect(history.length).toBe(3);
  });

  it("Mieter sieht nur die eigene Einheit; fremde Objekte sind 403", async () => {
    const units = (await renter.get(`/v1/properties/${s.a.p1}/units`)).json().items;
    expect(units.map((u: { id: string }) => u.id)).toEqual([s.a.u1]);
    expect((await renter.get(`/v1/properties/${s.a.p2}`)).statusCode).toBe(403);
    expect((await manager.get(`/v1/properties/${wegId}`)).statusCode).toBe(403);
  });

  it("360°-Ansicht und Vollständigkeitsampel", async () => {
    const overview = await admin.get(`/v1/properties/${wegId}/overview`);
    expect(overview.statusCode).toBe(200);
    expect(overview.json().totals).toMatchObject({ units: 1, meaSum: "1000" });
    const completeness = (await admin.get(`/v1/properties/${wegId}/completeness`)).json();
    expect(completeness.checks.find((c: { key: string }) => c.key === "mea_sum").ok).toBe(true);
  });
});

describe("Personen über die API", () => {
  it("409 mit Dubletten-Vorschlägen, dann bewusst neu anlegen", async () => {
    expect((await admin.post("/v1/persons", { kind: "natural", firstName: "Karl", lastName: "Schmidt", email: "karl@example.org" })).statusCode).toBe(201);
    const dup = await admin.post("/v1/persons", { kind: "natural", firstName: "Karl", lastName: "Schmitt", email: "karl@example.org" });
    expect(dup.statusCode).toBe(409);
    expect(dup.json().candidates[0].reasons).toContain("gleiche E-Mail-Adresse");
    const forced = await admin.post("/v1/persons", { kind: "natural", firstName: "Karl", lastName: "Schmitt", email: "karl@example.org", ignoreDuplicates: true });
    expect(forced.statusCode).toBe(201);
  });

  it("ungültige IBAN wird mit Prüfziffer-Hinweis abgelehnt", async () => {
    const res = await admin.post("/v1/persons", { kind: "natural", lastName: "Iban", iban: "DE89370400440532013001" });
    expect(res.statusCode).toBe(422);
    expect(res.json().issues[0]).toEqual({ path: "iban", message: "IBAN ist ungültig (Prüfziffer)" });
  });
});

describe("Regeln, Fristen, Audit", () => {
  it("Regelkatalog zum Stichtag mit Quellen", async () => {
    const items = (await admin.get("/v1/rules?asOf=2026-10-18")).json().items;
    const frist = items.find((r: { key: string }) => r.key === "bgb.556.abrechnungsfrist");
    expect(frist.current.sources[0].url).toContain("gesetze-im-internet.de");
    const gmodg = (await admin.get("/v1/rules/gmodg.neue_fossile_heizung?asOf=2028-02-01")).json();
    expect(gmodg.current.version).toBe("2028-01");
    expect((await admin.get("/v1/rules/gibt.es.nicht")).statusCode).toBe(404);
    expect((await admin.get("/v1/rules/changelog")).json().items.length).toBeGreaterThan(0);
  });

  it("Regelkatalog wird in die Datenbank gespiegelt", async () => {
    const result = await syncRuleCatalog(t.ownerDb);
    expect(result.rules).toBeGreaterThan(20);
    const count = await t.appDb.selectFrom("legal_rule_versions").select((eb) => eb.fn.countAll<number>().as("n")).executeTakeFirstOrThrow();
    expect(Number(count.n)).toBe(result.versions);
  });

  it("Fristen dringendste zuerst", async () => {
    const res = await admin.get("/v1/deadlines");
    expect(res.statusCode).toBe(200);
    const items = res.json().items;
    expect(items.length).toBeGreaterThan(0);
    expect(items[0].rule.sources.length).toBeGreaterThan(0);
  });

  it("Audit-Log: Admin ja, Objektbetreuer nein; Seiten über beforeId", async () => {
    const page = (await admin.get("/v1/audit?limit=2")).json();
    expect(page.items).toHaveLength(2);
    expect(page.nextBeforeId).toBe(page.items[1].id);
    const next = (await admin.get(`/v1/audit?limit=2&beforeId=${page.nextBeforeId}`)).json();
    expect(next.items[0].id).toBeLessThan(page.items[1].id);
    expect((await manager.get("/v1/audit")).statusCode).toBe(403);
  });
});
