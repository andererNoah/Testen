import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { sql, withTenant } from "@hv/db";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";
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

describe("Abnahmetest Phase 0: jede Änderung steht im Audit-Log", () => {
  it("protokolliert Anlage, Änderung und Löschung mit Benutzer, Feldern und Anfrage-ID", async () => {
    const ctx = { tenantId: s.a.tenantId, userId: s.a.managerUserId, requestId: "req-123" };
    const unitId = await withTenant(t.appDb, ctx, async (trx) => {
      const unit = await trx.insertInto("units").values({ tenant_id: s.a.tenantId, property_id: s.a.p1, number: "WE 10", type: "apartment" }).returning("id").executeTakeFirstOrThrow();
      await trx.updateTable("units").set({ floor: "2. OG", position: "links" }).where("id", "=", unit.id).execute();
      await trx.updateTable("units").set({ floor: "2. OG" }).where("id", "=", unit.id).execute(); // keine Änderung
      await trx.deleteFrom("units").where("id", "=", unit.id).execute();
      return unit.id;
    });

    const entries = await withTenant(t.appDb, { tenantId: s.a.tenantId, userId: s.a.adminUserId }, (trx) =>
      trx.selectFrom("audit_log").selectAll().where("row_id", "=", unitId).orderBy("id").execute(),
    );
    expect(entries.map((e) => e.action)).toEqual(["insert", "update", "delete"]);
    for (const e of entries) {
      expect(e).toMatchObject({ actor_user_id: s.a.managerUserId, actor_kind: "user", request_id: "req-123", table_name: "units", tenant_id: s.a.tenantId });
    }
    expect(entries[1]!.changed_fields).toEqual(["floor", "position"]);
    expect(entries[1]!.old_data).toMatchObject({ floor: null });
    expect(entries[1]!.new_data).toMatchObject({ floor: "2. OG", position: "links" });
    expect(entries[2]!.new_data).toBeNull();
  });

  it("Systemänderungen ohne Benutzer werden als System protokolliert", async () => {
    const tenant = await t.ownerDb.insertInto("tenants").values({ name: "Sys", slug: `sys-${Date.now()}` }).returning("id").executeTakeFirstOrThrow();
    const entry = await t.ownerDb.selectFrom("audit_log").selectAll().where("table_name", "=", "tenants").where("row_id", "=", tenant.id).executeTakeFirstOrThrow();
    expect(entry).toMatchObject({ actor_kind: "system", actor_user_id: null, tenant_id: tenant.id });
  });

  it("nur Benutzer mit Mandantenbereich lesen das Audit-Log", async () => {
    const count = (userId: string) =>
      withTenant(t.appDb, { tenantId: s.a.tenantId, userId }, async (trx) => (await trx.selectFrom("audit_log").select("id").execute()).length);
    expect(await count(s.a.adminUserId)).toBeGreaterThan(0);
    expect(await count(s.a.managerUserId)).toBe(0);
    const other = await withTenant(t.appDb, { tenantId: s.b.tenantId, userId: s.b.adminUserId }, (trx) =>
      trx.selectFrom("audit_log").select(["tenant_id"]).execute(),
    );
    expect(other.every((e) => e.tenant_id === s.b.tenantId)).toBe(true);
  });

  it("das Log ist unveränderlich – für die Anwendung und den Eigentümer", async () => {
    await expect(
      withTenant(t.appDb, { tenantId: s.a.tenantId, userId: s.a.adminUserId }, (trx) => trx.updateTable("audit_log").set({ actor_kind: "system" }).execute()),
    ).rejects.toThrow(/permission denied/);
    await expect(
      withTenant(t.appDb, { tenantId: s.a.tenantId, userId: s.a.adminUserId }, (trx) =>
        trx.insertInto("audit_log").values({ actor_kind: "user", table_name: "x", action: "insert", tenant_id: s.a.tenantId }).execute(),
      ),
    ).rejects.toThrow(/permission denied/);
    await expect(t.ownerDb.deleteFrom("audit_log").execute()).rejects.toThrow(/unveränderlich/);
    await expect(sql`TRUNCATE audit_log`.execute(t.ownerDb)).rejects.toThrow(/unveränderlich/);
  });
});
