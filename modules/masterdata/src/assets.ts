import { requirePermission } from "@hv/access";
import { NotFoundError, ValidationError } from "@hv/core";
import { calibrationValidUntil } from "@hv/deadlines";
import type { Ctx } from "./context";
import { definedOnly, toAsset, toMeter } from "./mappers";
import type { Asset, AssetCreate, Meter, MeterCreate } from "./schemas";

export async function listAssets(ctx: Ctx, propertyId: string): Promise<Asset[]> {
  requirePermission(ctx.principal, "masterdata.read", { propertyId });
  const rows = await ctx.trx.selectFrom("technical_assets").selectAll().where("property_id", "=", propertyId).orderBy("kind").orderBy("name").execute();
  return rows.map(toAsset);
}

export async function createAsset(ctx: Ctx, propertyId: string, input: AssetCreate): Promise<Asset> {
  requirePermission(ctx.principal, "masterdata.write", { propertyId });
  if (input.kind === "heating" && !input.energyCarrier) {
    throw new ValidationError("Für Heizungsanlagen ist der Energieträger nötig (steuert CO2- und GModG-Regeln).", [
      { path: "energyCarrier", message: "Pflichtfeld bei Heizung" },
    ]);
  }
  const row = await ctx.trx
    .insertInto("technical_assets")
    .values({
      tenant_id: ctx.principal.tenantId,
      property_id: propertyId,
      building_id: input.buildingId ?? null,
      kind: input.kind,
      name: input.name,
      installed_on: input.installedOn ?? null,
      energy_carrier: input.energyCarrier ?? null,
      last_inspection_on: input.lastInspectionOn ?? null,
      attributes: JSON.stringify(input.attributes ?? {}),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toAsset(row);
}

export async function updateAsset(ctx: Ctx, id: string, patch: Partial<AssetCreate>): Promise<Asset> {
  const current = await ctx.trx.selectFrom("technical_assets").selectAll().where("id", "=", id).executeTakeFirst();
  if (!current) throw new NotFoundError("Anlage", id);
  requirePermission(ctx.principal, "masterdata.write", { propertyId: current.property_id });
  const values = definedOnly({
    building_id: patch.buildingId,
    kind: patch.kind,
    name: patch.name,
    installed_on: patch.installedOn,
    energy_carrier: patch.energyCarrier,
    last_inspection_on: patch.lastInspectionOn,
    attributes: patch.attributes ? JSON.stringify({ ...current.attributes, ...patch.attributes }) : undefined,
  });
  if (Object.keys(values).length === 0) return toAsset(current);
  return toAsset(await ctx.trx.updateTable("technical_assets").set(values).where("id", "=", id).returningAll().executeTakeFirstOrThrow());
}

export async function listMeters(ctx: Ctx, propertyId: string): Promise<Meter[]> {
  requirePermission(ctx.principal, "masterdata.read", { propertyId });
  const rows = await ctx.trx.selectFrom("meters").selectAll().where("property_id", "=", propertyId).orderBy("kind").orderBy("serial_number").execute();
  return rows.map(toMeter);
}

function resolveCalibration(ctx: Ctx, input: Pick<MeterCreate, "kind" | "calibrationValidUntil" | "calibrationYear">): string | null {
  if (input.calibrationValidUntil) return input.calibrationValidUntil;
  if (input.calibrationYear) return calibrationValidUntil(input.kind, input.calibrationYear, ctx.today);
  return null;
}

export async function createMeter(ctx: Ctx, propertyId: string, input: MeterCreate): Promise<Meter> {
  requirePermission(ctx.principal, "masterdata.write", { propertyId });
  if (input.interoperable && !input.remoteReadable) {
    throw new ValidationError("Interoperabel setzt fernablesbar voraus.", [{ path: "interoperable", message: "Nur bei fernablesbaren Geräten" }]);
  }
  const row = await ctx.trx
    .insertInto("meters")
    .values({
      tenant_id: ctx.principal.tenantId,
      property_id: propertyId,
      unit_id: input.unitId ?? null,
      building_id: input.buildingId ?? null,
      kind: input.kind,
      serial_number: input.serialNumber,
      location: input.location ?? null,
      remote_readable: input.remoteReadable ?? false,
      interoperable: input.interoperable ?? false,
      calibration_valid_until: resolveCalibration(ctx, input),
      installed_on: input.installedOn ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toMeter(row);
}

export async function updateMeter(ctx: Ctx, id: string, patch: Partial<MeterCreate>): Promise<Meter> {
  const current = await ctx.trx.selectFrom("meters").selectAll().where("id", "=", id).executeTakeFirst();
  if (!current) throw new NotFoundError("Zähler", id);
  requirePermission(ctx.principal, "masterdata.write", { propertyId: current.property_id });
  const remoteReadable = patch.remoteReadable ?? current.remote_readable;
  const interoperable = patch.interoperable ?? current.interoperable;
  if (interoperable && !remoteReadable) {
    throw new ValidationError("Interoperabel setzt fernablesbar voraus.", [{ path: "interoperable", message: "Nur bei fernablesbaren Geräten" }]);
  }
  const calibration =
    patch.calibrationValidUntil !== undefined || patch.calibrationYear !== undefined
      ? resolveCalibration(ctx, { kind: patch.kind ?? current.kind, calibrationValidUntil: patch.calibrationValidUntil, calibrationYear: patch.calibrationYear })
      : undefined;
  const values = definedOnly({
    unit_id: patch.unitId,
    building_id: patch.buildingId,
    kind: patch.kind,
    serial_number: patch.serialNumber,
    location: patch.location,
    remote_readable: patch.remoteReadable,
    interoperable: patch.interoperable,
    calibration_valid_until: calibration,
    installed_on: patch.installedOn,
  });
  if (Object.keys(values).length === 0) return toMeter(current);
  return toMeter(await ctx.trx.updateTable("meters").set(values).where("id", "=", id).returningAll().executeTakeFirstOrThrow());
}
