import { rules, type ResolvedRule, type RuleKey, type RuleSource } from "@hv/rules";
import { addDays, addMonthsClamped, formatDate, formatGerman, parseDate, type IsoDate } from "./dates";
import { periodEnd, shiftToBusinessDay, type BusinessDayShift } from "./bgb";
import type { FederalState } from "./holidays";
import { deadlineStatus, trafficLight, type DeadlineStatus, type TrafficLight } from "./status";

export type DeadlineKind =
  | "operating_cost_statement"
  | "legionella_test"
  | "smoke_detector_maintenance"
  | "meter_remote_retrofit"
  | "meter_interoperability"
  | "meter_calibration";

export interface DeadlineRuleRef {
  key: string;
  version: string;
  title: string;
  sources: RuleSource[];
  rechtPruefen: string[];
}

export interface Deadline {
  /** Deterministic: same facts → same id. */
  id: string;
  kind: DeadlineKind;
  title: string;
  /** How the date was derived, in plain German. */
  basis: string;
  subject: { type: "property" | "technical_asset" | "meter"; id: string; label: string };
  propertyId: string;
  dueDate: IsoDate;
  warnFrom: IsoDate;
  criticalFrom: IsoDate;
  /** § 193 BGB shift, information only. */
  businessDay: BusinessDayShift;
  rule: DeadlineRuleRef;
}

export interface EvaluatedDeadline extends Deadline {
  status: DeadlineStatus;
  trafficLight: TrafficLight;
}

function ruleRef(rule: ResolvedRule<unknown>): DeadlineRuleRef {
  return { key: rule.key, version: rule.version, title: rule.title, sources: rule.sources, rechtPruefen: rule.rechtPruefen };
}

function make(
  base: Omit<Deadline, "id" | "businessDay" | "rule">,
  rule: ResolvedRule<unknown>,
  state: FederalState | undefined,
): Deadline {
  return {
    ...base,
    id: `${base.kind}:${base.subject.id}:${base.dueDate}`,
    businessDay: shiftToBusinessDay(base.dueDate, state),
    rule: ruleRef(rule),
  };
}

export function evaluate(deadline: Deadline, today: IsoDate): EvaluatedDeadline {
  const status = deadlineStatus(deadline, today);
  return { ...deadline, status, trafficLight: trafficLight(status) };
}

function resolve<K extends RuleKey>(key: K, asOf: IsoDate) {
  return rules.resolve(key, asOf);
}

/** Settlement periods (12 months starting in `startMonth`) that ended on or before `today`, newest first. */
export function completedSettlementPeriods(startMonth: number, today: IsoDate, count = 2): { start: IsoDate; end: IsoDate }[] {
  if (!Number.isInteger(startMonth) || startMonth < 1 || startMonth > 12) throw new RangeError("Startmonat 1–12");
  const { year, month } = parseDate(today);
  // Latest period start such that start + 12 months - 1 day < today
  let startYear = month >= startMonth ? year : year - 1;
  let start = formatDate({ year: startYear, month: startMonth, day: 1 });
  let end = addDays(addMonthsClamped(start, 12), -1);
  while (end >= today) {
    startYear -= 1;
    start = formatDate({ year: startYear, month: startMonth, day: 1 });
    end = addDays(addMonthsClamped(start, 12), -1);
  }
  const result: { start: IsoDate; end: IsoDate }[] = [];
  for (let i = 0; i < count; i++) {
    const s = formatDate({ year: startYear - i, month: startMonth, day: 1 });
    result.push({ start: s, end: addDays(addMonthsClamped(s, 12), -1) });
  }
  return result;
}

export function operatingCostStatementDeadline(input: {
  propertyId: string;
  propertyLabel: string;
  periodStart: IsoDate;
  periodEnd: IsoDate;
  state?: FederalState;
}): Deadline {
  const rule = resolve("bgb.556.abrechnungsfrist", input.periodEnd);
  const p = rule.params;
  const due = periodEnd(input.periodEnd, { months: p.monthsAfterPeriodEnd });
  return make(
    {
      kind: "operating_cost_statement",
      title: `Betriebskostenabrechnung ${formatGerman(input.periodStart)}–${formatGerman(input.periodEnd)} zustellen`,
      basis: `Ende des Abrechnungszeitraums ${formatGerman(input.periodEnd)} + ${p.monthsAfterPeriodEnd} Monate; Zugang beim Mieter maßgeblich`,
      subject: { type: "property", id: input.propertyId, label: input.propertyLabel },
      propertyId: input.propertyId,
      dueDate: due,
      warnFrom: periodEnd(input.periodEnd, { months: p.warnAfterMonths }),
      criticalFrom: periodEnd(input.periodEnd, { months: p.criticalAfterMonths }),
    },
    rule,
    input.state,
  );
}

