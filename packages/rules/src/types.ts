import type { z } from "zod";

/** Calendar date in ISO format `YYYY-MM-DD`. */
export type IsoDate = string;

/**
 * - `in_kraft`: in force within its validity period
 * - `beschlossen`: enacted, validity starts in the future (applied once reached)
 * - `entwurf`: draft legislation, never applied automatically
 * - `deaktiviert`: switched off, never applied
 */
export type RuleStatus = "in_kraft" | "beschlossen" | "entwurf" | "deaktiviert";

export type RuleArea = "miete" | "weg" | "heizkosten" | "technik" | "steuer" | "datenschutz";

export interface RuleSource {
  label: string;
  norm?: string;
  url?: string;
}

export interface RuleVersion<P> {
  version: string;
  /** Inclusive start of validity. */
  validFrom: IsoDate;
  /** Exclusive end of validity; absent = open-ended. */
  validTo?: IsoDate;
  status: RuleStatus;
  summary: string;
  params: P;
  sources: RuleSource[];
  /** References into docs/recht-pruefen.md, e.g. "R-001". */
  rechtPruefen?: string[];
  /** Shown in the in-product legal changelog (V19). */
  changelog?: string;
}

export interface RuleDefinition<P = unknown> {
  key: string;
  title: string;
  area: RuleArea;
  description: string;
  /** Validates each version's params; the static type comes from `versions`. */
  paramsSchema: z.ZodType;
  versions: RuleVersion<P>[];
}

export interface ResolvedRule<P = unknown> {
  key: string;
  title: string;
  area: RuleArea;
  version: string;
  validFrom: IsoDate;
  validTo: IsoDate | null;
  status: RuleStatus;
  summary: string;
  params: P;
  sources: RuleSource[];
  rechtPruefen: string[];
}

export function defineRule<S extends z.ZodType>(definition: {
  key: string;
  title: string;
  area: RuleArea;
  description: string;
  paramsSchema: S;
  versions: RuleVersion<z.infer<S>>[];
}): RuleDefinition<z.infer<S>> {
  return definition;
}
