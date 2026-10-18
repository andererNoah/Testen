import { requirePermission } from "@hv/access";
import { Decimal } from "@hv/money";
import type { Ctx } from "./context";
import { measuresAsOf } from "./measures";
import { getProperty } from "./properties";

export interface CompletenessCheck {
  key: string;
  label: string;
  ok: boolean;
  severity: "required" | "recommended";
  detail?: string;
}

export interface Completeness {
  propertyId: string;
  /** 0–100 */
  score: number;
  trafficLight: "green" | "yellow" | "red";
  checks: CompletenessCheck[];
}

/** Vollständigkeitsampel je Objekt (V29): what is missing before billing and deadlines work. */
export async function getCompleteness(ctx: Ctx, propertyId: string): Promise<Completeness> {
  requirePermission(ctx.principal, "masterdata.read", { propertyId });
  const property = await getProperty(ctx, propertyId);
  const [buildings, units, assets] = await Promise.all([
    ctx.trx.selectFrom("buildings").select(["id"]).where("property_id", "=", propertyId).execute(),
    ctx.trx.selectFrom("units").select(["id", "number", "type"]).where("property_id", "=", propertyId).where("archived_at", "is", null).execute(),
    ctx.trx.selectFrom("technical_assets").selectAll().where("property_id", "=", propertyId).execute(),
  ]);
  const measures = await measuresAsOf(
    ctx.trx,
    units.map((u) => u.id),
    ctx.today,
  );
  const checks: CompletenessCheck[] = [];
  const add = (key: string, label: string, ok: boolean, severity: CompletenessCheck["severity"], detail?: string) =>
    checks.push({ key, label, ok, severity, ...(detail && !ok ? { detail } : {}) });

  const missingAddress = (["street", "postalCode", "city", "state"] as const).filter((f) => !property[f]);
  add("address", "Anschrift und Bundesland", missingAddress.length === 0, "required", `Fehlt: ${missingAddress.join(", ")}`);
  add("buildings", "Mindestens ein Gebäude", buildings.length > 0, "required", "Kein Gebäude erfasst");
  add("units", "Mindestens eine Einheit", units.length > 0, "required", "Keine Einheit erfasst");

  const withoutArea = units.filter((u) => {
    const m = measures.get(u.id) ?? {};
    if (u.type === "apartment") return !m.living_area;
    if (u.type === "commercial") return !m.usable_area && !m.living_area;
    return false;
  });
  add("areas", "Wohn- bzw. Nutzfläche je Einheit", withoutArea.length === 0, "required", `Ohne Fläche: ${withoutArea.map((u) => u.number).join(", ")}`);

  if (property.kind === "weg" || property.kind === "sev") {
    add("mea_denominator", "Nenner der Miteigentumsanteile", !!property.meaDenominator, "required", "Nenner (z. B. 1.000 oder 10.000) fehlt");
  }
  if (property.kind === "weg") {
    const withoutMea = units.filter((u) => !measures.get(u.id)?.mea);
    add("mea", "Miteigentumsanteil je Einheit", withoutMea.length === 0, "required", `Ohne MEA: ${withoutMea.map((u) => u.number).join(", ")}`);
    if (property.meaDenominator && withoutMea.length === 0 && units.length > 0) {
      const total = units.reduce((acc, u) => acc.plus(measures.get(u.id)!.mea!), new Decimal(0));
      add("mea_sum", "Summe der MEA entspricht dem Nenner", total.equals(property.meaDenominator), "required", `Summe ${total.toString()} statt ${property.meaDenominator}`);
    }
    const owners = await ctx.trx
      .selectFrom("person_roles")
      .select("unit_id")
      .where("property_id", "=", propertyId)
      .where("role", "=", "eigentuemer")
      .where((eb) => eb.or([eb("valid_from", "is", null), eb("valid_from", "<=", ctx.today)]))
      .where((eb) => eb.or([eb("valid_to", "is", null), eb("valid_to", ">", ctx.today)]))
      .execute();
    const owned = new Set(owners.map((o) => o.unit_id));
    const withoutOwner = units.filter((u) => !owned.has(u.id));
    add("owners", "Aktuelle Eigentümer je Einheit", withoutOwner.length === 0, "required", `Ohne Eigentümer: ${withoutOwner.map((u) => u.number).join(", ")}`);
  }

  const heating = assets.filter((a) => a.kind === "heating");
  add(
    "heating",
    "Heizungsanlage mit Energieträger und Einbaudatum",
    heating.length > 0 && heating.every((h) => h.energy_carrier && h.installed_on),
    "recommended",
    "Steuert CO2-Aufteilung und GModG-Regeln",
  );
  const water = assets.filter((a) => a.kind === "drinking_water");
  add(
    "drinking_water",
    "Trinkwasseranlage: Großanlage ja/nein erfasst",
    water.length > 0 && water.every((w) => typeof (w.attributes as Record<string, unknown>).largeSystem === "boolean"),
    "recommended",
    "Ohne diese Angabe kann die Legionellenprüfpflicht nicht bestimmt werden",
  );
  if (units.some((u) => u.type === "apartment")) {
    const smoke = assets.filter((a) => a.kind === "smoke_detectors");
    add("smoke_detectors", "Rauchwarnmelder mit letzter Wartung", smoke.length > 0 && smoke.every((s) => !!s.last_inspection_on), "recommended", "Wartungspflicht nach Landesrecht");
  }

  const weight = (c: CompletenessCheck) => (c.severity === "required" ? 2 : 1);
  const total = checks.reduce((acc, c) => acc + weight(c), 0);
  const achieved = checks.filter((c) => c.ok).reduce((acc, c) => acc + weight(c), 0);
  const trafficLight = checks.some((c) => !c.ok && c.severity === "required") ? "red" : checks.some((c) => !c.ok) ? "yellow" : "green";
  return { propertyId, score: total ? Math.round((achieved / total) * 100) : 100, trafficLight, checks };
}
