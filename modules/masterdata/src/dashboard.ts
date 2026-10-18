import { can, requirePermission } from "@hv/access";
import { getCompleteness } from "./completeness";
import type { Ctx } from "./context";
import { listDeadlines, type PropertyDeadline } from "./deadlines";

export interface Dashboard {
  counts: { properties: number; units: number; persons: number | null; vacantUnits: number };
  deadlines: { ok: number; warn: number; critical: number; overdue: number } | null;
  nextDeadlines: PropertyDeadline[];
  properties: Array<{ id: string; code: string; name: string; kind: string; units: number; completenessScore: number; completenessTrafficLight: "green" | "yellow" | "red" }>;
}

/** Start page per role (V2): counts, deadline traffic lights, completeness per property. */
export async function getDashboard(ctx: Ctx): Promise<Dashboard> {
  requirePermission(ctx.principal, "masterdata.read");
  const properties = await ctx.trx.selectFrom("properties").select(["id", "code", "name", "kind"]).where("archived_at", "is", null).orderBy("code").execute();
  const units = await ctx.trx.selectFrom("units").select(["id", "property_id", "type"]).where("archived_at", "is", null).execute();
  const rentalIds = new Set(properties.filter((p) => p.kind !== "weg").map((p) => p.id));
  // Vacancy: rentable units in rental/SEV objects without a current tenant.
  const renters = await ctx.trx
    .selectFrom("person_roles")
    .select("unit_id")
    .distinct()
    .where("role", "=", "mieter")
    .where("unit_id", "is not", null)
    .where((eb) => eb.or([eb("valid_from", "is", null), eb("valid_from", "<=", ctx.today)]))
    .where((eb) => eb.or([eb("valid_to", "is", null), eb("valid_to", ">", ctx.today)]))
    .execute();
  const rented = new Set(renters.map((r) => r.unit_id));
  const vacantUnits = units.filter((u) => rentalIds.has(u.property_id) && (u.type === "apartment" || u.type === "commercial") && !rented.has(u.id)).length;

  let persons: number | null = null;
  if (can(ctx.principal, "persons.read")) {
    const row = await ctx.trx.selectFrom("persons").select((eb) => eb.fn.countAll<string>().as("n")).where("merged_into_id", "is", null).executeTakeFirstOrThrow();
    persons = Number(row.n);
  }
  const deadlines = can(ctx.principal, "deadlines.read") ? await listDeadlines(ctx) : null;
  const completeness = await Promise.all(properties.map((p) => getCompleteness(ctx, p.id)));
  return {
    counts: { properties: properties.length, units: units.length, persons, vacantUnits },
    deadlines: deadlines
      ? {
          ok: deadlines.filter((d) => d.status === "ok").length,
          warn: deadlines.filter((d) => d.status === "warn").length,
          critical: deadlines.filter((d) => d.status === "critical").length,
          overdue: deadlines.filter((d) => d.status === "overdue").length,
        }
      : null,
    nextDeadlines: (deadlines ?? []).filter((d) => d.status !== "ok").slice(0, 6),
    properties: properties.map((p, i) => ({
      id: p.id,
      code: p.code,
      name: p.name,
      kind: p.kind,
      units: units.filter((u) => u.property_id === p.id).length,
      completenessScore: completeness[i]!.score,
      completenessTrafficLight: completeness[i]!.trafficLight,
    })),
  };
}
