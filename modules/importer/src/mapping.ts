import { ENTITIES, type EntityKey, type FieldDef } from "./fields";
import { normalizeToken, similarity } from "./normalize";
import type { Sheet } from "./parse";

export interface ColumnSuggestion {
  header: string;
  field: string | null;
  confidence: number;
}

export interface SheetMapping {
  sheet: string;
  entity: EntityKey | null;
  /** header → field key (null = ignore column) */
  columns: Record<string, string | null>;
}

function fieldScore(header: string, field: FieldDef): number {
  const h = normalizeToken(header);
  if (!h) return 0;
  const candidates = [field.label, field.key, ...(field.synonyms ?? [])].map(normalizeToken);
  let best = 0;
  for (const c of candidates) {
    if (c === h) return 1;
    if (h.replace(/ /g, "") === c.replace(/ /g, "")) best = Math.max(best, 0.97);
    else if (c.length >= 4 && (h.startsWith(c) || h.endsWith(c))) best = Math.max(best, 0.8);
    else best = Math.max(best, similarity(h, c) >= 0.8 ? similarity(h, c) * 0.9 : 0);
  }
  return best;
}

/** Suggests a field per column; each field is used at most once (best match wins). */
export function suggestColumns(entity: EntityKey, headers: string[]): ColumnSuggestion[] {
  const fields = ENTITIES[entity].fields;
  const pairs: Array<{ header: string; field: string; score: number }> = [];
  for (const header of headers) for (const field of fields) pairs.push({ header, field: field.key, score: fieldScore(header, field) });
  pairs.sort((a, b) => b.score - a.score);
  const usedHeaders = new Map<string, { field: string; score: number }>();
  const usedFields = new Set<string>();
  for (const p of pairs) {
    if (p.score < 0.7 || usedHeaders.has(p.header) || usedFields.has(p.field)) continue;
    usedHeaders.set(p.header, { field: p.field, score: p.score });
    usedFields.add(p.field);
  }
  return headers.map((header) => {
    const hit = usedHeaders.get(header);
    return { header, field: hit?.field ?? null, confidence: hit ? Math.round(hit.score * 100) / 100 : 0 };
  });
}

/** Detects the entity of a sheet by its name, else by how many required fields its headers cover. */
export function detectEntity(sheet: Pick<Sheet, "baseName" | "headers">): { entity: EntityKey | null; confidence: number } {
  const name = normalizeToken(sheet.baseName);
  for (const def of Object.values(ENTITIES)) {
    if (def.names.some((n) => normalizeToken(n) === name || name.endsWith(` ${normalizeToken(n)}`) || name.startsWith(`${normalizeToken(n)} `))) {
      return { entity: def.key, confidence: 1 };
    }
  }
  let best: { entity: EntityKey | null; confidence: number } = { entity: null, confidence: 0 };
  for (const def of Object.values(ENTITIES)) {
    const suggestion = suggestColumns(def.key, sheet.headers);
    const mapped = new Set(suggestion.filter((s) => s.field).map((s) => s.field));
    const required = def.fields.filter((f) => f.required);
    const coverage = required.filter((f) => mapped.has(f.key)).length / required.length;
    const share = mapped.size / Math.max(1, sheet.headers.length);
    const score = coverage * 0.7 + share * 0.3;
    if (coverage === 1 && score > best.confidence) best = { entity: def.key, confidence: Math.round(score * 100) / 100 };
  }
  return best;
}

export function suggestMapping(sheet: Sheet): SheetMapping & { confidence: number; columnConfidence: Record<string, number> } {
  const { entity, confidence } = detectEntity(sheet);
  const columns: Record<string, string | null> = {};
  const columnConfidence: Record<string, number> = {};
  if (entity) {
    for (const s of suggestColumns(entity, sheet.headers)) {
      columns[s.header] = s.field;
      columnConfidence[s.header] = s.confidence;
    }
  } else {
    for (const h of sheet.headers) columns[h] = null;
  }
  return { sheet: sheet.name, entity, columns, confidence, columnConfidence };
}
