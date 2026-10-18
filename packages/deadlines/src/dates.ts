/** Calendar date `YYYY-MM-DD`. All calculations are timezone-free on the civil calendar. */
export type IsoDate = string;

export interface CivilDate {
  year: number;
  month: number; // 1-12
  day: number; // 1-31
}

const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseDate(value: IsoDate): CivilDate {
  const m = ISO.exec(value);
  if (!m) throw new RangeError(`Ungültiges Datum: ${value}`);
  const date = { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
  if (date.month < 1 || date.month > 12 || date.day < 1 || date.day > daysInMonth(date.year, date.month)) {
    throw new RangeError(`Ungültiges Datum: ${value}`);
  }
  return date;
}

export function formatDate({ year, month, day }: CivilDate): IsoDate {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function isValidDate(value: string): boolean {
  try {
    parseDate(value);
    return true;
  } catch {
    return false;
  }
}

export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function toEpochDay(value: IsoDate): number {
  const { year, month, day } = parseDate(value);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function fromEpochDay(epochDay: number): IsoDate {
  return new Date(epochDay * 86_400_000).toISOString().slice(0, 10);
}

export function addDays(value: IsoDate, days: number): IsoDate {
  return fromEpochDay(toEpochDay(value) + days);
}

export function diffDays(later: IsoDate, earlier: IsoDate): number {
  return toEpochDay(later) - toEpochDay(earlier);
}

/** Month shift that keeps the day number, clamped to the month's last day (§ 188 Abs. 3 BGB). */
export function addMonthsClamped(value: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseDate(value);
  const index = year * 12 + (month - 1) + months;
  const targetYear = Math.floor(index / 12);
  const targetMonth = (index % 12) + 1;
  return formatDate({ year: targetYear, month: targetMonth, day: Math.min(day, daysInMonth(targetYear, targetMonth)) });
}

export function lastDayOfMonth(year: number, month: number): IsoDate {
  return formatDate({ year, month, day: daysInMonth(year, month) });
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(value: IsoDate): number {
  const { year, month, day } = parseDate(value);
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay();
}

export function maxDate(a: IsoDate, b: IsoDate): IsoDate {
  return a > b ? a : b;
}

export function minDate(a: IsoDate, b: IsoDate): IsoDate {
  return a < b ? a : b;
}

/** Today's civil date in the given time zone (default: Germany). */
export function today(timeZone = "Europe/Berlin", now: Date = new Date()): IsoDate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function formatGerman(value: IsoDate): string {
  const { year, month, day } = parseDate(value);
  return `${String(day).padStart(2, "0")}.${String(month).padStart(2, "0")}.${year}`;
}
