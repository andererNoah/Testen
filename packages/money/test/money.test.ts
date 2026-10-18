import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { Decimal, allocate, formatEuro, multiply, parseEuro, roundToCents, sum } from "@hv/money";

describe("roundToCents", () => {
  it("rundet kaufmännisch (halbe Cent weg von null)", () => {
    expect(roundToCents("0.005")).toBe(1);
    expect(roundToCents("-0.005")).toBe(-1);
    expect(roundToCents("0.0049")).toBe(0);
    expect(roundToCents("1234.565")).toBe(123457);
  });

  it("unterstützt Banker's Rounding auf Wunsch", () => {
    expect(roundToCents("0.005", "half_even")).toBe(0);
    expect(roundToCents("0.015", "half_even")).toBe(2);
  });

  it("vermeidet Gleitkommafehler", () => {
    // 0.1 + 0.2 als Strings bleibt exakt
    expect(roundToCents(new Decimal("0.1").plus("0.2"))).toBe(30);
    expect(multiply(1999, "0.15")).toBe(300); // 299,85 → 300
  });
});

describe("allocate", () => {
  it("verteilt 100,00 € auf drei gleiche Anteile ohne Rundungsverlust", () => {
    expect(allocate(10000, [1, 1, 1])).toEqual([3334, 3333, 3333]);
  });

  it("verteilt nach Wohnfläche", () => {
    const shares = allocate(123456, ["65.40", "82.10", "48.75"]);
    expect(sum(shares)).toBe(123456);
    // exakt: 41141,515 · 51647,071 · 30667,414 → der eine Rest-Cent geht an den größten Rest
    expect(shares).toEqual([41142, 51647, 30667]);
  });

  it("verteilt Gutschriften (negative Beträge) symmetrisch", () => {
    expect(allocate(-10000, [1, 1, 1])).toEqual([-3334, -3333, -3333]);
  });

  it("lehnt ungültige Gewichte ab", () => {
    expect(() => allocate(100, [])).toThrow();
    expect(() => allocate(100, [0, 0])).toThrow();
    expect(() => allocate(100, [-1, 2])).toThrow();
  });

  it("Eigenschaft: Summe der Anteile ist exakt der Gesamtbetrag", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: -1_000_000_000, max: 1_000_000_000 }),
        fc.array(fc.integer({ min: 0, max: 1_000_000 }), { minLength: 1, maxLength: 60 }).filter((ws) => ws.some((w) => w > 0)),
        (total, weights) => {
          const shares = allocate(total, weights);
          expect(sum(shares)).toBe(total);
        },
      ),
    );
  });

  it("Eigenschaft: jeder Anteil weicht weniger als einen Cent vom exakten Wert ab", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 100_000_000 }),
        fc.array(fc.integer({ min: 1, max: 100_000 }), { minLength: 1, maxLength: 40 }),
        (total, weights) => {
          const shares = allocate(total, weights);
          const weightSum = weights.reduce((a, b) => a + b, 0);
          shares.forEach((share, i) => {
            const exact = new Decimal(total).times(weights[i]!).dividedBy(weightSum);
            expect(exact.minus(share).abs().lessThan(1)).toBe(true);
          });
        },
      ),
    );
  });
});

describe("parseEuro / formatEuro", () => {
  it.each([
    ["1.234,56", 123456],
    ["1234,56", 123456],
    ["1234.56", 123456],
    ["1,234.56", 123456],
    ["-12", -1200],
    ["12,5 €", 1250],
    ["0,01", 1],
  ])("liest %s als %i Cent", (input, expected) => {
    expect(parseEuro(input)).toBe(expected);
  });

  it("liest Tausenderpunkte deutsch", () => {
    expect(parseEuro("1.500")).toBe(150000);
  });

  it("lehnt mehr als zwei Nachkommastellen und Unsinn ab", () => {
    // "1,234" ist mehrdeutig (1,234 € oder 1.234 €) und wird abgelehnt.
    expect(() => parseEuro("1,234")).toThrow();
    expect(() => parseEuro("1,2345")).toThrow();
    expect(() => parseEuro("abc")).toThrow();
    expect(() => parseEuro("")).toThrow();
  });

  it("formatiert deutsch", () => {
    expect(formatEuro(123456)).toBe("1.234,56 €");
    expect(formatEuro(-5)).toBe("-0,05 €");
  });
});
