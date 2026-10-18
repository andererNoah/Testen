import { z } from "zod";
import { defineRule } from "../src/types";
import { src } from "./sources";

export const abrechnungsfrist = defineRule({
  key: "bgb.556.abrechnungsfrist",
  title: "Frist für die Betriebskostenabrechnung",
  area: "miete",
  description:
    "Die Abrechnung muss dem Mieter spätestens mit Ablauf des zwölften Monats nach Ende des Abrechnungszeitraums zugehen; danach ist eine Nachforderung ausgeschlossen, außer der Vermieter hat die Verspätung nicht zu vertreten.",
  paramsSchema: z.object({
    monthsAfterPeriodEnd: z.number().int().positive(),
    warnAfterMonths: z.number().int().positive(),
    criticalAfterMonths: z.number().int().positive(),
    objectionMonthsAfterReceipt: z.number().int().positive(),
    maxPeriodMonths: z.number().int().positive(),
  }),
  versions: [
    {
      version: "2001-09",
      validFrom: "2001-09-01",
      status: "in_kraft",
      summary: "Zugang spätestens 12 Monate nach Ende des Abrechnungszeitraums; Einwendungen des Mieters bis 12 Monate nach Zugang.",
      params: { monthsAfterPeriodEnd: 12, warnAfterMonths: 9, criticalAfterMonths: 11, objectionMonthsAfterReceipt: 12, maxPeriodMonths: 12 },
      sources: [src.bgb556],
      rechtPruefen: ["R-001"],
    },
  ],
});

export const belegeinsicht = defineRule({
  key: "bgb.556.belegeinsicht",
  title: "Belegeinsicht bei der Betriebskostenabrechnung",
  area: "miete",
  description: "Belege dürfen dem Mieter ausschließlich elektronisch bereitgestellt werden (§ 556 Abs. 4 BGB).",
  paramsSchema: z.object({ electronicOnlyAllowed: z.boolean() }),
  versions: [
    {
      version: "2025-01",
      validFrom: "2025-01-01",
      status: "in_kraft",
      summary: "Elektronische Bereitstellung der Belege genügt.",
      params: { electronicOnlyAllowed: true },
      sources: [src.bgb556],
      changelog: "Seit 2025 dürfen Belege zur Betriebskostenabrechnung ausschließlich elektronisch bereitgestellt werden.",
    },
  ],
});

export const umlageschluessel = defineRule({
  key: "bgb.556a.umlageschluessel",
  title: "Standard-Umlageschlüssel für Betriebskosten",
  area: "miete",
  description:
    "Ohne Vereinbarung werden Betriebskosten nach Wohnfläche umgelegt; bei vermieteten Eigentumswohnungen grundsätzlich nach dem Maßstab der WEG (§ 556a Abs. 3 BGB).",
  paramsSchema: z.object({
    defaultKey: z.literal("living_area"),
    condominiumDefaultKey: z.literal("weg_key"),
  }),
  versions: [
    {
      version: "2020-12",
      validFrom: "2020-12-01",
      status: "in_kraft",
      summary: "Wohnfläche als Standard; vermietete Eigentumswohnung: WEG-Maßstab.",
      params: { defaultKey: "living_area", condominiumDefaultKey: "weg_key" },
      sources: [src.bgb556a],
    },
  ],
});

export const kappungsgrenze = defineRule({
  key: "bgb.558.kappungsgrenze",
  title: "Mieterhöhung auf die ortsübliche Vergleichsmiete",
  area: "miete",
  description:
    "Die Miete darf innerhalb von drei Jahren um höchstens 20 % steigen, in Gebieten mit Verordnung um höchstens 15 %. Die Miete muss seit 15 Monaten unverändert sein; das Verlangen ist frühestens ein Jahr nach der letzten Erhöhung zulässig.",
  paramsSchema: z.object({
    capPercent: z.number().positive(),
    tightMarketCapPercent: z.number().positive(),
    capPeriodYears: z.number().int().positive(),
    minMonthsUnchanged: z.number().int().positive(),
    minMonthsSinceLastIncrease: z.number().int().positive(),
  }),
  versions: [
    {
      version: "2013-05",
      validFrom: "2013-05-01",
      status: "in_kraft",
      summary: "Kappung 20 % bzw. 15 % in drei Jahren; Sperrfrist 15 Monate.",
      params: { capPercent: 20, tightMarketCapPercent: 15, capPeriodYears: 3, minMonthsUnchanged: 15, minMonthsSinceLastIncrease: 12 },
      sources: [src.bgb558],
      rechtPruefen: ["R-012"],
    },
  ],
});

