import { ValidationError } from "@hv/core";
import { sql, type MeasureKind, type Row, type Tx } from "@hv/db";
import type { IsoDate } from "@hv/deadlines";
import type { MeasureInput, MeasureValue } from "./schemas";

/**
 * Bitemporal write (ADR-0006). Rows overlapping the new validity period are superseded; the
 * parts outside the new period are re-recorded unchanged, so history stays reproducible.
 */
export async function recordMeasure(
  trx: Tx,
  unit: { tenantId: string; propertyId: string; unitId: string },
  input: MeasureInput,
): Promise<void> {
  const validTo = input.validTo ?? null;
  if (validTo !== null && validTo <= input.validFrom) {
    throw new ValidationError("Das Ende muss nach dem Beginn liegen.", [{ path: "validTo", message: "Ende nach Beginn" }]);
  }
  const overlapping = await trx
    .selectFrom("unit_measures")
    .selectAll()
    .where("unit_id", "=", unit.unitId)
    .where("measure", "=", input.measure)
    .where("superseded_at", "is", null)
    .where(sql<boolean>`daterange(valid_from, valid_to, '[)') && daterange(${input.validFrom}::date, ${validTo}::date, '[)')`)
    .forUpdate()
    .execute();

  if (overlapping.length > 0) {
    await trx
      .updateTable("unit_measures")
      .set({ superseded_at: sql`now()` })
      .where(
        "id",
        "in",
        overlapping.map((r) => r.id),
      )
      .execute();
  }

  const base = { tenant_id: unit.tenantId, property_id: unit.propertyId, unit_id: unit.unitId, measure: input.measure };
  const remnants = overlapping.flatMap((row) => {
    const parts: Array<{ value: string; valid_from: string; valid_to: string | null; source: string | null; note: string | null }> = [];
    if (row.valid_from < input.validFrom) {
      parts.push({ value: row.value, valid_from: row.valid_from, valid_to: input.validFrom, source: row.source, note: row.note });
    }
    if (validTo !== null && (row.valid_to === null || row.valid_to > validTo)) {
      parts.push({ value: row.value, valid_from: validTo, valid_to: row.valid_to, source: row.source, note: row.note });
    }
    return parts;
  });

  await trx
    .insertInto("unit_measures")
    .values([
      ...remnants.map((p) => ({ ...base, ...p })),
      { ...base, value: input.value, valid_from: input.validFrom, valid_to: validTo, source: input.source ?? null, note: input.note ?? null },
    ])
    .execute();
}

/** Values valid on `asOf`, optionally as known at `knownAt` (default: current knowledge). */
export async function measuresAsOf(trx: Tx, unitIds: string[], asOf: IsoDate, knownAt?: Date): Promise<Map<string, Partial<Record<MeasureKind, string>>>> {
  const result = new Map<string, Partial<Record<MeasureKind, string>>>();
  if (unitIds.length === 0) return result;
  let q = trx
    .selectFrom("unit_measures")
    .select(["unit_id", "measure", "value"])
    .where("unit_id", "in", unitIds)
    .where("valid_from", "<=", asOf)
    .where((eb) => eb.or([eb("valid_to", "is", null), eb("valid_to", ">", asOf)]));
  if (knownAt) {
    q = q.where("recorded_at", "<=", knownAt).where((eb) => eb.or([eb("superseded_at", "is", null), eb("superseded_at", ">", knownAt)]));
  } else {
    q = q.where("superseded_at", "is", null);
  }
  for (const row of await q.execute()) {
    const entry = result.get(row.unit_id) ?? {};
    entry[row.measure] = row.value;
    result.set(row.unit_id, entry);
  }
  return result;
}

function toMeasureValue(r: Row<"unit_measures">): MeasureValue {
  return {
    measure: r.measure,
    value: r.value,
    validFrom: r.valid_from,
    validTo: r.valid_to,
    recordedAt: r.recorded_at.toISOString(),
    supersededAt: r.superseded_at ? new Date(r.superseded_at).toISOString() : null,
    source: r.source,
    note: r.note,
  };
}

/** Full history including superseded rows, for the "Historie" view and audits. */
export async function measureHistory(trx: Tx, unitId: string, measure?: MeasureKind): Promise<MeasureValue[]> {
  let q = trx.selectFrom("unit_measures").selectAll().where("unit_id", "=", unitId).orderBy("measure").orderBy("valid_from").orderBy("recorded_at");
  if (measure) q = q.where("measure", "=", measure);
  return (await q.execute()).map(toMeasureValue);
}
