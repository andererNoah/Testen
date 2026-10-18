import { ForbiddenError, hasTenantScope, requirePermission } from "@hv/access";
import { ConflictError, NotFoundError, ValidationError } from "@hv/core";
import type { PersonRoleKind, Row } from "@hv/db";
import type { Ctx } from "./context";
import { validateCustomFields } from "./custom-fields";
import { findDuplicateCandidates } from "./duplicates";
import { definedOnly, toPerson, toPersonRole } from "./mappers";
import { personPhoneticKey } from "./phonetics";
import type { DuplicateCandidate, Person, PersonCreate, PersonRole, PersonRoleCreate, PersonUpdate } from "./schemas";

export interface PersonFilter {
  q?: string;
  propertyId?: string;
  role?: PersonRoleKind;
  limit?: number;
}

async function rolesFor(ctx: Ctx, personIds: string[]): Promise<Map<string, Row<"person_roles">[]>> {
  const map = new Map<string, Row<"person_roles">[]>();
  if (personIds.length === 0) return map;
  const rows = await ctx.trx.selectFrom("person_roles").selectAll().where("person_id", "in", personIds).orderBy("valid_from").execute();
  for (const r of rows) map.set(r.person_id, [...(map.get(r.person_id) ?? []), r]);
  return map;
}

export async function listPersons(ctx: Ctx, filter: PersonFilter = {}): Promise<Person[]> {
  requirePermission(ctx.principal, "persons.read", filter.propertyId ? { propertyId: filter.propertyId } : undefined);
  let q = ctx.trx.selectFrom("persons").selectAll().where("merged_into_id", "is", null).orderBy("last_name").orderBy("company_name").orderBy("first_name");
  if (filter.q) {
    const term = `%${filter.q.trim()}%`;
    q = q.where((eb) =>
      eb.or([eb("last_name", "ilike", term), eb("first_name", "ilike", term), eb("company_name", "ilike", term), eb("email", "ilike", term), eb("city", "ilike", term)]),
    );
  }
  if (filter.propertyId || filter.role) {
    q = q.where("id", "in", (eb) => {
      let sub = eb.selectFrom("person_roles").select("person_id");
      if (filter.propertyId) sub = sub.where("property_id", "=", filter.propertyId);
      if (filter.role) sub = sub.where("role", "=", filter.role);
      return sub;
    });
  }
  const rows = await q.limit(Math.min(filter.limit ?? 200, 1000)).execute();
  const roles = await rolesFor(
    ctx,
    rows.map((r) => r.id),
  );
  return rows.map((r) => toPerson(r, roles.get(r.id)));
}

export async function getPerson(ctx: Ctx, id: string): Promise<Person> {
  requirePermission(ctx.principal, "persons.read");
  const row = await ctx.trx.selectFrom("persons").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) throw new NotFoundError("Person", id);
  // Reads of personal data are logged (docs/rechtekonzept.md, Protokollierung).
  await ctx.trx
    .insertInto("access_log")
    .values({ tenant_id: ctx.principal.tenantId, user_id: ctx.principal.userId, entity_type: "person", entity_id: id, action: "read", request_id: ctx.requestId ?? null })
    .execute();
  const roles = await rolesFor(ctx, [id]);
  return toPerson(row, roles.get(id));
}

export async function checkPersonDuplicates(ctx: Ctx, input: PersonCreate | (PersonUpdate & { kind: "natural" | "legal" }), excludeId?: string): Promise<DuplicateCandidate[]> {
  requirePermission(ctx.principal, "persons.read");
  return findDuplicateCandidates(ctx.trx, input, excludeId);
}

export class DuplicatePersonError extends ConflictError {
  override name = "DuplicatePersonError";
  constructor(readonly candidates: DuplicateCandidate[]) {
    super("Diese Person ist vermutlich schon erfasst. Prüfen Sie die Vorschläge oder legen Sie bewusst neu an.", { candidates });
  }
}

