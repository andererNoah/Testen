import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { MigrationChecksumError, TABLE_COLUMNS, migrate, sql } from "@hv/db";
import { createTestDatabase, type TestDatabase } from "@hv/db/test-support";

let t: TestDatabase;
beforeAll(async () => {
  t = await createTestDatabase();
});
afterAll(async () => {
  await t.destroy();
});

async function tableColumns(table: string): Promise<string[]> {
  const { rows } = await sql<{ column_name: string }>`
    SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = ${table} ORDER BY column_name`.execute(t.ownerDb);
  return rows.map((r) => r.column_name);
}

describe("Schema", () => {
  it("Kysely-Typen entsprechen den Tabellen", async () => {
    for (const [table, cols] of Object.entries(TABLE_COLUMNS)) {
      expect(await tableColumns(table), table).toEqual([...cols].sort());
    }
  });

  it("jede Tabelle mit tenant_id hat erzwungene RLS und den Audit-Trigger", async () => {
    const { rows } = await sql<{ table_name: string; rls: boolean; forced: boolean; audited: boolean }>`
      SELECT c.relname AS table_name, c.relrowsecurity AS rls, c.relforcerowsecurity AS forced,
             EXISTS (SELECT 1 FROM pg_trigger tg WHERE tg.tgrelid = c.oid AND tg.tgname = c.relname || '_audit') AS audited
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace AND n.nspname = 'public'
       WHERE c.relkind = 'r'
         AND EXISTS (SELECT 1 FROM information_schema.columns col
                      WHERE col.table_schema = 'public' AND col.table_name = c.relname AND col.column_name = 'tenant_id')
       ORDER BY c.relname`.execute(t.ownerDb);
    expect(rows.length).toBeGreaterThan(10);
    for (const row of rows) {
      expect(row.rls, `${row.table_name}: RLS`).toBe(true);
      expect(row.forced, `${row.table_name}: FORCE RLS`).toBe(true);
      if (!["audit_log", "access_log"].includes(row.table_name)) expect(row.audited, `${row.table_name}: Audit-Trigger`).toBe(true);
    }
  });

  it("die Anwendungsrolle umgeht RLS nicht und ist kein Superuser", async () => {
    const { rows } = await sql<{ rolsuper: boolean; rolbypassrls: boolean }>`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = 'hv_app'`.execute(t.ownerDb);
    expect(rows[0]).toEqual({ rolsuper: false, rolbypassrls: false });
  });

  it("ohne Mandanten-Kontext sieht die Anwendung nichts (fail closed)", async () => {
    const tenant = await t.ownerDb.insertInto("tenants").values({ name: "X", slug: "x-fail-closed" }).returning("id").executeTakeFirstOrThrow();
    await t.ownerDb.insertInto("properties").values({ tenant_id: tenant.id, kind: "rental", code: "1", name: "Haus" }).execute();
    expect(await t.appDb.selectFrom("properties").selectAll().execute()).toEqual([]);
    expect(await t.appDb.selectFrom("tenants").selectAll().execute()).toEqual([]);
  });
});

describe("Migrationen", () => {
  it("sind idempotent", async () => {
    const result = await migrate(t.ownerUrl);
    expect(result.applied).toEqual([]);
    expect(result.skipped.length).toBeGreaterThanOrEqual(5);
  });

  it("erkennen nachträglich geänderte Dateien", async () => {
    const dir = await mkdtemp(path.join(os.tmpdir(), "hv-mig-"));
    await writeFile(path.join(dir, "0001_test.sql"), "CREATE TABLE mig_probe (id int);");
    await migrate(t.ownerUrl, dir);
    await writeFile(path.join(dir, "0001_test.sql"), "CREATE TABLE mig_probe (id bigint);");
    await expect(migrate(t.ownerUrl, dir)).rejects.toThrow(MigrationChecksumError);
  });
});
