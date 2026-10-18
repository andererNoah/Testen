import { addDays, addMonthsClamped, daysInMonth, formatDate, parseDate, weekday, type IsoDate } from "./dates";
import { holidays, isHoliday, type FederalState } from "./holidays";

/**
 * How the period starts (§ 187 BGB):
 * - `event`: triggered by an event during a day; that day is not counted (§ 187 Abs. 1)
 * - `dayStart`: starts at the beginning of a day, which is counted (§ 187 Abs. 2)
 */
export type PeriodStartMode = "event" | "dayStart";

export interface PeriodLength {
  days?: number;
  weeks?: number;
  months?: number;
  years?: number;
}

/**
 * Last day of a period per §§ 187, 188 BGB. The period expires at the end of the returned day.
 * Only one unit may be given.
 */
export function periodEnd(start: IsoDate, length: PeriodLength, mode: PeriodStartMode = "event"): IsoDate {
  const units = Object.entries(length).filter(([, v]) => v !== undefined && v !== 0);
  if (units.length !== 1) throw new RangeError("Genau eine Fristeinheit angeben (Tage, Wochen, Monate oder Jahre)");
  const [unit, raw] = units[0]! as [keyof PeriodLength, number];
  if (!Number.isInteger(raw) || raw < 0) throw new RangeError("Fristlänge muss eine nicht negative ganze Zahl sein");

  if (unit === "days" || unit === "weeks") {
    const days = unit === "days" ? raw : raw * 7;
    // § 188 Abs. 1 / Abs. 2 Alt. 1: event day not counted; dayStart: start day counted.
    return addDays(start, mode === "event" ? days : days - 1);
  }

  const months = unit === "months" ? raw : raw * 12;
  if (mode === "event") {
    // § 188 Abs. 2 Alt. 1 with § 188 Abs. 3: same day number, clamped to the month end.
    return addMonthsClamped(start, months);
  }
  // § 188 Abs. 2 Alt. 2: the day before the day whose number matches the start day.
  const { year, month, day } = parseDate(start);
  const index = year * 12 + (month - 1) + months;
  if (day === 1) {
    const prev = index - 1;
    const y = Math.floor(prev / 12);
    const m = (prev % 12) + 1;
    return formatDate({ year: y, month: m, day: daysInMonth(y, m) });
  }
  const y = Math.floor(index / 12);
  const m = (index % 12) + 1;
  return formatDate({ year: y, month: m, day: Math.min(day - 1, daysInMonth(y, m)) });
}

export interface BusinessDayShift {
  date: IsoDate;
  shifted: boolean;
  reason: string | null;
}

/**
 * § 193 BGB: if the last day falls on a Saturday, Sunday or public holiday at the relevant
 * place, the next business day takes its place. Shown for information only; warnings use the
 * unshifted date (RECHT-PRÜFEN R-003).
 */
export function shiftToBusinessDay(date: IsoDate, state?: FederalState): BusinessDayShift {
  let current = date;
  const reasons: string[] = [];
  for (let i = 0; i < 10; i++) {
    const dow = weekday(current);
    if (dow === 6) reasons.push(`${current}: Samstag`);
    else if (dow === 0) reasons.push(`${current}: Sonntag`);
    else if (isHoliday(current, state)) {
      const name = holidays(Number(current.slice(0, 4)), state).find((h) => h.date === current)?.name ?? "Feiertag";
      reasons.push(`${current}: ${name}`);
    } else {
      return { date: current, shifted: current !== date, reason: reasons.length ? reasons.join(", ") : null };
    }
    current = addDays(current, 1);
  }
  throw new Error("Kein Werktag innerhalb von 10 Tagen gefunden");
}
