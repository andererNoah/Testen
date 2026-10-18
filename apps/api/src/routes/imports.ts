import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requirePermission } from "@hv/access";
import { ValidationError } from "@hv/core";
import * as imp from "@hv/importer";
import { runInTenant } from "../plugins/context";
import { idParam, list } from "./common";

const entityKey = z.enum(["properties", "buildings", "units", "persons", "roles", "assets", "meters"]);
const counts = z.object({ created: z.number(), updated: z.number(), unchanged: z.number(), failed: z.number() });
const report = z.object({
  ok: z.boolean(),
  dryRun: z.boolean(),
  counts: z.record(z.string(), counts),
  errors: z.number(),
  warnings: z.number(),
  issues: z.array(
    z.object({
      severity: z.enum(["error", "warning"]),
      sheet: z.string().optional(),
      row: z.number().optional(),
      column: z.string().optional(),
      field: z.string().optional(),
      message: z.string(),
    }),
  ),
  durationMs: z.number(),
});
const sourceFile = z.object({ filename: z.string(), size: z.number(), sha256: z.string(), encoding: z.string().optional() });
const jobBase = {
  id: z.string(),
  status: z.enum(["analyzed", "validated", "committed", "failed"]),
  source: z.string(),
  createdAt: z.string(),
  committedAt: z.string().nullable(),
  sourceFiles: z.array(sourceFile),
  report: report.nullable(),
  summary: report.nullable(),
};
const job = z.object({
  ...jobBase,
  sheets: z.array(
    z.object({
      name: z.string(),
      entity: entityKey.nullable(),
      entityConfidence: z.number(),
      headers: z.array(z.string()),
      rowCount: z.number(),
      sampleRows: z.array(z.array(z.string())),
      columns: z.record(z.string(), z.string().nullable()),
      columnConfidence: z.record(z.string(), z.number()),
    }),
  ),
});

export const importRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ["Import"];

  app.get(
    "/imports/fields",
    {
      schema: {
        tags,
        summary: "Datenarten und Felder der Importvorlage",
        response: {
          200: list(
            z.object({
              key: entityKey,
              label: z.string(),
              fields: z.array(z.object({ key: z.string(), label: z.string(), type: z.string(), required: z.boolean(), hint: z.string().nullable() })),
            }),
          ),
        },
      },
    },
    async () => ({
      items: imp.ENTITY_ORDER.map((key) => ({
        key,
        label: imp.ENTITIES[key].label,
        fields: imp.ENTITIES[key].fields.map((f) => ({ key: f.key, label: f.label, type: f.type, required: f.required ?? false, hint: f.hint ?? null })),
      })),
    }),
  );

  app.get("/imports/template.xlsx", { schema: { tags, summary: "Importvorlage herunterladen (XLSX)" } }, async (request, reply) => {
    await runInTenant(request, async (ctx) => requirePermission(ctx.principal, "import.run"));
    const buffer = await imp.buildTemplateWorkbook();
    return reply
      .header("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
      .header("content-disposition", 'attachment; filename="importvorlage.xlsx"')
      .send(buffer);
  });

  app.get("/imports", { schema: { tags, summary: "Letzte Importe", response: { 200: list(z.object(jobBase)) } } }, async (request) => ({
    items: await runInTenant(request, (ctx) => imp.listImportJobs(ctx)),
  }));

  app.post(
    "/imports",
    {
      schema: {
        tags,
        summary: "Dateien hochladen und analysieren (Schritt 1)",
        description: "multipart/form-data mit einer oder mehreren CSV-/XLSX-Dateien im Feld `files` und optional `source` (Name des Altsystems).",
        consumes: ["multipart/form-data"],
        response: { 201: job },
      },
    },
    async (request, reply) => {
      if (!request.isMultipart()) throw new ValidationError("Bitte Dateien als multipart/form-data hochladen.");
      const files: imp.UploadedFile[] = [];
      let source: string | undefined;
      for await (const part of request.parts()) {
        if (part.type === "file") files.push({ filename: part.filename, data: await part.toBuffer() });
        else if (part.fieldname === "source" && typeof part.value === "string") source = part.value;
      }
      const result = await runInTenant(request, (ctx) => imp.createImportJob(ctx, files, { source }));
      return reply.status(201).send(result);
    },
  );

  app.get("/imports/:id", { schema: { tags, summary: "Import lesen", params: idParam, response: { 200: job } } }, async (request) =>
    runInTenant(request, (ctx) => imp.getImportJob(ctx, request.params.id)),
  );

  app.put(
    "/imports/:id/mapping",
    {
      schema: {
        tags,
        summary: "Zuordnung von Tabellen und Spalten korrigieren (Schritt 2)",
        params: idParam,
        body: z.object({ sheets: z.array(z.object({ sheet: z.string(), entity: entityKey.nullable(), columns: z.record(z.string(), z.string().nullable()) })) }),
        response: { 200: job },
      },
    },
    async (request) => runInTenant(request, (ctx) => imp.updateImportMapping(ctx, request.params.id, request.body.sheets)),
  );

  app.post(
    "/imports/:id/validate",
    { schema: { tags, summary: "Validierungsbericht mit Probeimport (Schritt 3)", params: idParam, response: { 200: job } } },
    async (request) => runInTenant(request, (ctx) => imp.validateImportJob(ctx, request.params.id)),
  );

  app.post(
    "/imports/:id/commit",
    { schema: { tags, summary: "Import übernehmen (Schritt 4, alles oder nichts)", params: idParam, response: { 200: job } } },
    async (request) => runInTenant(request, (ctx) => imp.commitImportJob(ctx, request.params.id), { actorKind: "import" }),
  );
};
