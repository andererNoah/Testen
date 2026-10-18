import { sql, type Kysely, type Transaction } from "kysely";
import type { Database } from "./schema";

export type ActorKind = "user" | "system" | "import";

export interface TenantContext {
  tenantId: string;
  /** null for system jobs */
  userId: string | null;
  actorKind?: ActorKind;
  requestId?: string;
}

export type Tx = Transaction<Database>;

/**
 * Runs `fn` in one transaction with the tenant context set (ADR-0003). RLS policies and the
 * audit trigger read these settings; they are transaction-local and vanish on commit/rollback.
 */
export async function withTenant<T>(db: Kysely<Database>, ctx: TenantContext, fn: (trx: Tx) => Promise<T>): Promise<T> {
  return db.transaction().execute(async (trx) => {
    await setTenantContext(trx, ctx);
    return fn(trx);
  });
}

export async function setTenantContext(trx: Tx, ctx: TenantContext): Promise<void> {
  await sql`SELECT
      set_config('app.tenant_id', ${ctx.tenantId}, true),
      set_config('app.user_id', ${ctx.userId ?? ""}, true),
      set_config('app.actor_kind', ${ctx.actorKind ?? (ctx.userId ? "user" : "system")}, true),
      set_config('app.request_id', ${ctx.requestId ?? ""}, true)`.execute(trx);
}

/** Marker error to roll back a transaction on purpose (e.g. import dry run). */
export class RollbackSignal<T> extends Error {
  override name = "RollbackSignal";
  constructor(readonly result: T) {
    super("Absichtlicher Rollback");
  }
}

/** Like withTenant, but always rolls back and returns the result (dry run / sandbox). */
export async function dryRunWithTenant<T>(db: Kysely<Database>, ctx: TenantContext, fn: (trx: Tx) => Promise<T>): Promise<T> {
  try {
    await withTenant(db, ctx, async (trx) => {
      throw new RollbackSignal(await fn(trx));
    });
  } catch (error) {
    if (error instanceof RollbackSignal) return error.result as T;
    throw error;
  }
  throw new Error("unreachable");
}
