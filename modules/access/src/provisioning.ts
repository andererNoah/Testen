import type { Db, ScopeType, Tx } from "@hv/db";
import { ROLE_TEMPLATES } from "./role-templates";
import { isPermission } from "./permissions";

export interface ProvisionTenantInput {
  name: string;
  slug: string;
  admin: { email: string; displayName: string };
}

export interface ProvisionedTenant {
  tenantId: string;
  adminUserId: string;
  roleIds: Record<string, string>;
}

/**
 * Creates a tenant with the role templates and a first admin. Platform operation:
 * runs on the owner connection (no tenant context exists yet).
 */
export async function provisionTenant(ownerDb: Db, input: ProvisionTenantInput): Promise<ProvisionedTenant> {
  return ownerDb.transaction().execute(async (trx) => {
    const tenant = await trx.insertInto("tenants").values({ name: input.name, slug: input.slug }).returning("id").executeTakeFirstOrThrow();
    const roleIds: Record<string, string> = {};
    for (const template of ROLE_TEMPLATES) {
      const role = await trx
        .insertInto("roles")
        .values({
          tenant_id: tenant.id,
          key: template.key,
          name: template.name,
          description: template.description,
          permissions: template.permissions,
          is_system: true,
        })
        .returning("id")
        .executeTakeFirstOrThrow();
      roleIds[template.key] = role.id;
    }
    const admin = await trx
      .insertInto("users")
      .values({ tenant_id: tenant.id, email: input.admin.email, display_name: input.admin.displayName })
      .returning("id")
      .executeTakeFirstOrThrow();
    await trx
      .insertInto("role_assignments")
      .values({ tenant_id: tenant.id, user_id: admin.id, role_id: roleIds.tenant_admin!, scope_type: "tenant", scope_id: null })
      .execute();
    return { tenantId: tenant.id, adminUserId: admin.id, roleIds };
  });
}

export interface CreateUserInput {
  email: string;
  displayName: string;
  personId?: string | null;
}

/** Inside a tenant transaction (requires tenant scope per RLS; tenant.admin per caller). */
export async function createUser(trx: Tx, tenantId: string, input: CreateUserInput): Promise<string> {
  const user = await trx
    .insertInto("users")
    .values({ tenant_id: tenantId, email: input.email, display_name: input.displayName, person_id: input.personId ?? null })
    .returning("id")
    .executeTakeFirstOrThrow();
  return user.id;
}

export interface AssignRoleInput {
  userId: string;
  roleKey: string;
  scopeType: ScopeType;
  scopeId?: string | null;
  validFrom?: string;
  validTo?: string | null;
}

export async function assignRole(trx: Tx, tenantId: string, input: AssignRoleInput): Promise<string> {
  const role = await trx.selectFrom("roles").select("id").where("key", "=", input.roleKey).executeTakeFirst();
  if (!role) throw new Error(`Unbekannte Rolle „${input.roleKey}“`);
  const row = await trx
    .insertInto("role_assignments")
    .values({
      tenant_id: tenantId,
      user_id: input.userId,
      role_id: role.id,
      scope_type: input.scopeType,
      scope_id: input.scopeType === "tenant" ? null : (input.scopeId ?? null),
      ...(input.validFrom ? { valid_from: input.validFrom } : {}),
      valid_to: input.validTo ?? null,
    })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}

export async function createRole(trx: Tx, tenantId: string, input: { key: string; name: string; permissions: string[]; description?: string }): Promise<string> {
  const invalid = input.permissions.filter((p) => !isPermission(p));
  if (invalid.length) throw new Error(`Unbekannte Berechtigungen: ${invalid.join(", ")}`);
  const row = await trx
    .insertInto("roles")
    .values({ tenant_id: tenantId, key: input.key, name: input.name, permissions: input.permissions, description: input.description ?? null })
    .returning("id")
    .executeTakeFirstOrThrow();
  return row.id;
}
