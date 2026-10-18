import fc from "fast-check";
import { describe, expect, it } from "vitest";
import {
  addDays,
  calibrationValidUntil,
  completedSettlementPeriods,
  deadlineStatus,
  easterSunday,
  evaluate,
  formatDate,
  holidays,
  isHoliday,
  legionellaDeadline,
  meterDeadlines,
  operatingCostStatementDeadline,
  periodEnd,
  shiftToBusinessDay,
  smokeDetectorDeadline,
  today,
} from "@hv/deadlines";

describe("periodEnd (§§ 187, 188 BGB)", () => {
  it.each([
    ["2026-01-15", { months: 1 }, "event", "2026-02-15"],
    ["2026-01-31", { months: 1 }, "event", "2026-02-28"], // § 188 Abs. 3
    ["2024-01-31", { months: 1 }, "event", "2024-02-29"],
    ["2025-12-31", { months: 12 }, "event", "2026-12-31"],
    ["2026-03-10", { days: 14 }, "event", "2026-03-24"], // Ereignistag zählt nicht
    ["2026-10-19", { weeks: 3 }, "event", "2026-11-09"], // Montag → Montag
    ["2026-01-01", { months: 12 }, "dayStart", "2026-12-31"], // § 187 Abs. 2
    ["2026-01-15", { months: 1 }, "dayStart", "2026-02-14"],
    ["2026-01-31", { months: 1 }, "dayStart", "2026-02-28"],
    ["2026-03-01", { days: 10 }, "dayStart", "2026-03-10"],
    ["2023-05-12", { years: 3 }, "event", "2026-05-12"],
  ] as const)("%s + %o (%s) → %s", (start, length, mode, expected) => {
    expect(periodEnd(start, length, mode)).toBe(expected);
  });

  it("verlangt genau eine Einheit", () => {
    expect(() => periodEnd("2026-01-01", {})).toThrow();
    expect(() => periodEnd("2026-01-01", { days: 1, months: 1 })).toThrow();
  });

  it("Eigenschaft: Monatsfristen enden nie vor dem Start und höchstens am Monatsende", () => {
    fc.assert(
      fc.property(fc.date({ min: new Date("2000-01-01"), max: new Date("2090-12-31"), noInvalidDate: true }), fc.integer({ min: 1, max: 60 }), (d, months) => {
        const start = d.toISOString().slice(0, 10);
        const end = periodEnd(start, { months });
        expect(end > start).toBe(true);
        const dayStartEnd = periodEnd(start, { months }, "dayStart");
        expect(dayStartEnd < end || dayStartEnd === end).toBe(true);
        expect(addDays(dayStartEnd, 1) <= addDays(end, 1)).toBe(true);
      }),
    );
  });
});

describe("Feiertage", () => {
  it.each([
    [2024, "2024-03-31"],
    [2025, "2025-04-20"],
    [2026, "2026-04-05"],
    [2027, "2027-03-28"],
  ])("Ostersonntag %i = %s", (year, expected) => {
    expect(easterSunday(year)).toBe(expected);
  });

  it("kennt bundesweite und landesweite Feiertage", () => {
    expect(isHoliday("2026-10-03")).toBe(true);
    expect(isHoliday("2026-06-04", "NW")).toBe(true); // Fronleichnam
    expect(isHoliday("2026-06-04", "BE")).toBe(false);
    expect(isHoliday("2026-11-18", "SN")).toBe(true); // Buß- und Bettag
    expect(isHoliday("2026-10-31", "NI")).toBe(true);
    expect(isHoliday("2017-10-31", "BW")).toBe(true); // einmalig bundesweit
    expect(isHoliday("2018-10-31", "BW")).toBe(false);
    expect(isHoliday("2026-03-08", "BE")).toBe(true);
    expect(isHoliday("2018-03-08", "BE")).toBe(false);
  });

  it("liefert neun bundesweite Feiertage je Jahr", () => {
    expect(holidays(2026)).toHaveLength(9);
  });
});

describe("§ 193 BGB (nur informativ)", () => {
  it("verschiebt Samstag + Feiertag auf Montag", () => {
    expect(shiftToBusinessDay("2026-10-03")).toMatchObject({ date: "2026-10-05", shifted: true });
  });
  it("verschiebt über Weihnachten", () => {
    expect(shiftToBusinessDay("2026-12-25").date).toBe("2026-12-28");
  });
  it("berücksichtigt das Bundesland", () => {
    expect(shiftToBusinessDay("2026-11-18", "SN").date).toBe("2026-11-19");
    expect(shiftToBusinessDay("2026-11-18", "BE").shifted).toBe(false);
  });
});

describe("Status und Ampel", () => {
  const window = { dueDate: "2026-12-31", warnFrom: "2026-09-30", criticalFrom: "2026-11-30" };
  it.each([
    ["2026-09-29", "ok"],
    ["2026-09-30", "warn"],
    ["2026-11-30", "critical"],
    ["2026-12-31", "critical"],
    ["2027-01-01", "overdue"],
  ])("%s → %s", (day, expected) => {
    expect(deadlineStatus(window, day)).toBe(expected);
  });
});

