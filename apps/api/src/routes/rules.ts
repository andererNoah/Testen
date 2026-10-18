import type { FastifyPluginAsyncZod } from "fastify-type-provider-zod";
import { z } from "zod";
import { requirePermission } from "@hv/access";
import { NotFoundError } from "@hv/core";
import { isoDate } from "@hv/masterdata";
import { rules } from "@hv/rules";
import { runInTenant } from "../plugins/context";
import { list, ruleSource } from "./common";

const version = z.object({
  version: z.string(),
  validFrom: z.string(),
  validTo: z.string().nullable(),
  status: z.enum(["in_kraft", "beschlossen", "entwurf", "deaktiviert"]),
  summary: z.string(),
  params: z.unknown(),
  sources: z.array(ruleSource),
  rechtPruefen: z.array(z.string()),
  changelog: z.string().nullable(),
});

const rule = z.object({
  key: z.string(),
  title: z.string(),
  area: z.string(),
  description: z.string(),
  /** Version applicable on `asOf`, or null. */
  current: version.nullable(),
  versions: z.array(version),
});

type Def = ReturnType<typeof rules.list>[number];

function toRule(def: Def, asOf: string) {
  const versions = def.versions.map((v) => ({
    version: v.version,
    validFrom: v.validFrom,
    validTo: v.validTo ?? null,
    status: v.status,
    summary: v.summary,
    params: v.params,
    sources: v.sources,
    rechtPruefen: v.rechtPruefen ?? [],
    changelog: v.changelog ?? null,
  }));
  const resolved = rules.tryResolve(def.key as Parameters<typeof rules.tryResolve>[0], asOf);
  return { key: def.key, title: def.title, area: def.area, description: def.description, current: versions.find((v) => v.version === resolved?.version) ?? null, versions };
}

export const ruleRoutes: FastifyPluginAsyncZod = async (app) => {
  const tags = ["Regeln"];
  const guard = (request: Parameters<typeof runInTenant>[0]) => runInTenant(request, async (ctx) => (requirePermission(ctx.principal, "rules.read"), ctx.today));

  app.get(
    "/rules",
    {
      schema: {
        tags,
        summary: "Regelkatalog mit der zum Stichtag gültigen Version",
        querystring: z.object({ asOf: isoDate.optional(), area: z.string().optional() }),
        response: { 200: list(rule) },
      },
    },
    async (request) => {
      const today = await guard(request);
      const asOf = request.query.asOf ?? today;
      return { items: rules.list().filter((d) => !request.query.area || d.area === request.query.area).map((d) => toRule(d, asOf)) };
    },
  );

  app.get(
    "/rules/changelog",
    {
      schema: {
        tags,
        summary: "Rechtsänderungs-Changelog (V19)",
        response: { 200: list(z.object({ key: z.string(), title: z.string(), version: z.string(), validFrom: z.string(), status: z.string(), text: z.string() })) },
      },
    },
    async (request) => {
      await guard(request);
      return { items: rules.changelog() };
    },
  );

  app.get(
    "/rules/:key",
    { schema: { tags, summary: "Eine Regel mit allen Versionen", params: z.object({ key: z.string() }), querystring: z.object({ asOf: isoDate.optional() }), response: { 200: rule } } },
    async (request) => {
      const today = await guard(request);
      if (!rules.has(request.params.key)) throw new NotFoundError("Regel", request.params.key);
      return toRule(rules.definition(request.params.key) as Def, request.query.asOf ?? today);
    },
  );
};