export function legionellaDeadline(input: {
  propertyId: string;
  assetId: string;
  assetLabel: string;
  lastInspectionOn: IsoDate | null;
  largeSystem: boolean;
  showersOrAerosol: boolean;
  commercialActivity: boolean;
  today: IsoDate;
  state?: FederalState;
}): Deadline | null {
  const rule = resolve("trinkwv.31.legionellen", input.today);
  const p = rule.params;
  const required =
    (!p.requiresLargeSystem || input.largeSystem) &&
    (!p.requiresShowersOrAerosol || input.showersOrAerosol) &&
    (!p.requiresCommercialActivity || input.commercialActivity);
  if (!required) return null;
  const due = input.lastInspectionOn ? periodEnd(input.lastInspectionOn, { years: p.intervalYears }) : input.today;
  return make(
    {
      kind: "legionella_test",
      title: "Legionellenprüfung",
      basis: input.lastInspectionOn
        ? `Letzte Prüfung ${formatGerman(input.lastInspectionOn)} + ${p.intervalYears} Jahre`
        : "Untersuchungspflicht besteht, aber keine Prüfung erfasst",
      subject: { type: "technical_asset", id: input.assetId, label: input.assetLabel },
      propertyId: input.propertyId,
      dueDate: due,
      warnFrom: addMonthsClamped(due, -p.warnMonthsBefore),
      criticalFrom: addMonthsClamped(due, -1),
    },
    rule,
    input.state,
  );
}

export function smokeDetectorDeadline(input: {
  propertyId: string;
  assetId: string;
  assetLabel: string;
  lastMaintenanceOn: IsoDate | null;
  today: IsoDate;
  state?: FederalState;
}): Deadline | null {
  const rule = resolve("lbo.rauchwarnmelder", input.today);
  const p = rule.params;
  if (input.state && !p.states.includes(input.state)) return null;
  const due = input.lastMaintenanceOn ? periodEnd(input.lastMaintenanceOn, { months: p.maintenanceIntervalMonths }) : input.today;
  return make(
    {
      kind: "smoke_detector_maintenance",
      title: "Wartung Rauchwarnmelder",
      basis: input.lastMaintenanceOn
        ? `Letzte Wartung ${formatGerman(input.lastMaintenanceOn)} + ${p.maintenanceIntervalMonths} Monate`
        : "Keine Wartung erfasst",
      subject: { type: "technical_asset", id: input.assetId, label: input.assetLabel },
      propertyId: input.propertyId,
      dueDate: due,
      warnFrom: addMonthsClamped(due, -p.warnMonthsBefore),
      criticalFrom: addDays(due, -14),
    },
    rule,
    input.state,
  );
}

export type MeterKind = "heat" | "hot_water" | "cold_water" | "gas" | "electricity" | "hcd";

export interface MeterFacts {
  id: string;
  label: string;
  kind: MeterKind;
  remoteReadable: boolean;
  interoperable: boolean;
  calibrationValidUntil: IsoDate | null;
}

export function meterDeadlines(input: { propertyId: string; meter: MeterFacts; today: IsoDate; state?: FederalState }): Deadline[] {
  const { meter } = input;
  const result: Deadline[] = [];
  const subject = { type: "meter" as const, id: meter.id, label: meter.label };
  const heating = resolve("heizkv.5.fernablesbarkeit", input.today);
  const hp = heating.params;
  const affected = (hp.affectedMeterKinds as string[]).includes(meter.kind);

  if (affected && !meter.remoteReadable) {
    const due = hp.retrofitDeadline;
    result.push(
      make(
        {
          kind: "meter_remote_retrofit",
          title: "Zähler auf Fernablesung umrüsten",
          basis: `Nicht fernablesbar; Nachrüstpflicht bis ${formatGerman(due)}, sonst Kürzungsrecht ${hp.reductionPercent} %`,
          subject,
          propertyId: input.propertyId,
          dueDate: due,
          warnFrom: addMonthsClamped(due, -6),
          criticalFrom: addMonthsClamped(due, -2),
        },
        heating,
        input.state,
      ),
    );
  }
  if (affected && meter.remoteReadable && !meter.interoperable) {
    const due = hp.interoperabilityDeadline;
    result.push(
      make(
        {
          kind: "meter_interoperability",
          title: "Interoperabilität des Zählers herstellen",
          basis: `Fernablesbar, aber nicht interoperabel; Frist ${formatGerman(due)}`,
          subject,
          propertyId: input.propertyId,
          dueDate: due,
          warnFrom: addMonthsClamped(due, -12),
          criticalFrom: addMonthsClamped(due, -3),
        },
        heating,
        input.state,
      ),
    );
  }
  if (meter.kind !== "hcd" && meter.calibrationValidUntil) {
    const calibration = resolve("messev.eichfristen", input.today);
    const due = meter.calibrationValidUntil;
    result.push(
      make(
        {
          kind: "meter_calibration",
          title: "Eichfrist läuft ab: Zähler tauschen",
          basis: `Eichgültigkeit bis ${formatGerman(due)}`,
          subject,
          propertyId: input.propertyId,
          dueDate: due,
          warnFrom: addMonthsClamped(due, -calibration.params.warnMonthsBefore),
          criticalFrom: addMonthsClamped(due, -1),
        },
        calibration,
        input.state,
      ),
    );
  }
  return result;
}

/** End of calibration validity from the calibration year (RECHT-PRÜFEN R-019). */
export function calibrationValidUntil(kind: MeterKind, calibrationYear: number, asOf: IsoDate): IsoDate | null {
  if (kind === "hcd") return null;
  const years = rules.resolve("messev.eichfristen", asOf).params.yearsByMeterKind[kind];
  return formatDate({ year: calibrationYear + years, month: 12, day: 31 });
}
