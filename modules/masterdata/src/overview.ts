import { can, requirePermission } from "@hv/access";
import type { EvaluatedDeadline } from "@hv/deadlines";
import { listAssets, listMeters } from "./assets";
import { getCompleteness, type Completeness } from "./completeness";
import type { Ctx } from "./context";
import { listDeadlines } from "./deadlines";
import { personDisplayName } from "./mappers";
import { getProperty, listBuildings } from "./properties";
import type { Asset, Building, Meter, Property, Unit } from "./schemas";
import { listUnits } from "./units";

export interface UnitOccupant {
  personId: string;
  displayName: string;
  role: string;
  share: string | null;
}

export interface PropertyOverview {
  property: Property;
  buildings: Building[];
  units: Array<Unit & { occupants: UnitOccupant[] }>;
  assets: Asset[];
  meters: Meter[];
  deadlines: EvaluatedDeadline[];
  completeness: Completeness;
  totals: { units: number; livingArea: string; usableArea: string; meaSum: string };
}

function sumDecimal(values: Array<string | undefined>): string {
  // Areas have at most 4 decimals; sum in integer ten-thousandths to stay exact.
  const total = values.reduce((acc, v) => {
    if (!v) return acc;
    const [int, frac = ""] = v.split(".");
    return acc + BigInt(int!) * 10000n + BigInt((frac + "0000").slice(0, 4));
  }, 0n);
  const int = total / 10000n;
  const frac = (total % 10000n).toString().padStart(4, "0").replace(/0+$/, "");
  return frac ? `${int}.${frac}` : `${int}`;
}

/** 360°-Akte eines Objekts (V24): everything about it on one page. */
export async function getPropertyOverview(ctx: Ctx, propertyId: string): Promise<PropertyOverview> {
  requirePermission(ctx.principal, "masterdata.read", { propertyId });
  const property = await getProperty(ctx, propertyId);
  const [buildings, units, assets, meters, completeness] = await Promise.all([
    listBuildings(ctx, propertyId),
    listUnits(ctx, propertyId),
    listAssets(ctx, propertyId),
    listMeters(ctx, propertyId),
    getCompleteness(ctx, propertyId),
  ]);
  const deadlines = can(ctx.principal, "deadlines.read", { propertyId }) ? await listDeadlines(ctx, { propertyId }) : [];

  const occupants = new Map<string, UnitOccupant[]>();
  if (can(ctx.principal, "persons.read", { propertyId }) && units.length > 0) {
    const rows = await ctx.trx
      .selectFrom("person_roles as r")
      .innerJoin("persons as p", "p.id", "r.person_id")
      .select(["r.unit_id", "r.role", "r.share", "p.id", "p.kind", "p.first_name", "p.last_name", "p.company_name", "p.title"])
      .where("r.property_id", "=", propertyId)
      .where("r.unit_id", "is not", null)
      .where((eb) => eb.or([eb("r.valid_from", "is", null), eb("r.valid_from", "<=", ctx.today)]))
      .where((eb) => eb.or([eb("r.valid_to", "is", null), eb("r.valid_to", ">", ctx.today)]))
      .orderBy("r.role")
      .execute();
    for (const r of rows) {
      const list = occupants.get(r.unit_id!) ?? [];
      list.push({ personId: r.id, displayName: personDisplayName(r), role: r.role, share: r.share });
      occupants.set(r.unit_id!, list);
    }
  }

  return {
    property,
    buildings,
    units: units.map((u) => ({ ...u, occupants: occupants.get(u.id) ?? [] })),
    assets,
    meters,
    deadlines,
    completeness,
    totals: {
      units: units.length,
      livingArea: sumDecimal(units.map((u) => u.measures.living_area)),
      usableArea: sumDecimal(units.map((u) => u.measures.usable_area)),
      meaSum: sumDecimal(units.map((u) => u.measures.mea)),
    },
  };
}
