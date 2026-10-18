import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { getDashboard, listDeadlines } from "@hv/masterdata";
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

export const dashboardRoutes: FastifyPluginAsyncZod = async (app) => {
  app.get(
    "/dashboard",
    {
      schema: {
        tags: ["Start"],
        summary: "Startseite: Kennzahlen, Fristen-Ampel, Vollständigkeit je Objekt",
        response: {
          200: z.object({
            counts: z.object({ properties: z.number(), units: z.number(), persons: z.number().nullable(), vacantUnits: z.number() }),
            deadlines: z.object({ ok: z.number(), warn: z.number(), critical: z.number(), overdue: z.number() }).nullable(),
            nextDeadlines: z.array(deadline),
            properties: z.array(
              z.object({
                id: z.string(),
                code: z.string(),
                name: z.string(),
                kind: z.string(),
                units: z.number(),
                completenessScore: z.number(),
                completenessTrafficLight: z.enum(["green", "yellow", "red"]),
              }),
            ),
          }),
        },
      },
    },
    async (request) => runInTenant(request, (ctx) => getDashboard(ctx)),
  );
};
