import { requirePermission } from "@hv/access";
import { NotFoundError, ValidationError } from "@hv/core";
import type { MeasureKind, Row } from "@hv/db";
import type { IsoDate } from "@hv/deadlines";
import type { Ctx } from "./context";
import { validateCustomFields } from "./custom-fields";
import { definedOnly } from "./mappers";
import { measureHistory, measuresAsOf, recordMeasure } from "./measures";
import type { MeasureInput, MeasureValue, Unit, UnitCreate, UnitUpdate } from "./schemas";

function toUnit(r: Row<"units">, measures: Partial<Record<MeasureKind, string>> = {}): Unit {
  return {
    id: r.id,
    propertyId: r.property_id,
    buildingId: r.building_id,
    number: r.number,
    type: r.type,
    floor: r.floor,
    position: r.position,
    description: r.description,
    linkedUnitId: r.linked_unit_id,
    customFields: r.custom_fields,
    measures,
  };
}

export async function listUnits(ctx: Ctx, propertyId: string, asOf: IsoDate = ctx.today): Promise<Unit[]> {
  requirePermission(ctx.principal, "masterdata.read", { propertyId });
  const rows = await ctx.trx
    .selectFrom("units")
    .selectAll()
    .where("property_id", "=", propertyId)
    .where("archived_at", "is", null)
    .orderBy("number")
    .execute();
  const measures = await measuresAsOf(
    ctx.trx,
    rows.map((r) => r.id),
    asOf,
  );
  return rows.map((r) => toUnit(r, measures.get(r.id)));
}

async function loadUnitRow(ctx: Ctx, id: string): Promise<Row<"units">> {
  const row = await ctx.trx.selectFrom("units").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) throw new NotFoundError("Einheit", id);
  return row;
}

export async function getUnit(ctx: Ctx, id: string, asOf: IsoDate = ctx.today): Promise<Unit> {
  const row = await loadUnitRow(ctx, id);
  requirePermission(ctx.principal, "masterdata.read", { propertyId: row.property_id, unitId: row.id });
  const measures = await measuresAsOf(ctx.trx, [id], asOf);
  return toUnit(row, measures.get(id));
}

async function checkLinkedUnit(ctx: Ctx, propertyId: string, linkedUnitId: string | null | undefined) {
  if (!linkedUnitId) return;
  const linked = await ctx.trx.selectFrom("units").select(["id", "property_id"]).where("id", "=", linkedUnitId).executeTakeFirst();
  if (!linked) throw new ValidationError("Verknüpfte Einheit nicht gefunden.", [{ path: "linkedUnitId", message: "Unbekannte Einheit" }]);
  if (linked.property_id === propertyId) {
    throw new ValidationError("Eine SEV-Einheit wird mit einer Einheit eines anderen Objekts (der WEG) verknüpft.", [
      { path: "linkedUnitId", message: "Einheit liegt im selben Objekt" },
    ]);
  }
}

export async function createUnit(ctx: Ctx, propertyId: string, input: UnitCreate): Promise<Unit> {
  requirePermission(ctx.principal, "masterdata.write", { propertyId });
  await checkLinkedUnit(ctx, propertyId, input.linkedUnitId);
  const customFields = await validateCustomFields(ctx, "unit", input.customFields);
  const row = await ctx.trx
    .insertInto("units")
    .values({
      tenant_id: ctx.principal.tenantId,
      property_id: propertyId,
      building_id: input.buildingId ?? null,
      number: input.number,
      type: input.type,
      floor: input.floor ?? null,
      position: input.position ?? null,
      description: input.description ?? null,
      linked_unit_id: input.linkedUnitId ?? null,
      custom_fields: JSON.stringify(customFields),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  for (const m of input.measures ?? []) {
    await recordMeasure(ctx.trx, { tenantId: row.tenant_id, propertyId, unitId: row.id }, m);
  }
  return getUnit(ctx, row.id);
}

export async function updateUnit(ctx: Ctx, id: string, patch: UnitUpdate): Promise<Unit> {
  const current = await loadUnitRow(ctx, id);
  requirePermission(ctx.principal, "masterdata.write", { propertyId: current.property_id });
  if (patch.linkedUnitId !== undefined) await checkLinkedUnit(ctx, current.property_id, patch.linkedUnitId);
  const customFields = patch.customFields ? await validateCustomFields(ctx, "unit", patch.customFields, current.custom_fields) : undefined;
  const values = definedOnly({
    building_id: patch.buildingId,
    number: patch.number,
    type: patch.type,
    floor: patch.floor,
    position: patch.position,
    description: patch.description,
    linked_unit_id: patch.linkedUnitId,
    custom_fields: customFields ? JSON.stringify(customFields) : undefined,
  });
  if (Object.keys(values).length > 0) await ctx.trx.updateTable("units").set(values).where("id", "=", id).execute();
  return getUnit(ctx, id);
}

export async function setUnitMeasure(ctx: Ctx, unitId: string, input: MeasureInput): Promise<Unit> {
  const unit = await loadUnitRow(ctx, unitId);
  requirePermission(ctx.principal, "masterdata.write", { propertyId: unit.property_id });
  await recordMeasure(ctx.trx, { tenantId: unit.tenant_id, propertyId: unit.property_id, unitId }, input);
  return getUnit(ctx, unitId);
}

export async function getUnitMeasureHistory(ctx: Ctx, unitId: string, measure?: MeasureKind): Promise<MeasureValue[]> {
  const unit = await loadUnitRow(ctx, unitId);
  requirePermission(ctx.principal, "masterdata.read", { propertyId: unit.property_id, unitId });
  return measureHistory(ctx.trx, unitId, measure);
}