const mietpreisbremseParams = z.object({
  maxPercentAboveComparativeRent: z.number().positive(),
  /** Area list per federal state, maintained as data (empty until filled from state regulations). */
  areas: z.array(z.object({ state: z.string().length(2), municipality: z.string(), validUntil: z.string() })),
});

export const mietpreisbremse = defineRule({
  key: "bgb.556d.mietpreisbremse",
  title: "Mietpreisbremse bei Neuvermietung",
  area: "miete",
  description: "In Gebieten mit Landesverordnung darf die Miete bei Mietbeginn die ortsübliche Vergleichsmiete um höchstens 10 % übersteigen.",
  paramsSchema: mietpreisbremseParams,
  versions: [
    {
      version: "2015-06",
      validFrom: "2015-06-01",
      validTo: "2026-01-01",
      status: "in_kraft",
      summary: "Höchstens 10 % über der Vergleichsmiete in ausgewiesenen Gebieten; ursprünglich befristet bis Ende 2025.",
      params: { maxPercentAboveComparativeRent: 10, areas: [] },
      sources: [src.bgb556d],
      rechtPruefen: ["R-011"],
    },
    {
      version: "2026-01",
      validFrom: "2026-01-01",
      validTo: "2030-01-01",
      status: "in_kraft",
      summary: "Verlängert bis 31.12.2029; Gebietsliste je Bundesland pflegen.",
      params: { maxPercentAboveComparativeRent: 10, areas: [] },
      sources: [src.bgb556d],
      rechtPruefen: ["R-011"],
      changelog: "Mietpreisbremse bis 31.12.2029 verlängert.",
    },
  ],
});

/** Mietrecht II: prepared as drafts with a placeholder date; activated only after promulgation. */
const DRAFT_PLACEHOLDER = "2099-12-31";

const draft = (key: string, title: string, description: string) =>
  defineRule({
    key,
    title,
    area: "miete",
    description,
    paramsSchema: z.object({ placeholder: z.literal(true), notes: z.string() }),
    versions: [
      {
        version: "entwurf-21-6807",
        validFrom: DRAFT_PLACEHOLDER,
        status: "entwurf",
        summary: "Entwurf, nicht in Kraft. Parameter nach Verkündung eintragen und Stichtag setzen.",
        params: { placeholder: true, notes: "Werte erst nach Verkündung aus dem Bundesgesetzblatt übernehmen." },
        sources: [src.mietrecht2],
        rechtPruefen: ["R-013"],
      },
    ],
  });

export const mietrecht2Indexkappung = draft(
  "mietrecht2.indexkappung",
  "Mietrecht II: Kappung von Indexmieten in angespannten Märkten",
  "Geplante Begrenzung der Indexmieterhöhung in Gebieten mit angespanntem Wohnungsmarkt.",
);
export const mietrecht2Moeblierung = draft(
  "mietrecht2.moeblierungszuschlag",
  "Mietrecht II: Möblierungszuschlag",
  "Geplante Regeln zur Ausweisung und Begrenzung des Möblierungszuschlags.",
);
export const mietrecht2Kurzzeit = draft(
  "mietrecht2.kurzzeitmiete",
  "Mietrecht II: Kurzzeitmiete",
  "Geplante Regeln für Mietverhältnisse zum vorübergehenden Gebrauch.",
);
export const mietrecht2Schonfrist = draft(
  "mietrecht2.schonfrist",
  "Mietrecht II: erweiterte Schonfrist",
  "Geplante Erweiterung der Schonfristzahlung auf die ordentliche Kündigung.",
);
