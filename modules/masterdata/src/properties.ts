import { ForbiddenError, hasTenantScope, requirePermission } from "@hv/access";
import { NotFoundError, ValidationError } from "@hv/core";
import type { PropertyKind } from "@hv/db";
import type { Ctx } from "./context";
import { validateCustomFields } from "./custom-fields";
import { definedOnly, toBuilding, toProperty } from "./mappers";
import type { Building, BuildingCreate, Property, PropertyCreate, PropertyUpdate } from "./schemas";

export interface PropertyFilter {
  kind?: PropertyKind;
  q?: string;
  includeArchived?: boolean;
}

export async function listProperties(ctx: Ctx, filter: PropertyFilter = {}): Promise<Property[]> {
  requirePermission(ctx.principal, "masterdata.read");
  let q = ctx.trx.selectFrom("properties").selectAll().orderBy("code");
  if (!filter.includeArchived) q = q.where("archived_at", "is", null);
  if (filter.kind) q = q.where("kind", "=", filter.kind);
  if (filter.q) {
    const term = `%${filter.q.trim()}%`;
    q = q.where((eb) => eb.or([eb("name", "ilike", term), eb("code", "ilike", term), eb("city", "ilike", term), eb("street", "ilike", term)]));
  }
  return (await q.execute()).map(toProperty);
}

export async function getProperty(ctx: Ctx, id: string): Promise<Property> {
  requirePermission(ctx.principal, "masterdata.read", { propertyId: id });
  const row = await ctx.trx.selectFrom("properties").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) throw new NotFoundError("Objekt", id);
  return toProperty(row);
}

function checkKindSpecific(kind: PropertyKind, input: Pick<PropertyCreate, "meaDenominator" | "votingPrinciple">) {
  if (kind === "rental" && (input.meaDenominator || input.votingPrinciple)) {
    throw new ValidationError("Mietobjekte haben keine Miteigentumsanteile und kein Stimmrecht.", [{ path: "meaDenominator", message: "Nur bei WEG und SEV" }]);
  }
}

export async function createProperty(ctx: Ctx, input: PropertyCreate): Promise<Property> {
  if (!hasTenantScope(ctx.principal, "masterdata.write")) {
    throw new ForbiddenError("masterdata.write");
  }
  checkKindSpecific(input.kind, input);
  const customFields = await validateCustomFields(ctx, "property", input.customFields);
  const row = await ctx.trx
    .insertInto("properties")
    .values({
      tenant_id: ctx.principal.tenantId,
      kind: input.kind,
      code: input.code,
      name: input.name,
      street: input.street ?? null,
      house_number: input.houseNumber ?? null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      mea_denominator: input.meaDenominator ?? null,
      voting_principle: input.votingPrinciple ?? (input.kind === "weg" ? "head" : null),
      settlement_period_start_month: input.settlementPeriodStartMonth ?? 1,
      custom_fields: JSON.stringify(customFields),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toProperty(row);
}

export async function updateProperty(ctx: Ctx, id: string, patch: PropertyUpdate): Promise<Property> {
  requirePermission(ctx.principal, "masterdata.write", { propertyId: id });
  const current = await getProperty(ctx, id);
  checkKindSpecific(current.kind, { meaDenominator: patch.meaDenominator ?? null, votingPrinciple: patch.votingPrinciple ?? null });
  const customFields = patch.customFields ? await validateCustomFields(ctx, "property", patch.customFields, current.customFields) : undefined;
  const values = definedOnly({
    code: patch.code,
    name: patch.name,
    street: patch.street,
    house_number: patch.houseNumber,
    postal_code: patch.postalCode,
    city: patch.city,
    state: patch.state,
    mea_denominator: patch.meaDenominator,
    voting_principle: patch.votingPrinciple,
    settlement_period_start_month: patch.settlementPeriodStartMonth,
    custom_fields: customFields ? JSON.stringify(customFields) : undefined,
  });
  if (Object.keys(values).length === 0) return current;
  const row = await ctx.trx.updateTable("properties").set(values).where("id", "=", id).returningAll().executeTakeFirst();
  if (!row) throw new NotFoundError("Objekt", id);
  return toProperty(row);
}

export async function archiveProperty(ctx: Ctx, id: string): Promise<Property> {
  requirePermission(ctx.principal, "masterdata.write", { propertyId: id });
  const row = await ctx.trx.updateTable("properties").set({ archived_at: new Date() }).where("id", "=", id).returningAll().executeTakeFirst();
  if (!row) throw new NotFoundError("Objekt", id);
  return toProperty(row);
}

// ---------- Buildings ----------

export async function listBuildings(ctx: Ctx, propertyId: string): Promise<Building[]> {
  requirePermission(ctx.principal, "masterdata.read", { propertyId });
  const rows = await ctx.trx.selectFrom("buildings").selectAll().where("property_id", "=", propertyId).orderBy("name").execute();
  return rows.map(toBuilding);
}

export async function createBuilding(ctx: Ctx, propertyId: string, input: BuildingCreate): Promise<Building> {
  requirePermission(ctx.principal, "masterdata.write", { propertyId });
  await getProperty(ctx, propertyId);
  const customFields = await validateCustomFields(ctx, "building", input.customFields);
  const row = await ctx.trx
    .insertInto("buildings")
    .values({
      tenant_id: ctx.principal.tenantId,
      property_id: propertyId,
      name: input.name,
      street: input.street ?? null,
      house_number: input.houseNumber ?? null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      year_built: input.yearBuilt ?? null,
      ...(input.usage ? { usage: input.usage } : {}),
      custom_fields: JSON.stringify(customFields),
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toBuilding(row);
}

export async function updateBuilding(ctx: Ctx, id: string, patch: Partial<BuildingCreate>): Promise<Building> {
  const current = await ctx.trx.selectFrom("buildings").selectAll().where("id", "=", id).executeTakeFirst();
  if (!current) throw new NotFoundError("Gebäude", id);
  requirePermission(ctx.principal, "masterdata.write", { propertyId: current.property_id });
  const customFields = patch.customFields ? await validateCustomFields(ctx, "building", patch.customFields, current.custom_fields) : undefined;
  const values = definedOnly({
    name: patch.name,
    street: patch.street,
    house_number: patch.houseNumber,
    postal_code: patch.postalCode,
    city: patch.city,
    year_built: patch.yearBuilt,
    usage: patch.usage,
    custom_fields: customFields ? JSON.stringify(customFields) : undefined,
  });
  if (Object.keys(values).length === 0) return toBuilding(current);
  const row = await ctx.trx.updateTable("buildings").set(values).where("id", "=", id).returningAll().executeTakeFirstOrThrow();
  return toBuilding(row);
}
