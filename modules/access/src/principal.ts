import { ForbiddenError as DomainForbiddenError } from "@hv/core";
import type { ScopeType, Tx } from "@hv/db";
import { PERMISSIONS, isPermission, type Permission } from "./permissions";

export interface Assignment {
  roleKey: string;
  roleName: string;
  permissions: Permission[];
  scopeType: ScopeType;
  scopeId: string | null;
  /** For unit scope: the unit's property. */
  propertyId: string | null;
}

export interface Principal {
  userId: string;
  tenantId: string;
  email: string;
  displayName: string;
  personId: string | null;
  assignments: Assignment[];
}

export interface Target {
  propertyId?: string | null;
  unitId?: string | null;
}

export class ForbiddenError extends DomainForbiddenError {
  override name = "ForbiddenError";
  constructor(
    readonly permission: Permission,
    readonly target?: Target,
  ) {
    super(`Dafür fehlt Ihnen die Berechtigung „${PERMISSIONS[permission]}“ in diesem Bereich.`, { permission, target });
  }
}

export class UnknownUserError extends DomainForbiddenError {
  override name = "UnknownUserError";
  constructor() {
    super("Ihr Zugang ist unbekannt oder gesperrt. Bitte wenden Sie sich an Ihre Verwaltung.");
  }
}

/**
 * Application-level check (layer 2 of docs/rechtekonzept.md). Without a target it answers
 * "does the user hold this permission anywhere?" — row filtering is then left to RLS.
 */
export function can(principal: Principal, permission: Permission, target?: Target): boolean {
  return principal.assignments.some((a) => {
    if (!a.permissions.includes(permission)) return false;
    if (!target || (!target.propertyId && !target.unitId)) return true;
    switch (a.scopeType) {
      case "tenant":
        return true;
      case "property":
        return target.propertyId != null && a.scopeId === target.propertyId;
      case "unit":
        return target.unitId != null ? a.scopeId === target.unitId : a.propertyId === target.propertyId;
    }
  });
}

export function requirePermission(principal: Principal, permission: Permission, target?: Target): void {
  if (!can(principal, permission, target)) throw new ForbiddenError(permission, target);
}

export function hasTenantScope(principal: Principal, permission?: Permission): boolean {
  return principal.assignments.some((a) => a.scopeType === "tenant" && (!permission || a.permissions.includes(permission)));
}

/** Loads the principal inside a tenant transaction (reads go through RLS). */
export async function loadPrincipal(trx: Tx, userId: string): Promise<Principal> {
  const user = await trx
    .selectFrom("users")
    .select(["id", "tenant_id", "email", "display_name", "person_id", "status"])
    .where("id", "=", userId)
    .executeTakeFirst();
  if (!user || user.status !== "active") throw new UnknownUserError();

  const rows = await trx
    .selectFrom("role_assignments as ra")
    .innerJoin("roles as r", "r.id", "ra.role_id")
    .leftJoin("units as u", (join) => join.onRef("u.id", "=", "ra.scope_id").on("ra.scope_type", "=", "unit"))
    .select(["r.key", "r.name", "r.permissions", "ra.scope_type", "ra.scope_id", "u.property_id"])
    .where("ra.user_id", "=", userId)
    .where("ra.valid_from", "<=", new Date().toISOString().slice(0, 10))
    .where((eb) => eb.or([eb("ra.valid_to", "is", null), eb("ra.valid_to", ">", new Date().toISOString().slice(0, 10))]))
    .execute();

  return {
    userId: user.id,
    tenantId: user.tenant_id,
    email: user.email,
    displayName: user.display_name,
    personId: user.person_id,
    assignments: rows.map((r) => ({
      roleKey: r.key,
      roleName: r.name,
      permissions: r.permissions.filter(isPermission),
      scopeType: r.scope_type,
      scopeId: r.scope_id,
      propertyId: r.scope_type === "property" ? r.scope_id : (r.property_id ?? null),
    })),
  };
}
