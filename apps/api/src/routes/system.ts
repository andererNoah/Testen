import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { PERMISSIONS, hasTenantScope } from "@hv/access";
import { sql } from "@hv/db";
import { runInTenant } from "../plugins/context";

export const systemRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/health",
    {
      config: { public: true },
      schema: { tags: ["System"], summary: "Betriebsbereitschaft", response: { 200: z.object({ status: z.literal("ok"), database: z.literal("ok") }) } },
    },
    async () => {
      await sql`SELECT 1`.execute(app.deps.appDb);
      return { status: "ok" as const, database: "ok" as const };
    },
  );

  app.get(
    "/me",
    {
      schema: {
        tags: ["System"],
        summary: "Angemeldeter Benutzer, Mandant und Rechte",
        response: {
          200: z.object({
            user: z.object({ id: z.string(), email: z.string(), displayName: z.string(), personId: z.string().nullable() }),
            tenant: z.object({ id: z.string(), name: z.string(), slug: z.string(), modules: z.array(z.string()) }),
            assignments: z.array(z.object({ roleKey: z.string(), roleName: z.string(), scopeType: z.string(), scopeId: z.string().nullable() })),
            permissions: z.array(z.string()),
            hasTenantScope: z.boolean(),
          }),
        },
      },
    },
    async (request) =>
      runInTenant(request, async (ctx) => {
        const tenant = await ctx.trx.selectFrom("tenants").select(["id", "name", "slug", "modules"]).executeTakeFirstOrThrow();
        const p = ctx.principal;
        return {
          user: { id: p.userId, email: p.email, displayName: p.displayName, personId: p.personId },
          tenant,
          assignments: p.assignments.map((a) => ({ roleKey: a.roleKey, roleName: a.roleName, scopeType: a.scopeType, scopeId: a.scopeId })),
          permissions: [...new Set(p.assignments.flatMap((a) => a.permissions))].sort(),
          hasTenantScope: hasTenantScope(p),
        };
      }),
  );

  app.get(
    "/permissions",
    { schema: { tags: ["System"], summary: "Katalog der Berechtigungen", response: { 200: z.object({ items: z.array(z.object({ key: z.string(), label: z.string() })) }) } } },
    async () => ({ items: Object.entries(PERMISSIONS).map(([key, label]) => ({ key, label })) }),
  );
};
