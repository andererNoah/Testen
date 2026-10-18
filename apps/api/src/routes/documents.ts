import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { ValidationError } from "@hv/core";
import * as docs from "@hv/documents";
import { runInTenant } from "../plugins/context";
import { idParam, list } from "./common";

async function readUpload(request: Parameters<typeof runInTenant>[0]): Promise<{ fields: Record<string, string>; file: { filename: string; data: Buffer } | null }> {
  if (!request.isMultipart()) throw new ValidationError("Bitte die Datei als multipart/form-data hochladen.");
  const fields: Record<string, string> = {};
  let file: { filename: string; data: Buffer } | null = null;
  for await (const part of request.parts()) {
    if (part.type === "file") {
      if (file) throw new ValidationError("Bitte nur eine Datei je Dokument hochladen.");
      file = { filename: part.filename, data: await part.toBuffer() };
    } else if (typeof part.value === "string") fields[part.fieldname] = part.value;
  }
  return { fields, file };
}

export const documentRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ["Dokumente"];
  const storage = app.deps.storage;

  app.get(
    "/documents",
    {
      schema: {
        tags,
        summary: "Dokumente einer Akte oder eines Objekts",
        querystring: z.object({
          entityType: docs.documentEntity.optional(),
          entityId: z.string().uuid().optional(),
          propertyId: z.string().uuid().optional(),
          category: docs.documentCategory.optional(),
          q: z.string().optional(),
        }),
        response: { 200: list(docs.document) },
      },
    },
    async (request) => ({ items: await runInTenant(request, (ctx) => docs.listDocuments(ctx, request.query)) }),
  );

  app.post(
    "/documents",
    {
      schema: {
        tags,
        summary: "Dokument ablegen",
        description: "multipart/form-data: Datei im Feld `file`, außerdem `title`, `category`, optional `documentDate` und `links` (JSON-Liste von {entityType, entityId}).",
        consumes: ["multipart/form-data"],
        response: { 201: docs.document },
      },
    },
    async (request, reply) => {
      const { fields, file } = await readUpload(request);
      if (!file) throw new ValidationError("Keine Datei hochgeladen.", [{ path: "file", message: "Pflichtfeld" }]);
      let links: unknown;
      try {
        links = JSON.parse(fields.links ?? "[]");
      } catch {
        throw new ValidationError("„links“ ist kein gültiges JSON.", [{ path: "links", message: "JSON-Liste erwartet" }]);
      }
      const parsed = docs.documentMeta.safeParse({ title: fields.title, category: fields.category, documentDate: fields.documentDate || null, links });
      if (!parsed.success) {
        throw new ValidationError("Einige Angaben zum Dokument fehlen oder sind ungültig.", parsed.error.issues.map((i) => ({ path: i.path.join("."), message: i.message })));
      }
      const result = await runInTenant(request, (ctx) => docs.uploadDocument(ctx, storage, parsed.data, file));
      return reply.status(201).send(result);
    },
  );

  app.get("/documents/:id", { schema: { tags, summary: "Dokument mit Versionen und Akten", params: idParam, response: { 200: docs.document } } }, async (request) =>
    runInTenant(request, (ctx) => docs.getDocument(ctx, request.params.id)),
  );

  app.get(
    "/documents/:id/content",
    { schema: { tags, summary: "Inhalt herunterladen (Prüfsumme wird geprüft)", params: idParam, querystring: z.object({ version: z.coerce.number().int().positive().optional() }) } },
    async (request, reply) => {
      const content = await runInTenant(request, (ctx) => docs.readDocumentContent(ctx, storage, request.params.id, request.query.version));
      return reply
        .header("content-type", content.mimeType)
        .header("content-disposition", `attachment; filename*=UTF-8''${encodeURIComponent(content.filename)}`)
        .header("x-content-type-options", "nosniff")
        .send(content.data);
    },
  );

  app.post(
    "/documents/:id/versions",
    { schema: { tags, summary: "Neue Version hochladen", params: idParam, consumes: ["multipart/form-data"], response: { 201: docs.document } } },
    async (request, reply) => {
      const { file } = await readUpload(request);
      if (!file) throw new ValidationError("Keine Datei hochgeladen.", [{ path: "file", message: "Pflichtfeld" }]);
      return reply.status(201).send(await runInTenant(request, (ctx) => docs.addDocumentVersion(ctx, storage, request.params.id, file)));
    },
  );

  app.post(
    "/documents/:id/links",
    { schema: { tags, summary: "Weitere Akte verknüpfen", params: idParam, body: docs.documentLinkInput, response: { 200: docs.document } } },
    async (request) => runInTenant(request, (ctx) => docs.linkDocument(ctx, request.params.id, request.body)),
  );

  app.delete(
    "/documents/:id/links/:linkId",
    { schema: { tags, summary: "Verknüpfung lösen", params: z.object({ id: z.string().uuid(), linkId: z.string().uuid() }), response: { 200: docs.document } } },
    async (request) => runInTenant(request, (ctx) => docs.unlinkDocument(ctx, request.params.id, request.params.linkId)),
  );

  app.delete(
    "/documents/:id",
    { schema: { tags, summary: "Dokument löschen (gesperrt während der Aufbewahrungsfrist)", params: idParam, response: { 200: docs.document } } },
    async (request) => runInTenant(request, (ctx) => docs.deleteDocument(ctx, request.params.id)),
  );
};
