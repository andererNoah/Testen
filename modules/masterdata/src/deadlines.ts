import { requirePermission } from "@hv/access";
import {
  completedSettlementPeriods,
  evaluate,
  isFederalState,
  legionellaDeadline,
  meterDeadlines,
  operatingCostStatementDeadline,
  smokeDetectorDeadline,
  type Deadline,
  type EvaluatedDeadline,
  type FederalState,
} from "@hv/deadlines";
import type { Ctx } from "./context";

const STATUS_ORDER = { overdue: 0, critical: 1, warn: 2, ok: 3 } as const;

/**
 * Fristen-Engine (V-Zielwert: kein gesetzlicher Stichtag läuft ohne Vorwarnung ab).
 * Derived on the fly from master data and the rule catalog; nothing is stored, so a rule
 * update takes effect immediately.
 */
export type PropertyDeadline = EvaluatedDeadline & { propertyLabel: string };

export async function listDeadlines(ctx: Ctx, filter: { propertyId?: string } = {}): Promise<PropertyDeadline[]> {
  requirePermission(ctx.principal, "deadlines.read", filter.propertyId ? { propertyId: filter.propertyId } : undefined);
  let pq = ctx.trx.selectFrom("properties").selectAll().where("archived_at", "is", null);
  if (filter.propertyId) pq = pq.where("id", "=", filter.propertyId);
  const properties = await pq.execute();
  if (properties.length === 0) return [];
  const ids = properties.map((p) => p.id);
  const [assets, meters] = await Promise.all([
    ctx.trx.selectFrom("technical_assets").selectAll().where("property_id", "in", ids).execute(),
    ctx.trx.selectFrom("meters").selectAll().where("property_id", "in", ids).execute(),
  ]);

  const result: Deadline[] = [];
  for (const p of properties) {
    const state: FederalState | undefined = p.state && isFederalState(p.state) ? p.state : undefined;
    const label = `${p.code} ${p.name}`;
    if (p.kind === "rental" || p.kind === "sev") {
      // Latest completed period always; the one before only while its deadline is still open.
      // Phase 1 closes a deadline once the statement is marked as delivered.
      completedSettlementPeriods(p.settlement_period_start_month, ctx.today, 2).forEach((period, index) => {
        const d = operatingCostStatementDeadline({ propertyId: p.id, propertyLabel: label, periodStart: period.start, periodEnd: period.end, state });
        if (index === 0 || d.dueDate >= ctx.today) result.push(d);
      });
    }
    for (const a of assets.filter((x) => x.property_id === p.id)) {
      const attrs = a.attributes as Record<string, unknown>;
      if (a.kind === "drinking_water") {
        const d = legionellaDeadline({
          propertyId: p.id,
          assetId: a.id,
          assetLabel: a.name,
          lastInspectionOn: a.last_inspection_on,
          // Conservative defaults: showers and letting are assumed unless explicitly denied;
          // a missing "Großanlage" flag is reported by the completeness check instead.
          largeSystem: attrs.largeSystem === true,
          showersOrAerosol: attrs.showersOrAerosol !== false,
          commercialActivity: attrs.commercialActivity !== false,
          today: ctx.today,
          state,
        });
        if (d) result.push(d);
      }
      if (a.kind === "smoke_detectors") {
        const d = smokeDetectorDeadline({ propertyId: p.id, assetId: a.id, assetLabel: a.name, lastMaintenanceOn: a.last_inspection_on, today: ctx.today, state });
        if (d) result.push(d);
      }
    }
    for (const m of meters.filter((x) => x.property_id === p.id)) {
      result.push(
        ...meterDeadlines({
          propertyId: p.id,
          meter: {
            id: m.id,
            label: m.serial_number,
            kind: m.kind,
            remoteReadable: m.remote_readable,
            interoperable: m.interoperable,
            calibrationValidUntil: m.calibration_valid_until,
          },
          today: ctx.today,
          state,
        }),
      );
    }
  }
  const labels = new Map(properties.map((p) => [p.id, `${p.code} ${p.name}`]));
  return result
    .map((d) => ({ ...evaluate(d, ctx.today), propertyLabel: labels.get(d.propertyId) ?? "" }))
    .sort((a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.dueDate.localeCompare(b.dueDate) || a.id.localeCompare(b.id));
}
