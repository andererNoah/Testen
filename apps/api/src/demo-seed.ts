import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { assignRole, createUser, loadPrincipal, provisionTenant } from "@hv/access";
import { withTenant, type ActorKind, type Db } from "@hv/db";
import { commitImportJob, createImportJob, validateImportJob } from "@hv/importer";
import type { Ctx } from "@hv/masterdata";

export const DEMO_DIR = path.resolve(import.meta.dirname, "../../../demo/import");
export const DEMO_SLUG = "demo";

export interface DemoLogin {
  email: string;
  displayName: string;
  role: string;
}

/**
 * Demo-Mandant (Arbeitsweise: „Pflege einen realistischen Demo-Mandanten“): one WEG, one rental
 * building, one SEV portfolio and one commercial building, loaded through the regular importer.
 */
export async function seedDemoTenant(ownerDb: Db, appDb: Db, today: string): Promise<{ tenantId: string; logins: DemoLogin[]; created: boolean }> {
  const existing = await ownerDb.selectFrom("tenants").select("id").where("slug", "=", DEMO_SLUG).executeTakeFirst();
  if (existing) return { tenantId: existing.id, logins: [], created: false };

  const tenant = await provisionTenant(ownerDb, {
    name: "Hausverwaltung Muster GmbH",
    slug: DEMO_SLUG,
    admin: { email: "admin@muster-hv.example", displayName: "Anna Admin" },
  });
  const run = <T>(fn: (ctx: Ctx) => Promise<T>, actorKind: ActorKind = "user") =>
    withTenant(appDb, { tenantId: tenant.tenantId, userId: tenant.adminUserId, actorKind, requestId: "demo-seed" }, async (trx) =>
      fn({ trx, principal: await loadPrincipal(trx, tenant.adminUserId), today }),
    );

  const files = await Promise.all(
    (await readdir(DEMO_DIR)).filter((f) => f.endsWith(".csv")).map(async (filename) => ({ filename, data: await readFile(path.join(DEMO_DIR, filename)) })),
  );
  const job = await run((ctx) => createImportJob(ctx, files, { source: "demo" }));
  const validated = await run((ctx) => validateImportJob(ctx, job.id));
  if (!validated.report?.ok) throw new Error(`Demo-Import fehlerhaft: ${JSON.stringify(validated.report?.issues.slice(0, 5))}`);
  await run((ctx) => commitImportJob(ctx, job.id), "import");

  const logins: DemoLogin[] = [{ email: "admin@muster-hv.example", displayName: "Anna Admin", role: "Mandanten-Admin" }];
  await run(async (ctx) => {
    const property = async (code: string) => (await ctx.trx.selectFrom("properties").select("id").where("code", "=", code).executeTakeFirstOrThrow()).id;
    const unit = async (code: string, number: string) =>
      (await ctx.trx.selectFrom("units as u").innerJoin("properties as p", "p.id", "u.property_id").select("u.id").where("p.code", "=", code).where("u.number", "=", number).executeTakeFirstOrThrow()).id;
    const person = async (key: string) =>
      (await ctx.trx.selectFrom("external_keys").select("entity_id").where("source", "=", "demo").where("entity_type", "=", "person").where("external_key", "=", key).executeTakeFirstOrThrow()).entity_id;

    const user = async (email: string, displayName: string, role: string, personKey?: string) => {
      const id = await createUser(ctx.trx, tenant.tenantId, { email, displayName, personId: personKey ? await person(personKey) : null });
      logins.push({ email, displayName, role });
      return id;
    };
    const olaf = await user("objektbetreuer@muster-hv.example", "Olaf Objektbetreuer", "Objektbetreuer WEG Lindenstraße 12 und SEV Weber");
    await assignRole(ctx.trx, tenant.tenantId, { userId: olaf, roleKey: "property_manager", scopeType: "property", scopeId: await property("W001") });
    await assignRole(ctx.trx, tenant.tenantId, { userId: olaf, roleKey: "property_manager", scopeType: "property", scopeId: await property("S001") });
    const petra = await user("pfleger@muster-hv.example", "Petra Pfleger", "Objektbetreuerin Mietshaus und Geschäftshaus");
    await assignRole(ctx.trx, tenant.tenantId, { userId: petra, roleKey: "property_manager", scopeType: "property", scopeId: await property("M001") });
    await assignRole(ctx.trx, tenant.tenantId, { userId: petra, roleKey: "property_manager", scopeType: "property", scopeId: await property("G001") });
    const bernd = await user("buchhaltung@muster-hv.example", "Bernd Buchhaltung", "Buchhaltung (alle Objekte)");
    await assignRole(ctx.trx, tenant.tenantId, { userId: bernd, roleKey: "accountant", scopeType: "tenant" });
    const tim = await user("technik@muster-hv.example", "Tim Technik", "Hausmeister Mietshaus");
    await assignRole(ctx.trx, tenant.tenantId, { userId: tim, roleKey: "technician", scopeType: "property", scopeId: await property("M001") });
    const sabine = await user("sabine.hoffmann@example.org", "Sabine Hoffmann", "Beirätin und Eigentümerin WE 01", "P001");
    await assignRole(ctx.trx, tenant.tenantId, { userId: sabine, roleKey: "advisory_board", scopeType: "property", scopeId: await property("W001") });
    await assignRole(ctx.trx, tenant.tenantId, { userId: sabine, roleKey: "owner", scopeType: "unit", scopeId: await unit("W001", "WE 01") });
    const thomas = await user("thomas.weber@example.org", "Thomas Weber", "Eigentümer WE 02 (WEG) und SEV-Kunde", "P002");
    await assignRole(ctx.trx, tenant.tenantId, { userId: thomas, roleKey: "owner", scopeType: "unit", scopeId: await unit("W001", "WE 02") });
    await assignRole(ctx.trx, tenant.tenantId, { userId: thomas, roleKey: "owner", scopeType: "unit", scopeId: await unit("S001", "SEV WE 02") });
    const paul = await user("paul.richter@example.org", "Paul Richter", "Mieter Mietshaus WE 01", "P011");
    await assignRole(ctx.trx, tenant.tenantId, { userId: paul, roleKey: "renter", scopeType: "unit", scopeId: await unit("M001", "WE 01") });
  });
  return { tenantId: tenant.tenantId, logins, created: true };
}