export async function createPerson(ctx: Ctx, input: PersonCreate): Promise<Person> {
  requirePermission(ctx.principal, "persons.write");
  if (!input.ignoreDuplicates) {
    const candidates = await findDuplicateCandidates(ctx.trx, input);
    if (candidates.length > 0) throw new DuplicatePersonError(candidates);
  }
  const customFields = await validateCustomFields(ctx, "person", input.customFields);
  const row = await ctx.trx
    .insertInto("persons")
    .values({
      tenant_id: ctx.principal.tenantId,
      kind: input.kind,
      salutation: input.salutation ?? null,
      title: input.title ?? null,
      first_name: input.firstName ?? null,
      last_name: input.lastName ?? null,
      company_name: input.companyName ?? null,
      birth_date: input.birthDate ?? null,
      email: input.email ?? null,
      phone: input.phone ?? null,
      mobile: input.mobile ?? null,
      street: input.street ?? null,
      house_number: input.houseNumber ?? null,
      postal_code: input.postalCode ?? null,
      city: input.city ?? null,
      ...(input.country ? { country: input.country } : {}),
      ...(input.communicationPreference ? { communication_preference: input.communicationPreference } : {}),
      iban: input.iban ?? null,
      notes: input.notes ?? null,
      phonetic_key: personPhoneticKey(input),
      custom_fields: JSON.stringify(customFields),
      created_by: ctx.principal.userId,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toPerson(row);
}

async function loadPersonRow(ctx: Ctx, id: string): Promise<Row<"persons">> {
  const row = await ctx.trx.selectFrom("persons").selectAll().where("id", "=", id).executeTakeFirst();
  if (!row) throw new NotFoundError("Person", id);
  return row;
}

export async function updatePerson(ctx: Ctx, id: string, patch: PersonUpdate): Promise<Person> {
  requirePermission(ctx.principal, "persons.write");
  const current = await loadPersonRow(ctx, id);
  const customFields = patch.customFields ? await validateCustomFields(ctx, "person", patch.customFields, current.custom_fields) : undefined;
  const merged = {
    kind: current.kind,
    lastName: patch.lastName !== undefined ? patch.lastName : current.last_name,
    firstName: patch.firstName !== undefined ? patch.firstName : current.first_name,
    companyName: patch.companyName !== undefined ? patch.companyName : current.company_name,
  };
  if (current.kind === "natural" && !merged.lastName) throw new ValidationError("Nachname fehlt.", [{ path: "lastName", message: "Pflichtfeld" }]);
  if (current.kind === "legal" && !merged.companyName) throw new ValidationError("Firmenname fehlt.", [{ path: "companyName", message: "Pflichtfeld" }]);
  const values = definedOnly({
    salutation: patch.salutation,
    title: patch.title,
    first_name: patch.firstName,
    last_name: patch.lastName,
    company_name: patch.companyName,
    birth_date: patch.birthDate,
    email: patch.email,
    phone: patch.phone,
    mobile: patch.mobile,
    street: patch.street,
    house_number: patch.houseNumber,
    postal_code: patch.postalCode,
    city: patch.city,
    country: patch.country,
    communication_preference: patch.communicationPreference,
    iban: patch.iban,
    notes: patch.notes,
    custom_fields: customFields ? JSON.stringify(customFields) : undefined,
  });
  if (Object.keys(values).length === 0) return getPerson(ctx, id);
  const row = await ctx.trx
    .updateTable("persons")
    .set({ ...values, phonetic_key: personPhoneticKey(merged) })
    .where("id", "=", id)
    .returningAll()
    .executeTakeFirst();
  if (!row) throw new NotFoundError("Person", id);
  const roles = await rolesFor(ctx, [id]);
  return toPerson(row, roles.get(id));
}

export async function addPersonRole(ctx: Ctx, personId: string, input: PersonRoleCreate): Promise<PersonRole> {
  requirePermission(ctx.principal, "persons.write", { propertyId: input.propertyId });
  await loadPersonRow(ctx, personId);
  if (input.unitId) {
    const unit = await ctx.trx.selectFrom("units").select("property_id").where("id", "=", input.unitId).executeTakeFirst();
    if (!unit || unit.property_id !== input.propertyId) {
      throw new ValidationError("Die Einheit gehört nicht zu diesem Objekt.", [{ path: "unitId", message: "Einheit passt nicht zum Objekt" }]);
    }
  }
  const row = await ctx.trx
    .insertInto("person_roles")
    .values({
      tenant_id: ctx.principal.tenantId,
      person_id: personId,
      role: input.role,
      property_id: input.propertyId,
      unit_id: input.unitId ?? null,
      valid_from: input.validFrom ?? null,
      valid_to: input.validTo ?? null,
      share: input.share ?? null,
      note: input.note ?? null,
    })
    .returningAll()
    .executeTakeFirstOrThrow();
  return toPersonRole(row);
}

/** Ends a role (e.g. tenant moves out). The role row stays for history. */
export async function endPersonRole(ctx: Ctx, roleId: string, validTo: string): Promise<PersonRole> {
  const role = await ctx.trx.selectFrom("person_roles").selectAll().where("id", "=", roleId).executeTakeFirst();
  if (!role) throw new NotFoundError("Rolle", roleId);
  requirePermission(ctx.principal, "persons.write", { propertyId: role.property_id });
  if (role.valid_from && validTo <= role.valid_from) throw new ValidationError("Das Ende muss nach dem Beginn liegen.", [{ path: "validTo", message: "Ende nach Beginn" }]);
  const row = await ctx.trx.updateTable("person_roles").set({ valid_to: validTo }).where("id", "=", roleId).returningAll().executeTakeFirstOrThrow();
  return toPersonRole(row);
}

/**
 * Merges `sourceId` into `targetId` (V29): roles move to the target, missing contact data is
 * taken over, and the source stays as a reference (`merged_into_id`) so its history remains.
 */
export async function mergePersons(ctx: Ctx, sourceId: string, targetId: string): Promise<Person> {
  // Merging touches roles in all objects and user links: tenant-wide scope required.
  if (!hasTenantScope(ctx.principal, "persons.write")) throw new ForbiddenError("persons.write");
  if (sourceId === targetId) throw new ValidationError("Eine Person kann nicht mit sich selbst zusammengeführt werden.");
  const source = await loadPersonRow(ctx, sourceId);
  const target = await loadPersonRow(ctx, targetId);
  if (source.merged_into_id) throw new ConflictError("Diese Person wurde bereits zusammengeführt.");
  await ctx.trx.updateTable("person_roles").set({ person_id: targetId }).where("person_id", "=", sourceId).execute();
  await ctx.trx.updateTable("users").set({ person_id: targetId }).where("person_id", "=", sourceId).execute();
  const fill = definedOnly({
    email: target.email ? undefined : (source.email ?? undefined),
    phone: target.phone ? undefined : (source.phone ?? undefined),
    mobile: target.mobile ? undefined : (source.mobile ?? undefined),
    iban: target.iban ? undefined : (source.iban ?? undefined),
    birth_date: target.birth_date ? undefined : (source.birth_date ?? undefined),
    street: target.street ? undefined : (source.street ?? undefined),
    house_number: target.house_number ? undefined : (source.house_number ?? undefined),
    postal_code: target.postal_code ? undefined : (source.postal_code ?? undefined),
    city: target.city ? undefined : (source.city ?? undefined),
  });
  if (Object.keys(fill).length) await ctx.trx.updateTable("persons").set(fill).where("id", "=", targetId).execute();
  await ctx.trx
    .updateTable("persons")
    .set({ merged_into_id: targetId, notes: [source.notes, `Zusammengeführt in ${targetId}`].filter(Boolean).join("\n") })
    .where("id", "=", sourceId)
    .execute();
  return getPerson(ctx, targetId);
}
