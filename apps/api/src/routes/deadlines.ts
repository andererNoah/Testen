import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { listDeadlines } from "@hv/masterdata";
import { runInTenant } from "../plugins/context";
import { deadline, list } from "./common";

export const deadlineRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/deadlines",
    {
      schema: {
        tags: ["Fristen"],
        summary: "Fristen aus Stammdaten und Regelkatalog, dringendste zuerst",
        querystring: z.object({ propertyId: z.string().uuid().optional(), status: z.enum(["ok", "warn", "critical", "overdue"]).optional() }),
        response: { 200: list(deadline) },
      },
    },
    async (request) => {
      const items = await runInTenant(request, (ctx) => listDeadlines(ctx, { propertyId: request.query.propertyId }));
      return { items: request.query.status ? items.filter((d) => d.status === request.query.status) : items };
    },
  );
};
