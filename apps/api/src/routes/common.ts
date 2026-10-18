import { z } from "zod";

export const idParam = z.object({ id: z.string().uuid() });
export const list = <T extends z.ZodType>(item: T) => z.object({ items: z.array(item) });

export const ruleSource = z.object({ label: z.string(), norm: z.string().optional(), url: z.string().optional() });

export const deadline = z.object({
  id: z.string(),
  kind: z.string(),
  title: z.string(),
  basis: z.string(),
  subject: z.object({ type: z.string(), id: z.string(), label: z.string() }),
  propertyId: z.string(),
  dueDate: z.string(),
  warnFrom: z.string(),
  criticalFrom: z.string(),
  businessDay: z.object({ date: z.string(), shifted: z.boolean(), reason: z.string().nullable() }),
  rule: z.object({ key: z.string(), version: z.string(), title: z.string(), sources: z.array(ruleSource), rechtPruefen: z.array(z.string()) }),
  status: z.enum(["ok", "warn", "critical", "overdue"]),
  trafficLight: z.enum(["green", "yellow", "red"]),
});

export const completeness = z.object({
  propertyId: z.string(),
  score: z.number(),
  trafficLight: z.enum(["green", "yellow", "red"]),
  checks: z.array(z.object({ key: z.string(), label: z.string(), ok: z.boolean(), severity: z.enum(["required", "recommended"]), detail: z.string().optional() })),
});

export const problem = z.object({
  type: z.string(),
  title: z.string(),
  status: z.number(),
  detail: z.string().optional(),
  code: z.string(),
  instance: z.string(),
  requestId: z.string(),
  issues: z.array(z.object({ path: z.string(), message: z.string() })).optional(),
});
