import type { IsoDate, ResolvedRule, RuleDefinition, RuleStatus, RuleVersion } from "./types";

export class RuleNotApplicableError extends Error {
  override name = "RuleNotApplicableError";
  constructor(
    readonly key: string,
    readonly asOf: IsoDate,
  ) {
    super(`Für Regel „${key}“ gibt es zum Stichtag ${asOf} keine anwendbare Version.`);
  }
}

export class UnknownRuleError extends Error {
  override name = "UnknownRuleError";
  constructor(readonly key: string) {
    super(`Unbekannte Regel „${key}“.`);
  }
}

export interface ResolveOptions {
  /** Also consider `entwurf` versions, e.g. for "what if" previews. Never use for real calculations. */
  includeDrafts?: boolean;
}

export interface CatalogIssue {
  key: string;
  version?: string;
  problem: string;
}

export interface ChangelogEntry {
  key: string;
  title: string;
  version: string;
  validFrom: IsoDate;
  status: RuleStatus;
  text: string;
}

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function covers(version: RuleVersion<unknown>, asOf: IsoDate): boolean {
  return version.validFrom <= asOf && (version.validTo === undefined || asOf < version.validTo);
}

function applicable(version: RuleVersion<unknown>, options: ResolveOptions): boolean {
  if (version.status === "deaktiviert") return false;
  if (version.status === "entwurf") return options.includeDrafts === true;
  return true;
}

function overlaps(a: RuleVersion<unknown>, b: RuleVersion<unknown>): boolean {
  const aEnd = a.validTo ?? "9999-12-31";
  const bEnd = b.validTo ?? "9999-12-31";
  return a.validFrom < bEnd && b.validFrom < aEnd;
}

function toResolved<P>(definition: RuleDefinition<P>, version: RuleVersion<P>): ResolvedRule<P> {
  return {
    key: definition.key,
    title: definition.title,
    area: definition.area,
    version: version.version,
    validFrom: version.validFrom,
    validTo: version.validTo ?? null,
    status: version.status,
    summary: version.summary,
    params: version.params,
    sources: version.sources,
    rechtPruefen: version.rechtPruefen ?? [],
  };
}

type ParamsOf<C, K extends keyof C> = C[K] extends RuleDefinition<infer P> ? P : never;

export function createRuleEngine<C extends Record<string, RuleDefinition<unknown>>>(catalog: C) {
  function definition<K extends keyof C & string>(key: K): C[K] {
    const def = catalog[key];
    if (!def) throw new UnknownRuleError(key);
    return def;
  }

  function tryResolve<K extends keyof C & string>(
    key: K,
    asOf: IsoDate,
    options: ResolveOptions = {},
  ): ResolvedRule<ParamsOf<C, K>> | undefined {
    if (!isValidIsoDate(asOf)) throw new RangeError(`Ungültiger Stichtag: ${asOf}`);
    const def = definition(key);
    const matches = def.versions.filter((v) => covers(v, asOf) && applicable(v, options));
    if (matches.length === 0) return undefined;
    // Drafts only win when explicitly requested and no enacted version overlaps.
    const chosen = matches.find((v) => v.status !== "entwurf") ?? matches[0]!;
    return toResolved(def, chosen) as ResolvedRule<ParamsOf<C, K>>;
  }

  function resolve<K extends keyof C & string>(key: K, asOf: IsoDate, options: ResolveOptions = {}): ResolvedRule<ParamsOf<C, K>> {
    const resolved = tryResolve(key, asOf, options);
    if (!resolved) throw new RuleNotApplicableError(key, asOf);
    return resolved;
  }

  function list(): RuleDefinition<unknown>[] {
    return Object.values(catalog);
  }

  function has(key: string): key is keyof C & string {
    return Object.hasOwn(catalog, key);
  }

  /** All versions with a changelog text, newest validity first (V19). */
  function changelog(): ChangelogEntry[] {
    return list()
      .flatMap((def) =>
        def.versions
          .filter((v) => v.changelog)
          .map((v) => ({ key: def.key, title: def.title, version: v.version, validFrom: v.validFrom, status: v.status, text: v.changelog! })),
      )
      .sort((a, b) => (a.validFrom < b.validFrom ? 1 : a.validFrom > b.validFrom ? -1 : a.key.localeCompare(b.key)));
  }

  function validate(): CatalogIssue[] {
    const issues: CatalogIssue[] = [];
    for (const [mapKey, def] of Object.entries(catalog)) {
      if (mapKey !== def.key) issues.push({ key: mapKey, problem: `Katalogschlüssel weicht vom Regelschlüssel „${def.key}“ ab` });
      if (def.versions.length === 0) issues.push({ key: def.key, problem: "Regel ohne Version" });
      const seen = new Set<string>();
      for (const v of def.versions) {
        const at = { key: def.key, version: v.version };
        if (seen.has(v.version)) issues.push({ ...at, problem: "Versionsnummer doppelt" });
        seen.add(v.version);
        if (!isValidIsoDate(v.validFrom)) issues.push({ ...at, problem: `validFrom ungültig: ${v.validFrom}` });
        if (v.validTo !== undefined && !isValidIsoDate(v.validTo)) issues.push({ ...at, problem: `validTo ungültig: ${v.validTo}` });
        if (v.validTo !== undefined && v.validTo <= v.validFrom) issues.push({ ...at, problem: "validTo liegt nicht nach validFrom" });
        if (v.sources.length === 0) issues.push({ ...at, problem: "Version ohne Quellenangabe" });
        for (const id of v.rechtPruefen ?? []) {
          if (!/^R-\d{3}$/.test(id)) issues.push({ ...at, problem: `Ungültiger RECHT-PRÜFEN-Verweis: ${id}` });
        }
        const parsed = def.paramsSchema.safeParse(v.params);
        if (!parsed.success) issues.push({ ...at, problem: `Parameter passen nicht zum Schema: ${parsed.error.message}` });
      }
      const enacted = def.versions.filter((v) => v.status === "in_kraft" || v.status === "beschlossen");
      for (let i = 0; i < enacted.length; i++) {
        for (let j = i + 1; j < enacted.length; j++) {
          if (overlaps(enacted[i]!, enacted[j]!)) {
            issues.push({ key: def.key, problem: `Gültigkeiten von ${enacted[i]!.version} und ${enacted[j]!.version} überlappen` });
          }
        }
      }
    }
    return issues;
  }

  return { catalog, definition, resolve, tryResolve, list, has, changelog, validate };
}

export type RuleEngine<C extends Record<string, RuleDefinition<unknown>>> = ReturnType<typeof createRuleEngine<C>>;
