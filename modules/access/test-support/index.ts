import type { Db } from "@hv/db";
import { provisionTenant } from "../src/index";

/**
 * Standard scenario for permission tests (docs/rechtekonzept.md, Abnahmetest Phase 0):
 * Tenant A: P1 (units U1, U2), P2 (unit U3); users admin (tenant), manager (P1), renter (U1).
 * Tenant B: Q1; user adminB.
 */
export interface Scenario {
  a: {
    tenantId: string;
    adminUserId: string;
    managerUserId: string;
    renterUserId: string;
    p1: string;
    p2: string;
    u1: string;
    u2: string;
    u3: string;
    renterPersonId: string;
    ownerU1PersonId: string;
    ownerU3PersonId: string;
  };
  b: { tenantId: string; adminUserId: string; q1: string };
}

export async function seedScenario(ownerDb: Db, suffix = Math.random().toString(36).slice(2, 8)): Promise<Scenario> {
  const a = await provisionTenant(ownerDb, { name: "Verwaltung A", slug: `verwaltung-a-${suffix}`, admin: { email: `admin-${suffix}@a.test`, displayName: "Anna Admin" } });
  const b = await provisionTenant(ownerDb, { name: "Verwaltung B", slug: `verwaltung-b-${suffix}`, admin: { email: `admin-${suffix}@b.test`, displayName: "Bernd Admin" } });

  return ownerDb.transaction().execute(async (trx) => {
    const prop = (tenant_id: string, code: string, name: string, kind: "weg" | "rental" | "sev" = "rental") =>
      trx.insertInto("properties").values({ tenant_id, code, name, kind, state: "SN" }).returning("id").executeTakeFirstOrThrow().then((r) => r.id);
    const p1 = await prop(a.tenantId, "P1", "Mietshaus Lindenstraße");
    const p2 = await prop(a.tenantId, "P2", "WEG Parkallee", "weg");
    const q1 = await prop(b.tenantId, "Q1", "Fremdes Objekt");
    const unit = (property_id: string, number: string) =>
      trx.insertInto("units").values({ tenant_id: a.tenantId, property_id, number, type: "apartment" }).returning("id").executeTakeFirstOrThrow().then((r) => r.id);
    const u1 = await unit(p1, "WE 01");
    const u2 = await unit(p1, "WE 02");
    const u3 = await unit(p2, "WE 01");
    const person = (last_name: string, first_name: string) =>
      trx.insertInto("persons").values({ tenant_id: a.tenantId, kind: "natural", last_name, first_name }).returning("id").executeTakeFirstOrThrow().then((r) => r.id);
    const renterPersonId = await person("Mieterin", "Mia");
    const ownerU1PersonId = await person("Eigner", "Egon");
    const ownerU3PersonId = await person("Wohnungseigentümer", "Wilma");
    await trx
      .insertInto("person_roles")
      .values([
        { tenant_id: a.tenantId, person_id: renterPersonId, role: "mieter", property_id: p1, unit_id: u1 },
        { tenant_id: a.tenantId, person_id: ownerU1PersonId, role: "eigentuemer", property_id: p1, unit_id: u1 },
        { tenant_id: a.tenantId, person_id: ownerU3PersonId, role: "eigentuemer", property_id: p2, unit_id: u3 },
      ])
      .execute();
    const user = (email: string, display_name: string, person_id: string | null = null) =>
      trx.insertInto("users").values({ tenant_id: a.tenantId, email, display_name, person_id }).returning("id").executeTakeFirstOrThrow().then((r) => r.id);
    const managerUserId = await user(`manager-${suffix}@a.test`, "Max Objektbetreuer");
    const renterUserId = await user(`renter-${suffix}@a.test`, "Mia Mieterin", renterPersonId);
    await trx
      .insertInto("role_assignments")
      .values([
        { tenant_id: a.tenantId, user_id: managerUserId, role_id: a.roleIds.property_manager!, scope_type: "property", scope_id: p1 },
        { tenant_id: a.tenantId, user_id: renterUserId, role_id: a.roleIds.renter!, scope_type: "unit", scope_id: u1 },
      ])
      .execute();
    return {
      a: { tenantId: a.tenantId, adminUserId: a.adminUserId, managerUserId, renterUserId, p1, p2, u1, u2, u3, renterPersonId, ownerU1PersonId, ownerU3PersonId },
      b: { tenantId: b.tenantId, adminUserId: b.adminUserId, q1 },
    };
  });
}
