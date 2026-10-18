import { requirePermission } from "@hv/access";
import { ValidationError, type FieldIssue } from "@hv/core";
import type { CustomFieldEntity } from "@hv/db";
import { isValidDate } from "@hv/deadlines";
import type { Ctx } from "./context";
import type { CustomFieldDefinition, CustomFieldDefinitionCreate } from "./schemas";

export async function listCustomFieldDefinitions(ctx: Ctx, entityType?: CustomFieldEntity): Promise<CustomFieldDefinition[]> {
  let q = ctx.trx.selectFrom("custom_field_definitions").selectAll().orderBy("entity_type").orderBy("position").orderBy("label");
  if (entityType) q = q.where("entity_type", "=", entityType);
  const rows = await q.execute();
  return rows.map((r) => ({
    id: r.id,
    entityType: r.entity_type,
    key: r.key,
    label: r.label,
    fieldType: r.field_type,
    required: r.required,
    options: r.options,
    position: r.position,
  }));
}

export async function createCustomFieldDefinition(ctx: Ctx, input: CustomFieldDefinitionCreate): Promise<CustomFieldDefinition> {
  requirePermission(ctx.principal, "tenant.admin");
  const row = await ctx.trx
    .insertInto("custom_field_definitions")
    .values({
      tenant_id: ctx.principal.tenantId,
      entity_type: input.entityType,
      key: input.key,
      label: input.label,
      field_type: input.fieldType,
      required: input.required ?? false,
      options: JSON.stringify(input.options ?? []),
      position: input.position ?? 0,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return { id: row.id, entityType: row.entity_type, key: row.key, label: row.label, fieldType: row.field_type, required: row.required, options: row.options, position: row.position };
}

/**
 * Validates custom field values against the tenant's definitions (V18).
 * `existing` = current values (for updates); the result is the merged, validated object.
 */
export async function validateCustomFields(
  ctx: Ctx,
  entityType: CustomFieldEntity,
  values: Record<string, unknown> | undefined,
  existing: Record<string, unknown> = {},
): Promise<Record<string, unknown>> {
  const definitions = await listCustomFieldDefinitions(ctx, entityType);
  const merged: Record<string, unknown> = { ...existing, ...(values ?? {}) };
  const issues: FieldIssue[] = [];
  const known = new Map(definitions.map((d) => [d.key, d]));
  for (const key of Object.keys(values ?? {})) {
    if (!known.has(key)) issues.push({ path: `customFields.${key}`, message: "Unbekanntes eigenes Feld" });
  }
  for (const def of definitions) {
    const value = merged[def.key];
    const path = `customFields.${def.key}`;
    if (value === undefined || value === null || value === "") {
      if (def.required) issues.push({ path, message: `„${def.label}“ ist ein Pflichtfeld` });
      delete merged[def.key];
      continue;
    }
    switch (def.fieldType) {
      case "text":
        if (typeof value !== "string") issues.push({ path, message: `„${def.label}“ muss Text sein` });
        break;
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) issues.push({ path, message: `„${def.label}“ muss eine Zahl sein` });
        break;
      case "boolean":
        if (typeof value !== "boolean") issues.push({ path, message: `„${def.label}“ muss ja oder nein sein` });
        break;
      case "date":
        if (typeof value !== "string" || !isValidDate(value)) issues.push({ path, message: `„${def.label}“ muss ein Datum (JJJJ-MM-TT) sein` });
        break;
      case "select":
        if (typeof value !== "string" || !def.options.includes(value)) issues.push({ path, message: `„${def.label}“: erlaubt sind ${def.options.join(", ")}` });
        break;
    }
  }
  if (issues.length) throw new ValidationError("Eigene Felder sind ungültig.", issues);
  return merged;
}
