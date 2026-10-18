import { loadPrincipal } from "@hv/access";
import { withTenant, type Db } from "@hv/db";
import type { Ctx } from "@hv/masterdata";

export function runAs<T>(db: Db, tenantId: string, userId: string, fn: (ctx: Ctx) => Promise<T>, today = "2026-10-18"): Promise<T> {
  return withTenant(db, { tenantId, userId, requestId: "test" }, async (trx) => fn({ trx, principal: await loadPrincipal(trx, userId), today, requestId: "test" }));
}
