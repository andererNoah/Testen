import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as md from "@hv/masterdata";
import { runInTenant } from "../plugins/context";
import { list } from "./common";

export const settingsRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ["Einstellungen"];
  app.get(
    "/custom-fields",
    {
      schema: {
        tags,
        summary: "Eigene Felder (V18)",
        querystring: z.object({ entityType: z.enum(["property", "building", "unit", "person"]).optional() }),
        response: { 200: list(md.customFieldDefinition) },
      },
    },
    async (request) => ({ items: await runInTenant(request, (ctx) => md.listCustomFieldDefinitions(ctx, request.query.entityType)) }),
  );
  app.post(
    "/custom-fields",
    { schema: { tags, summary: "Eigenes Feld anlegen", body: md.customFieldDefinitionCreate, response: { 201: md.customFieldDefinition } } },
    async (request, reply) => reply.status(201).send(await runInTenant(request, (ctx) => md.createCustomFieldDefinition(ctx, request.body))),
  );
};
