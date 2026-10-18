import { describe, expect, it } from "vitest";
import { z } from "zod";
import { RuleNotApplicableError, catalog, createRuleEngine, defineRule, rules } from "@hv/rules";

describe("Regelkatalog", () => {
  it("ist fehlerfrei (Schemas, Gültigkeiten, Quellen, Verweise)", () => {
    expect(rules.validate()).toEqual([]);
  });

  it("jede Regel hat mindestens eine Version mit Quelle", () => {
    for (const def of rules.list()) {
      expect(def.versions.length).toBeGreaterThan(0);
      for (const v of def.versions) expect(v.sources.length).toBeGreaterThan(0);
    }
  });

  it("jeder RECHT-PRÜFEN-Verweis steht in docs/recht-pruefen.md", async () => {
    const { readFile } = await import("node:fs/promises");
    const doc = await readFile(new URL("../../../docs/recht-pruefen.md", import.meta.url), "utf8");
    const ids = new Set(rules.list().flatMap((d) => d.versions.flatMap((v) => v.rechtPruefen ?? [])));
    for (const id of ids) expect(doc, `${id} fehlt in recht-pruefen.md`).toContain(`| ${id} |`);
  });
});

describe("resolve", () => {
  it("liefert die Abrechnungsfrist mit Quelle", () => {
    const rule = rules.resolve("bgb.556.abrechnungsfrist", "2026-10-18");
    expect(rule.params.monthsAfterPeriodEnd).toBe(12);
    expect(rule.sources[0]?.norm).toBe("§ 556 BGB");
    expect(rule.rechtPruefen).toContain("R-001");
  });

  it("wählt die Version nach Stichtag (Aufbewahrung vor/nach BEG IV)", () => {
    expect(rules.resolve("ao.147.aufbewahrung", "2024-12-31").params.bookingVouchersYears).toBe(10);
    expect(rules.resolve("ao.147.aufbewahrung", "2025-01-01").params.bookingVouchersYears).toBe(8);
  });

  it("Mietpreisbremse gilt bis einschließlich 31.12.2029", () => {
    expect(rules.resolve("bgb.556d.mietpreisbremse", "2029-12-31").version).toBe("2026-01");
    expect(rules.tryResolve("bgb.556d.mietpreisbremse", "2030-01-01")).toBeUndefined();
  });

  it("GModG-Regeln greifen erst ab 2028 bzw. 2029", () => {
    expect(rules.tryResolve("gmodg.neue_fossile_heizung", "2027-12-31")).toBeUndefined();
    expect(rules.resolve("gmodg.neue_fossile_heizung", "2028-06-01").params.landlordPercentBiogenicComponent).toBeNull();
    expect(rules.resolve("gmodg.neue_fossile_heizung", "2029-01-01").params.biogenicTiers).toEqual([1, 2, 3]);
  });

  it("Entwürfe (Mietrecht II) werden nie automatisch angewendet", () => {
    expect(() => rules.resolve("mietrecht2.indexkappung", "2099-12-31")).toThrow(RuleNotApplicableError);
    expect(rules.resolve("mietrecht2.indexkappung", "2099-12-31", { includeDrafts: true }).status).toBe("entwurf");
  });

  it("CO2-Stufen sind lückenlos und steigend", () => {
    const tiers = rules.resolve("co2kostaufg.aufteilung", "2026-01-01").params.residentialTiers;
    tiers.forEach((t, i) => {
      if (i > 0) {
        expect(t.fromKgPerSqm).toBe(tiers[i - 1]!.toKgPerSqm);
        expect(t.landlordPercent).toBeGreaterThan(tiers[i - 1]!.landlordPercent);
      }
    });
    expect(tiers.at(-1)!.toKgPerSqm).toBeNull();
    expect(tiers.at(-1)!.landlordPercent).toBe(95);
  });

  it("lehnt ungültige Stichtage ab", () => {
    expect(() => rules.resolve("bgb.556.abrechnungsfrist", "2026-02-30")).toThrow(RangeError);
  });
});

describe("Katalogprüfung", () => {
  const params = z.object({ n: z.number() });
  it("erkennt überlappende Gültigkeiten, fehlende Quellen und falsche Parameter", () => {
    const broken = createRuleEngine({
      "x.test": defineRule({
        key: "x.test",
        title: "Test",
        area: "miete",
        description: "",
        paramsSchema: params,
        versions: [
          { version: "a", validFrom: "2020-01-01", validTo: "2022-01-01", status: "in_kraft", summary: "", params: { n: 1 }, sources: [{ label: "x" }] },
          { version: "b", validFrom: "2021-06-01", status: "in_kraft", summary: "", params: { n: "2" as unknown as number }, sources: [] },
        ],
      }),
    });
    const problems = broken.validate().map((i) => i.problem);
    expect(problems.some((p) => p.includes("überlappen"))).toBe(true);
    expect(problems.some((p) => p.includes("Quellenangabe"))).toBe(true);
    expect(problems.some((p) => p.includes("Schema"))).toBe(true);
  });
});

describe("changelog", () => {
  it("listet Rechtsänderungen, neueste Gültigkeit zuerst", () => {
    const entries = rules.changelog();
    expect(entries.length).toBeGreaterThan(3);
    for (let i = 1; i < entries.length; i++) expect(entries[i - 1]!.validFrom >= entries[i]!.validFrom).toBe(true);
    expect(Object.keys(catalog)).toContain(entries[0]!.key);
  });
});
