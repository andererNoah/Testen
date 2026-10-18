import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { NotFoundError } from "@hv/core";

/** Development login (ADR-0009). Registered only with AUTH_DEV_SECRET outside production. */
export const devRoutes: FastifyPluginAsyncZod = async (app) => {
  const issue = app.deps.auth.issueDevToken;
  if (!issue) return;

  app.get(
    "/dev/users",
    {
      config: { public: true },
      schema: {
        tags: ["Entwicklung"],
        summary: "Benutzer für den Entwicklungs-Login",
        response: { 200: z.object({ items: z.array(z.object({ email: z.string(), displayName: z.string(), tenantSlug: z.string(), tenantName: z.string(), roles: z.array(z.string()) })) }) },
      },
    },
    async () => {
      const rows = await app.deps.ownerDb
        .selectFrom("users as u")
        .innerJoin("tenants as t", "t.id", "u.tenant_id")
        .leftJoin("role_assignments as ra", "ra.user_id", "u.id")
        .leftJoin("roles as r", "r.id", "ra.role_id")
        .select(["u.email", "u.display_name", "t.slug", "t.name", "r.name as role_name"])
        .where("u.status", "=", "active")
        .orderBy("t.slug")
        .orderBy("u.display_name")
        .execute();
      const byUser = new Map<string, { email: string; displayName: string; tenantSlug: string; tenantName: string; roles: string[] }>();
      for (const r of rows) {
        const key = `${r.slug}:${r.email}`;
        const entry = byUser.get(key) ?? { email: r.email, displayName: r.display_name, tenantSlug: r.slug, tenantName: r.name, roles: [] };
        if (r.role_name && !entry.roles.includes(r.role_name)) entry.roles.push(r.role_name);
        byUser.set(key, entry);
      }
      return { items: [...byUser.values()] };
    },
  );

  app.post(
    "/dev/login",
    {
      config: { public: true, rateLimit: { max: 20, timeWindow: "1 minute" } },
      schema: {
        tags: ["Entwicklung"],
        summary: "Token für einen Benutzer ausstellen (nur Entwicklung)",
        body: z.object({ email: z.string().email(), tenantSlug: z.string() }),
        response: { 200: z.object({ token: z.string(), expiresIn: z.number() }) },
      },
    },
    async (request) => {
      const user = await app.deps.ownerDb
        .selectFrom("users as u")
        .innerJoin("tenants as t", "t.id", "u.tenant_id")
        .select(["u.id", "u.tenant_id"])
        .where("u.email", "=", request.body.email)
        .where("t.slug", "=", request.body.tenantSlug)
        .where("u.status", "=", "active")
        .executeTakeFirst();
      if (!user) throw new NotFoundError("Benutzer");
      return { token: await issue({ userId: user.id, tenantId: user.tenant_id }), expiresIn: 8 * 3600 };
    },
  );
};
