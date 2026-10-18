import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql, withTenant, type Db } from "@hv/db";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";
import { can, loadPrincipal, requirePermission, ForbiddenError, assignRole } from "@hv/access";
import { seedScenario, type Scenario } from "@hv/access/test-support";

let t: TestDatabase;
let s: Scenario;

beforeAll(async () => {
  t = await createTestDatabase();
  s = await seedScenario(t.ownerDb);
});
afterAll(async () => {
  await t.destroy();
});

const as = <T>(db: Db, tenantId: string, userId: string, fn: Parameters<typeof withTenant<T>>[2]) => withTenant(db, { tenantId, userId }, fn);
const ids = (rows: { id: string }[]) => rows.map((r) => r.id).sort();

describe("Abnahmetest Phase 0: Rechte greifen objektgenau (drei Rollen)", () => {
  it("Mandanten-Admin sieht alle Objekte, Einheiten und Personen des Mandanten", async () => {
    await as(t.appDb, s.a.tenantId, s.a.adminUserId, async (trx) => {
      expect(ids(await trx.selectFrom("properties").select("id").execute())).toEqual([s.a.p1, s.a.p2].sort());
      expect(ids(await trx.selectFrom("units").select("id").execute())).toEqual([s.a.u1, s.a.u2, s.a.u3].sort());
      expect((await trx.selectFrom("persons").select("id").execute()).length).toBe(3);
    });
  });

  it("Objektbetreuer sieht nur sein Objekt, dessen Einheiten und dort beteiligte Personen", async () => {
    await as(t.appDb, s.a.tenantId, s.a.managerUserId, async (trx) => {
      expect(ids(await trx.selectFrom("properties").select("id").execute())).toEqual([s.a.p1]);
      expect(ids(await trx.selectFrom("units").select("id").execute())).toEqual([s.a.u1, s.a.u2].sort());
      expect(ids(await trx.selectFrom("persons").select("id").execute())).toEqual([s.a.renterPersonId, s.a.ownerU1PersonId].sort());
      expect((await trx.selectFrom("person_roles").select("id").execute()).length).toBe(2);
    });
  });

  it("Objektbetreuer darf im eigenen Objekt schreiben, im fremden nicht", async () => {
    await as(t.appDb, s.a.tenantId, s.a.managerUserId, async (trx) => {
      const own = await trx.updateTable("properties").set({ city: "Leipzig" }).where("id", "=", s.a.p1).executeTakeFirst();
      expect(own.numUpdatedRows).toBe(1n);
      const foreign = await trx.updateTable("properties").set({ city: "Dresden" }).where("id", "=", s.a.p2).executeTakeFirst();
      expect(foreign.numUpdatedRows).toBe(0n);
    });
    await expect(
      as(t.appDb, s.a.tenantId, s.a.managerUserId, (trx) =>
        trx.insertInto("units").values({ tenant_id: s.a.tenantId, property_id: s.a.p2, number: "WE 99", type: "apartment" }).execute(),
      ),
    ).rejects.toThrow(/row-level security/);
    await expect(
      as(t.appDb, s.a.tenantId, s.a.managerUserId, (trx) =>
        trx.insertInto("properties").values({ tenant_id: s.a.tenantId, kind: "rental", code: "P9", name: "Neu" }).execute(),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("Mieter sieht nur die eigene Einheit, das Objekt und die eigene Person", async () => {
    await as(t.appDb, s.a.tenantId, s.a.renterUserId, async (trx) => {
      expect(ids(await trx.selectFrom("properties").select("id").execute())).toEqual([s.a.p1]);
      expect(ids(await trx.selectFrom("units").select("id").execute())).toEqual([s.a.u1]);
      expect(ids(await trx.selectFrom("persons").select("id").execute())).toEqual([s.a.renterPersonId]);
      expect((await trx.selectFrom("person_roles").select("person_id").execute()).map((r) => r.person_id)).toEqual([s.a.renterPersonId]);
      const update = await trx.updateTable("units").set({ floor: "EG" }).where("id", "=", s.a.u1).executeTakeFirst();
      expect(update.numUpdatedRows).toBe(0n);
      expect(await trx.selectFrom("users").select("id").execute()).toEqual([{ id: s.a.renterUserId }]);
    });
  });

  it("anderer Mandant sieht nichts und kann nicht in fremde Mandanten schreiben", async () => {
    await as(t.appDb, s.b.tenantId, s.b.adminUserId, async (trx) => {
      expect(ids(await trx.selectFrom("properties").select("id").execute())).toEqual([s.b.q1]);
      expect(await trx.selectFrom("units").select("id").execute()).toEqual([]);
      expect(await trx.selectFrom("persons").select("id").execute()).toEqual([]);
    });
    await expect(
      as(t.appDb, s.b.tenantId, s.b.adminUserId, (trx) =>
        trx.insertInto("units").values({ tenant_id: s.a.tenantId, property_id: s.a.p1, number: "X", type: "apartment" }).execute(),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("ein Benutzer kann sich nicht als anderer Mandant ausgeben", async () => {
    // Benutzer aus A mit Mandanten-Kontext B: keine Zuweisung in B → nichts sichtbar
    await as(t.appDb, s.b.tenantId, s.a.adminUserId, async (trx) => {
      expect(await trx.selectFrom("properties").select("id").execute()).toEqual([]);
    });
  });

  it("abgelaufene Zuweisungen und gesperrte Benutzer verlieren den Zugriff sofort", async () => {
    await t.ownerDb.updateTable("role_assignments").set({ valid_from: "2020-01-01", valid_to: "2021-01-01" }).where("user_id", "=", s.a.managerUserId).execute();
    await as(t.appDb, s.a.tenantId, s.a.managerUserId, async (trx) => {
      expect(await trx.selectFrom("properties").select("id").execute()).toEqual([]);
    });
    await t.ownerDb.updateTable("role_assignments").set({ valid_from: "2020-01-01", valid_to: null }).where("user_id", "=", s.a.managerUserId).execute();
    await t.ownerDb.updateTable("users").set({ status: "disabled" }).where("id", "=", s.a.managerUserId).execute();
    await as(t.appDb, s.a.tenantId, s.a.managerUserId, async (trx) => {
      expect(await trx.selectFrom("properties").select("id").execute()).toEqual([]);
    });
    await t.ownerDb.updateTable("users").set({ status: "active" }).where("id", "=", s.a.managerUserId).execute();
  });

  it("der Kontext gilt nur innerhalb der Transaktion", async () => {
    await as(t.appDb, s.a.tenantId, s.a.adminUserId, async (trx) => {
      expect((await trx.selectFrom("properties").select("id").execute()).length).toBe(2);
    });
    const { rows } = await sql<{ tenant: string | null }>`SELECT current_setting('app.tenant_id', true) AS tenant`.execute(t.appDb);
    expect(rows[0]?.tenant ?? "").toBe("");
    expect(await t.appDb.selectFrom("properties").select("id").execute()).toEqual([]);
  });

  it("Rollenzuweisungen müssen auf Objekte des eigenen Mandanten zeigen", async () => {
    await expect(
      as(t.appDb, s.a.tenantId, s.a.adminUserId, (trx) =>
        assignRole(trx, s.a.tenantId, { userId: s.a.managerUserId, roleKey: "property_manager", scopeType: "property", scopeId: s.b.q1 }),
      ),
    ).rejects.toThrow(/gehört nicht zum Mandanten/);
  });
});

describe("Anwendungsrechte (Schicht 2)", () => {
  it("prüft Berechtigung und Bereich", async () => {
    const manager = await as(t.appDb, s.a.tenantId, s.a.managerUserId, (trx) => loadPrincipal(trx, s.a.managerUserId));
    expect(can(manager, "masterdata.write", { propertyId: s.a.p1 })).toBe(true);
    expect(can(manager, "masterdata.write", { propertyId: s.a.p2 })).toBe(false);
    expect(can(manager, "audit.read")).toBe(false);
    expect(() => requirePermission(manager, "tenant.admin")).toThrow(ForbiddenError);

    const renter = await as(t.appDb, s.a.tenantId, s.a.renterUserId, (trx) => loadPrincipal(trx, s.a.renterUserId));
    expect(renter.personId).toBe(s.a.renterPersonId);
    expect(can(renter, "masterdata.read", { propertyId: s.a.p1, unitId: s.a.u1 })).toBe(true);
    expect(can(renter, "masterdata.read", { propertyId: s.a.p1, unitId: s.a.u2 })).toBe(false);
    expect(can(renter, "masterdata.read", { propertyId: s.a.p1 })).toBe(true);
    expect(can(renter, "masterdata.write", { propertyId: s.a.p1, unitId: s.a.u1 })).toBe(false);

    const admin = await as(t.appDb, s.a.tenantId, s.a.adminUserId, (trx) => loadPrincipal(trx, s.a.adminUserId));
    expect(can(admin, "audit.read")).toBe(true);
    expect(can(admin, "masterdata.write", { propertyId: s.a.p2 })).toBe(true);
  });
});
