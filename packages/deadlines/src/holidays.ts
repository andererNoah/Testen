import { addDays, formatDate, type IsoDate } from "./dates";

export const FEDERAL_STATES = ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"] as const;
export type FederalState = (typeof FEDERAL_STATES)[number];

export function isFederalState(value: string): value is FederalState {
  return (FEDERAL_STATES as readonly string[]).includes(value);
}

export interface Holiday {
  date: IsoDate;
  name: string;
}

/** Easter Sunday (Gregorian calendar, anonymous algorithm). */
export function easterSunday(year: number): IsoDate {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return formatDate({ year, month, day });
}

/** Wednesday before 23 November. */
function repentanceDay(year: number): IsoDate {
  const nov22 = formatDate({ year, month: 11, day: 22 });
  const dow = new Date(`${nov22}T00:00:00Z`).getUTCDay();
  const back = (dow - 3 + 7) % 7;
  return addDays(nov22, -back);
}

/**
 * Statewide public holidays. Regional holidays (Fronleichnam in parts of SN/TH,
 * Mariä Himmelfahrt in parts of BY, Augsburger Friedensfest) are not included (RECHT-PRÜFEN R-004).
 */
export function holidays(year: number, state?: FederalState): Holiday[] {
  const easter = easterSunday(year);
  const fixed = (month: number, day: number) => formatDate({ year, month, day });
  const list: Holiday[] = [
    { date: fixed(1, 1), name: "Neujahr" },
    { date: addDays(easter, -2), name: "Karfreitag" },
    { date: addDays(easter, 1), name: "Ostermontag" },
    { date: fixed(5, 1), name: "Tag der Arbeit" },
    { date: addDays(easter, 39), name: "Christi Himmelfahrt" },
    { date: addDays(easter, 50), name: "Pfingstmontag" },
    { date: fixed(10, 3), name: "Tag der Deutschen Einheit" },
    { date: fixed(12, 25), name: "1. Weihnachtstag" },
    { date: fixed(12, 26), name: "2. Weihnachtstag" },
  ];
  if (year === 2017) list.push({ date: fixed(10, 31), name: "Reformationstag (500 Jahre)" });

  if (state) {
    const add = (states: FederalState[], date: IsoDate, name: string, sinceYear = 0) => {
      if (states.includes(state) && year >= sinceYear) list.push({ date, name });
    };
    add(["BW", "BY", "ST"], fixed(1, 6), "Heilige Drei Könige");
    add(["BE"], fixed(3, 8), "Internationaler Frauentag", 2019);
    add(["MV"], fixed(3, 8), "Internationaler Frauentag", 2023);
    add(["BB"], easter, "Ostersonntag");
    add(["BB"], addDays(easter, 49), "Pfingstsonntag");
    add(["BW", "BY", "HE", "NW", "RP", "SL"], addDays(easter, 60), "Fronleichnam");
    add(["SL"], fixed(8, 15), "Mariä Himmelfahrt");
    add(["TH"], fixed(9, 20), "Weltkindertag", 2019);
    add(["BB", "MV", "SN", "ST", "TH"], fixed(10, 31), "Reformationstag");
    add(["HB", "HH", "NI", "SH"], fixed(10, 31), "Reformationstag", 2018);
    add(["BW", "BY", "NW", "RP", "SL"], fixed(11, 1), "Allerheiligen");
    add(["SN"], repentanceDay(year), "Buß- und Bettag");
    if (state === "BE" && (year === 2020 || year === 2025)) list.push({ date: fixed(5, 8), name: "Tag der Befreiung" });
  }

  const unique = new Map<IsoDate, Holiday>();
  for (const h of list) if (!unique.has(h.date)) unique.set(h.date, h);
  return [...unique.values()].sort((a, b) => a.date.localeCompare(b.date));
}

const cache = new Map<string, Set<IsoDate>>();

export function isHoliday(date: IsoDate, state?: FederalState): boolean {
  const year = Number(date.slice(0, 4));
  const key = `${year}:${state ?? ""}`;
  let set = cache.get(key);
  if (!set) {
    set = new Set(holidays(year, state).map((h) => h.date));
    cache.set(key, set);
  }
  return set.has(date);
}
