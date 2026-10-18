import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import * as md from "@hv/masterdata";
import { runInTenant } from "../plugins/context";
import { idParam, list } from "./common";

export const personRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ["Personen"];

  app.get(
    "/persons",
    {
      schema: {
        tags,
        summary: "Personen suchen",
        querystring: z.object({ q: z.string().optional(), propertyId: z.string().uuid().optional(), role: md.personRoleKind.optional(), limit: z.coerce.number().int().min(1).max(1000).optional() }),
        response: { 200: list(md.person) },
      },
    },
    async (request) => ({ items: await runInTenant(request, (ctx) => md.listPersons(ctx, request.query)) }),
  );

  app.post(
    "/persons",
    {
      schema: {
        tags,
        summary: "Person anlegen (mit Dublettenprüfung)",
        description: "Antwortet mit 409 und `candidates`, wenn die Person vermutlich schon existiert. Mit `ignoreDuplicates: true` bewusst neu anlegen.",
        body: md.personCreate,
        response: { 201: md.person },
      },
    },
    async (request, reply) => reply.status(201).send(await runInTenant(request, (ctx) => md.createPerson(ctx, request.body))),
  );

  app.post(
    "/persons/duplicates",
    { schema: { tags, summary: "Mögliche Dubletten finden, ohne anzulegen", body: md.personCreate, response: { 200: list(md.duplicateCandidate) } } },
    async (request) => ({ items: await runInTenant(request, (ctx) => md.checkPersonDuplicates(ctx, request.body)) }),
  );

  app.get("/persons/:id", { schema: { tags, summary: "Person lesen (Zugriff wird protokolliert)", params: idParam, response: { 200: md.person } } }, async (request) =>
    runInTenant(request, (ctx) => md.getPerson(ctx, request.params.id)),
  );

  app.patch("/persons/:id", { schema: { tags, summary: "Person ändern", params: idParam, body: md.personUpdate, response: { 200: md.person } } }, async (request) =>
    runInTenant(request, (ctx) => md.updatePerson(ctx, request.params.id, request.body)),
  );

  app.post(
    "/persons/:id/roles",
    { schema: { tags, summary: "Rolle an Objekt oder Einheit vergeben", params: idParam, body: md.personRoleCreate, response: { 201: md.personRole } } },
    async (request, reply) => reply.status(201).send(await runInTenant(request, (ctx) => md.addPersonRole(ctx, request.params.id, request.body))),
  );

  app.post(
    "/person-roles/:id/end",
    { schema: { tags, summary: "Rolle beenden (z. B. Auszug)", params: idParam, body: z.object({ validTo: md.isoDate }), response: { 200: md.personRole } } },
    async (request) => runInTenant(request, (ctx) => md.endPersonRole(ctx, request.params.id, request.body.validTo)),
  );

  app.post(
    "/persons/:id/merge",
    {
      schema: {
        tags,
        summary: "Person in eine andere zusammenführen (V29)",
        params: idParam,
        body: z.object({ targetId: z.string().uuid() }),
        response: { 200: md.person },
      },
    },
    async (request) => runInTenant(request, (ctx) => md.mergePersons(ctx, request.params.id, request.body.targetId)),
  );
};
