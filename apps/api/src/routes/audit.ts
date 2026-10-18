import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requirePermission } from "@hv/access";
import { runInTenant } from "../plugins/context";

const entry = z.object({
  id: z.number(),
  occurredAt: z.string(),
  actorUserId: z.string().nullable(),
  actorName: z.string().nullable(),
  actorKind: z.string(),
  requestId: z.string().nullable(),
  table: z.string(),
  rowId: z.string().nullable(),
  action: z.string(),
  changedFields: z.array(z.string()).nullable(),
  oldData: z.record(z.string(), z.unknown()).nullable(),
  newData: z.record(z.string(), z.unknown()).nullable(),
});

export const auditRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/audit",
    {
      schema: {
        tags: ["Audit"],
        summary: "Audit-Log lesen (neueste zuerst, seitenweise über beforeId)",
        querystring: z.object({
          table: z.string().optional(),
          rowId: z.string().uuid().optional(),
          actorUserId: z.string().uuid().optional(),
          beforeId: z.coerce.number().int().positive().optional(),
          limit: z.coerce.number().int().min(1).max(200).default(50),
        }),
        response: { 200: z.object({ items: z.array(entry), nextBeforeId: z.number().nullable() }) },
      },
    },
    async (request) =>
      runInTenant(request, async (ctx) => {
        requirePermission(ctx.principal, "audit.read");
        const q = request.query;
        let query = ctx.trx
          .selectFrom("audit_log as a")
          .leftJoin("users as u", "u.id", "a.actor_user_id")
          .select([
            "a.id",
            "a.occurred_at",
            "a.actor_user_id",
            "u.display_name",
            "a.actor_kind",
            "a.request_id",
            "a.table_name",
            "a.row_id",
            "a.action",
            "a.changed_fields",
            "a.old_data",
            "a.new_data",
          ])
          .orderBy("a.id", "desc")
          .limit(q.limit + 1);
        if (q.table) query = query.where("a.table_name", "=", q.table);
        if (q.rowId) query = query.where("a.row_id", "=", q.rowId);
        if (q.actorUserId) query = query.where("a.actor_user_id", "=", q.actorUserId);
        if (q.beforeId) query = query.where("a.id", "<", q.beforeId);
        const rows = await query.execute();
        const page = rows.slice(0, q.limit);
        return {
          items: page.map((r) => ({
            id: r.id,
            occurredAt: r.occurred_at.toISOString(),
            actorUserId: r.actor_user_id,
            actorName: r.display_name,
            actorKind: r.actor_kind,
            requestId: r.request_id,
            table: r.table_name,
            rowId: r.row_id,
            action: r.action,
            changedFields: r.changed_fields,
            oldData: r.old_data,
            newData: r.new_data,
          })),
          nextBeforeId: rows.length > q.limit ? page.at(-1)!.id : null,
        };
      }),
  );
};
