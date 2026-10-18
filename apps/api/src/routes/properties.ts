import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as md from "@hv/masterdata";
import { runInTenant } from "../plugins/context";
import { completeness, deadline, idParam, list } from "./common";

const asOfQuery = z.object({ asOf: md.isoDate.optional() });
const occupant = z.object({ personId: z.string(), displayName: z.string(), role: z.string(), share: z.string().nullable() });

export const propertyRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ["Stammdaten"];

  app.get(
    "/properties",
    {
      schema: {
        tags,
        summary: "Verwaltungsobjekte auflisten",
        querystring: z.object({ q: z.string().optional(), kind: md.propertyKind.optional(), includeArchived: z.coerce.boolean().optional() }),
        response: { 200: list(md.property) },
      },
    },
    async (request) => ({ items: await runInTenant(request, (ctx) => md.listProperties(ctx, request.query)) }),
  );

  app.post(
    "/properties",
    { schema: { tags, summary: "Verwaltungsobjekt anlegen", body: md.propertyCreate, response: { 201: md.property } } },
    async (request, reply) => reply.status(201).send(await runInTenant(request, (ctx) => md.createProperty(ctx, request.body))),
  );

  app.get("/properties/:id", { schema: { tags, summary: "Verwaltungsobjekt lesen", params: idParam, response: { 200: md.property } } }, async (request) =>
    runInTenant(request, (ctx) => md.getProperty(ctx, request.params.id)),
  );

  app.patch(
    "/properties/:id",
    { schema: { tags, summary: "Verwaltungsobjekt ändern", params: idParam, body: md.propertyUpdate, response: { 200: md.property } } },
    async (request) => runInTenant(request, (ctx) => md.updateProperty(ctx, request.params.id, request.body)),
  );

  app.post("/properties/:id/archive", { schema: { tags, summary: "Verwaltungsobjekt archivieren", params: idParam, response: { 200: md.property } } }, async (request) =>
    runInTenant(request, (ctx) => md.archiveProperty(ctx, request.params.id)),
  );

  app.get(
    "/properties/:id/overview",
    {
      schema: {
        tags,
        summary: "360°-Ansicht eines Objekts (V24)",
        params: idParam,
        response: {
          200: z.object({
            property: md.property,
            buildings: z.array(md.building),
            units: z.array(md.unit.extend({ occupants: z.array(occupant) })),
            assets: z.array(md.asset),
            meters: z.array(md.meter),
            deadlines: z.array(deadline),
            completeness,
            totals: z.object({ units: z.number(), livingArea: z.string(), usableArea: z.string(), meaSum: z.string() }),
          }),
        },
      },
    },
    async (request) => runInTenant(request, (ctx) => md.getPropertyOverview(ctx, request.params.id)),
  );

  app.get("/properties/:id/completeness", { schema: { tags, summary: "Vollständigkeitsampel (V29)", params: idParam, response: { 200: completeness } } }, async (request) =>
    runInTenant(request, (ctx) => md.getCompleteness(ctx, request.params.id)),
  );

  // ---------- Buildings ----------
  app.get("/properties/:id/buildings", { schema: { tags, summary: "Gebäude eines Objekts", params: idParam, response: { 200: list(md.building) } } }, async (request) => ({
    items: await runInTenant(request, (ctx) => md.listBuildings(ctx, request.params.id)),
  }));
  app.post(
    "/properties/:id/buildings",
    { schema: { tags, summary: "Gebäude anlegen", params: idParam, body: md.buildingCreate, response: { 201: md.building } } },
    async (request, reply) => reply.status(201).send(await runInTenant(request, (ctx) => md.createBuilding(ctx, request.params.id, request.body))),
  );
  app.patch(
    "/buildings/:id",
    { schema: { tags, summary: "Gebäude ändern", params: idParam, body: md.buildingUpdate, response: { 200: md.building } } },
    async (request) => runInTenant(request, (ctx) => md.updateBuilding(ctx, request.params.id, request.body)),
  );

  // ---------- Units ----------
  app.get(
    "/properties/:id/units",
    { schema: { tags, summary: "Einheiten eines Objekts mit Flächen zum Stichtag", params: idParam, querystring: asOfQuery, response: { 200: list(md.unit) } } },
    async (request) => ({ items: await runInTenant(request, (ctx) => md.listUnits(ctx, request.params.id, request.query.asOf ?? ctx.today)) }),
  );
  app.post(
    "/properties/:id/units",
    { schema: { tags, summary: "Einheit anlegen", params: idParam, body: md.unitCreate, response: { 201: md.unit } } },
    async (request, reply) => reply.status(201).send(await runInTenant(request, (ctx) => md.createUnit(ctx, request.params.id, request.body))),
  );
  app.get("/units/:id", { schema: { tags, summary: "Einheit lesen", params: idParam, querystring: asOfQuery, response: { 200: md.unit } } }, async (request) =>
    runInTenant(request, (ctx) => md.getUnit(ctx, request.params.id, request.query.asOf ?? ctx.today)),
  );
  app.patch("/units/:id", { schema: { tags, summary: "Einheit ändern", params: idParam, body: md.unitUpdate, response: { 200: md.unit } } }, async (request) =>
    runInTenant(request, (ctx) => md.updateUnit(ctx, request.params.id, request.body)),
  );
  app.get(
    "/units/:id/measures",
    {
      schema: {
        tags,
        summary: "Historie der Flächen und Anteile (bitemporal)",
        params: idParam,
        querystring: z.object({ measure: md.measureKind.optional() }),
        response: { 200: list(md.measureValue) },
      },
    },
    async (request) => ({ items: await runInTenant(request, (ctx) => md.getUnitMeasureHistory(ctx, request.params.id, request.query.measure)) }),
  );
  app.post(
    "/units/:id/measures",
    { schema: { tags, summary: "Fläche oder Anteil mit Gültigkeit erfassen (auch rückwirkend)", params: idParam, body: md.measureInput, response: { 200: md.unit } } },
    async (request) => runInTenant(request, (ctx) => md.setUnitMeasure(ctx, request.params.id, request.body)),
  );

  // ---------- Technical assets and meters ----------
  app.get("/properties/:id/assets", { schema: { tags, summary: "Anlagen eines Objekts", params: idParam, response: { 200: list(md.asset) } } }, async (request) => ({
    items: await runInTenant(request, (ctx) => md.listAssets(ctx, request.params.id)),
  }));
  app.post(
    "/properties/:id/assets",
    { schema: { tags, summary: "Anlage anlegen", params: idParam, body: md.assetCreate, response: { 201: md.asset } } },
    async (request, reply) => reply.status(201).send(await runInTenant(request, (ctx) => md.createAsset(ctx, request.params.id, request.body))),
  );
  app.patch("/assets/:id", { schema: { tags, summary: "Anlage ändern", params: idParam, body: md.assetUpdate, response: { 200: md.asset } } }, async (request) =>
    runInTenant(request, (ctx) => md.updateAsset(ctx, request.params.id, request.body)),
  );
  app.get("/properties/:id/meters", { schema: { tags, summary: "Zähler eines Objekts", params: idParam, response: { 200: list(md.meter) } } }, async (request) => ({
    items: await runInTenant(request, (ctx) => md.listMeters(ctx, request.params.id)),
  }));
  app.post(
    "/properties/:id/meters",
    { schema: { tags, summary: "Zähler anlegen", params: idParam, body: md.meterCreate, response: { 201: md.meter } } },
    async (request, reply) => reply.status(201).send(await runInTenant(request, (ctx) => md.createMeter(ctx, request.params.id, request.body))),
  );
  app.patch("/meters/:id", { schema: { tags, summary: "Zähler ändern", params: idParam, body: md.meterUpdate, response: { 200: md.meter } } }, async (request) =>
    runInTenant(request, (ctx) => md.updateMeter(ctx, request.params.id, request.body)),
  );
};