describe("Fristen aus Fachdaten", () => {
  it("Betriebskostenabrechnung 2025: Zugang bis 31.12.2026, Ampel ab Monat 9", () => {
    const d = operatingCostStatementDeadline({ propertyId: "p1", propertyLabel: "MH Leipzig", periodStart: "2025-01-01", periodEnd: "2025-12-31", state: "SN" });
    expect(d).toMatchObject({ dueDate: "2026-12-31", warnFrom: "2026-09-30", criticalFrom: "2026-11-30" });
    expect(d.rule.key).toBe("bgb.556.abrechnungsfrist");
    expect(d.rule.rechtPruefen).toContain("R-001");
    expect(evaluate(d, "2026-10-18")).toMatchObject({ status: "warn", trafficLight: "yellow" });
    expect(d.id).toBe("operating_cost_statement:p1:2026-12-31");
  });

  it("abweichender Abrechnungszeitraum Juli–Juni", () => {
    const periods = completedSettlementPeriods(7, "2026-10-18");
    expect(periods[0]).toEqual({ start: "2025-07-01", end: "2026-06-30" });
    expect(periods[1]).toEqual({ start: "2024-07-01", end: "2025-06-30" });
    const d = operatingCostStatementDeadline({ propertyId: "p", propertyLabel: "x", periodStart: periods[1]!.start, periodEnd: periods[1]!.end });
    expect(d.dueDate).toBe("2026-06-30");
    expect(evaluate(d, "2026-10-18").status).toBe("overdue");
  });

  it("Kalenderjahr: letzte abgeschlossene Periode", () => {
    expect(completedSettlementPeriods(1, "2026-10-18")[0]).toEqual({ start: "2025-01-01", end: "2025-12-31" });
    expect(completedSettlementPeriods(1, "2026-01-01")[0]).toEqual({ start: "2025-01-01", end: "2025-12-31" });
    expect(completedSettlementPeriods(1, "2025-12-31")[0]).toEqual({ start: "2024-01-01", end: "2024-12-31" });
  });

  it("Legionellenprüfung nur bei Pflicht, sonst keine Frist", () => {
    const base = { propertyId: "p", assetId: "a", assetLabel: "TWW-Speicher", today: "2026-10-18", showersOrAerosol: true, commercialActivity: true };
    expect(legionellaDeadline({ ...base, largeSystem: false, lastInspectionOn: "2023-05-12" })).toBeNull();
    const d = legionellaDeadline({ ...base, largeSystem: true, lastInspectionOn: "2023-05-12" })!;
    expect(d.dueDate).toBe("2026-05-12");
    expect(evaluate(d, "2026-10-18").status).toBe("overdue");
    const missing = legionellaDeadline({ ...base, largeSystem: true, lastInspectionOn: null })!;
    expect(missing.dueDate).toBe("2026-10-18");
    expect(missing.basis).toContain("keine Prüfung erfasst");
  });

  it("Rauchwarnmelder: Wartung alle 12 Monate", () => {
    const d = smokeDetectorDeadline({ propertyId: "p", assetId: "rwm", assetLabel: "RWM", lastMaintenanceOn: "2025-11-20", today: "2026-10-18", state: "BE" })!;
    expect(d.dueDate).toBe("2026-11-20");
    expect(evaluate(d, "2026-10-18").status).toBe("warn");
  });

  it("Zähler: Umrüstfrist 31.12.2026, Interoperabilität 2031, Eichfrist", () => {
    const meter = { id: "m1", label: "WMZ 4711", kind: "heat" as const, remoteReadable: false, interoperable: false, calibrationValidUntil: "2027-12-31" };
    const ds = meterDeadlines({ propertyId: "p", meter, today: "2026-10-18" });
    expect(ds.map((d) => d.kind)).toEqual(["meter_remote_retrofit", "meter_calibration"]);
    expect(ds[0]!.dueDate).toBe("2026-12-31");
    expect(evaluate(ds[0]!, "2026-10-18").status).toBe("warn");

    const remote = meterDeadlines({ propertyId: "p", meter: { ...meter, remoteReadable: true, calibrationValidUntil: null }, today: "2026-10-18" });
    expect(remote.map((d) => d.kind)).toEqual(["meter_interoperability"]);
    expect(remote[0]!.dueDate).toBe("2031-12-31");

    const coldWater = meterDeadlines({ propertyId: "p", meter: { ...meter, kind: "cold_water" }, today: "2026-10-18" });
    expect(coldWater.map((d) => d.kind)).toEqual(["meter_calibration"]);
  });

  it("Eichgültigkeit aus Eichjahr", () => {
    expect(calibrationValidUntil("cold_water", 2021, "2026-10-18")).toBe("2027-12-31");
    expect(calibrationValidUntil("heat", 2021, "2026-10-18")).toBe("2026-12-31");
    expect(calibrationValidUntil("hcd", 2021, "2026-10-18")).toBeNull();
  });
});

describe("today", () => {
  it("nutzt die deutsche Zeitzone", () => {
    expect(today("Europe/Berlin", new Date("2026-10-17T22:30:00Z"))).toBe("2026-10-18");
    expect(formatDate({ year: 2026, month: 1, day: 5 })).toBe("2026-01-05");
  });
});
