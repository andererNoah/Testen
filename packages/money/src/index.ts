import Decimal from "decimal.js";

/**
 * Money is always held as integer cents (ADR-0004). Floating point is never used
 * for amounts; ratios are computed with decimal.js and rounded exactly once.
 */
export type Cents = number;

export type RoundingMode = "half_up" | "half_even" | "down" | "up";

/** Kaufmännische Rundung: halbe Cent weg von null. */
export const DEFAULT_ROUNDING: RoundingMode = "half_up";

const D = Decimal.clone({ precision: 40, rounding: Decimal.ROUND_HALF_UP });

const ROUNDING: Record<RoundingMode, Decimal.Rounding> = {
  half_up: Decimal.ROUND_HALF_UP,
  half_even: Decimal.ROUND_HALF_EVEN,
  down: Decimal.ROUND_DOWN,
  up: Decimal.ROUND_UP,
};

export class MoneyError extends Error {
  override name = "MoneyError";
}

export function assertCents(value: number): Cents {
  if (!Number.isSafeInteger(value)) {
    throw new MoneyError(`Betrag ist kein ganzzahliger Cent-Wert: ${value}`);
  }
  return value;
}

/** Rounds a euro amount (any decimal) to cents. This is the only rounding point. */
export function roundToCents(euros: Decimal.Value, mode: RoundingMode = DEFAULT_ROUNDING): Cents {
  const value = new D(euros).times(100).toDecimalPlaces(0, ROUNDING[mode]);
  return assertCents(value.toNumber());
}

/** Multiplies cents by an exact decimal factor (e.g. a share) and rounds once. */
export function multiply(amount: Cents, factor: Decimal.Value, mode: RoundingMode = DEFAULT_ROUNDING): Cents {
  const value = new D(assertCents(amount)).times(factor).toDecimalPlaces(0, ROUNDING[mode]);
  return assertCents(value.toNumber());
}

export function sum(amounts: readonly Cents[]): Cents {
  let total = 0;
  for (const amount of amounts) total = assertCents(total + assertCents(amount));
  return total;
}

/**
 * Distributes `total` over `weights` with the largest remainder method.
 * The shares always add up to exactly `total`; each share deviates from its
 * exact value by less than one cent. Ties go to the lower index (stable).
 */
export function allocate(total: Cents, weights: readonly Decimal.Value[]): Cents[] {
  assertCents(total);
  if (weights.length === 0) throw new MoneyError("Verteilung ohne Gewichte");
  const ws = weights.map((w) => new D(w));
  if (ws.some((w) => w.isNegative() || !w.isFinite())) {
    throw new MoneyError("Gewichte müssen endlich und nicht negativ sein");
  }
  const weightSum = ws.reduce((acc, w) => acc.plus(w), new D(0));
  if (weightSum.isZero()) throw new MoneyError("Summe der Gewichte ist null");

  const sign = total < 0 ? -1 : 1;
  const absTotal = new D(Math.abs(total));
  const exact = ws.map((w) => absTotal.times(w).dividedBy(weightSum));
  const floors = exact.map((e) => e.floor());
  let remaining = absTotal.minus(floors.reduce((acc, f) => acc.plus(f), new D(0))).toNumber();

  const order = exact
    .map((e, index) => ({ index, remainder: e.minus(floors[index]!) }))
    .sort((a, b) => b.remainder.comparedTo(a.remainder) || a.index - b.index);

  const result = floors.map((f) => f.toNumber());
  for (const { index } of order) {
    if (remaining <= 0) break;
    result[index]! += 1;
    remaining -= 1;
  }
  return result.map((c) => assertCents(sign * c) + 0);
}

/**
 * Parses a euro amount from user input without floating point.
 * Accepts "1.234,56", "1234,56", "1234.56", "-12", "12,5 €".
 */
export function parseEuro(input: string): Cents {
  const cleaned = input.replace(/\s|€|EUR/gi, "");
  if (cleaned === "") throw new MoneyError("Leerer Betrag");
  let normalized: string;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(cleaned) || /^-?\d+(,\d+)?$/.test(cleaned)) {
    normalized = cleaned.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(cleaned)) {
    normalized = cleaned.replace(/,/g, "");
  } else if (/^-?\d+(\.\d+)?$/.test(cleaned)) {
    normalized = cleaned;
  } else {
    throw new MoneyError(`Ungültiger Betrag: ${input}`);
  }
  const value = new D(normalized);
  if (value.decimalPlaces() > 2) throw new MoneyError(`Mehr als zwei Nachkommastellen: ${input}`);
  return roundToCents(value);
}

const formatters = new Map<string, Intl.NumberFormat>();

export function formatEuro(amount: Cents, locale = "de-DE"): string {
  let formatter = formatters.get(locale);
  if (!formatter) {
    formatter = new Intl.NumberFormat(locale, { style: "currency", currency: "EUR" });
    formatters.set(locale, formatter);
  }
  // Division by 100 is exact for display purposes on safe integers.
  return formatter.format(new D(assertCents(amount)).dividedBy(100).toNumber());
}

export { D as Decimal };
