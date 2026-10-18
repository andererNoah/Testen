import { z } from "zod";
import { defineRule } from "../src/types";
import { src } from "./sources";

export const fernablesbarkeit = defineRule({
  key: "heizkv.5.fernablesbarkeit",
  title: "Fernablesbare Messgeräte und Interoperabilität",
  area: "heizkosten",
  description:
    "Seit 01.12.2021 eingebaute Geräte müssen fernablesbar sein; ältere Geräte sind bis 31.12.2026 nachzurüsten oder zu ersetzen. Bis 31.12.2031 müssen fernablesbare Geräte interoperabel und an ein Smart-Meter-Gateway anbindbar sein. Bei Verstoß darf der Nutzer seinen Kostenanteil um 3 % kürzen.",
  paramsSchema: z.object({
    newInstallationsRemoteSince: z.string(),
    retrofitDeadline: z.string(),
    interoperabilityDeadline: z.string(),
    reductionPercent: z.number().positive(),
    affectedMeterKinds: z.array(z.enum(["heat", "hot_water", "hcd"])),
  }),
  versions: [
    {
      version: "2021-12",
      validFrom: "2021-12-01",
      status: "in_kraft",
      summary: "Nachrüstung bis 31.12.2026, Interoperabilität bis 31.12.2031, Kürzungsrecht 3 %.",
      params: {
        newInstallationsRemoteSince: "2021-12-01",
        retrofitDeadline: "2026-12-31",
        interoperabilityDeadline: "2031-12-31",
        reductionPercent: 3,
        affectedMeterKinds: ["heat", "hot_water", "hcd"],
      },
      sources: [src.heizkv5, src.heizkv12],
      rechtPruefen: ["R-007", "R-008"],
    },
  ],
});

export const uvi = defineRule({
  key: "heizkv.6a.uvi",
  title: "Unterjährige Verbrauchsinformation (UVI)",
  area: "heizkosten",
  description: "Sind fernablesbare Geräte installiert, erhalten alle Nutzer monatlich eine Verbrauchsinformation für Heizung und Warmwasser.",
  paramsSchema: z.object({ intervalMonths: z.number().int().positive(), reductionPercent: z.number().positive() }),
  versions: [
    {
      version: "2022-01",
      validFrom: "2022-01-01",
      status: "in_kraft",
      summary: "Monatlich bei fernablesbaren Geräten; ab 01.01.2027 faktisch für nahezu alle Bestände.",
      params: { intervalMonths: 1, reductionPercent: 3 },
      sources: [src.heizkv6a, src.heizkv12],
      rechtPruefen: ["R-007"],
    },
  ],
});

const tier = z.object({
  fromKgPerSqm: z.number().nonnegative(),
  /** Exclusive upper bound; null = open-ended. */
  toKgPerSqm: z.number().positive().nullable(),
  landlordPercent: z.number().min(0).max(100),
});

export const co2Stufen = defineRule({
  key: "co2kostaufg.aufteilung",
  title: "CO2-Kostenaufteilung zwischen Vermieter und Mieter",
  area: "heizkosten",
  description:
    "Wohngebäude: Stufenmodell nach kg CO2 je m² Wohnfläche und Jahr (10 Stufen). Nichtwohngebäude: hälftige Teilung. Pflichtangaben in der Abrechnung; Kürzungsrecht 3 % bei fehlenden Angaben.",
  paramsSchema: z.object({
    residentialTiers: z.array(tier).length(10),
    nonResidentialLandlordPercent: z.number().min(0).max(100),
    reductionPercent: z.number().positive(),
  }),
  versions: [
    {
      version: "2023-01",
      validFrom: "2023-01-01",
      status: "in_kraft",
      summary: "10 Stufen von 0 % (unter 12 kg) bis 95 % Vermieteranteil (ab 52 kg); Nichtwohngebäude 50 %.",
      params: {
        residentialTiers: [
          { fromKgPerSqm: 0, toKgPerSqm: 12, landlordPercent: 0 },
          { fromKgPerSqm: 12, toKgPerSqm: 17, landlordPercent: 10 },
          { fromKgPerSqm: 17, toKgPerSqm: 22, landlordPercent: 20 },
          { fromKgPerSqm: 22, toKgPerSqm: 27, landlordPercent: 30 },
          { fromKgPerSqm: 27, toKgPerSqm: 32, landlordPercent: 40 },
          { fromKgPerSqm: 32, toKgPerSqm: 37, landlordPercent: 50 },
          { fromKgPerSqm: 37, toKgPerSqm: 42, landlordPercent: 60 },
          { fromKgPerSqm: 42, toKgPerSqm: 47, landlordPercent: 70 },
          { fromKgPerSqm: 47, toKgPerSqm: 52, landlordPercent: 80 },
          { fromKgPerSqm: 52, toKgPerSqm: null, landlordPercent: 95 },
        ],
        nonResidentialLandlordPercent: 50,
        reductionPercent: 3,
      },
      sources: [src.co2],
      rechtPruefen: ["R-009"],
    },
  ],
});

export const gmodgTeilung = defineRule({
  key: "gmodg.neue_fossile_heizung",
  title: "Kostenteilung bei neu eingebauten Gas-, Öl- und Flüssiggasheizungen (GModG)",
  area: "heizkosten",
  description:
    "Für neu eingebaute Gas-, Öl- und Flüssiggasheizungen werden CO2-Kosten und Gasnetzentgelte ab 01.01.2028 hälftig geteilt, ab 01.01.2029 zusätzlich der Preisbestandteil für biogene Brennstoffe (Stufen 1–3). Gesteuert über Einbaudatum und Energieträger der Anlage.",
  paramsSchema: z.object({
    energyCarriers: z.array(z.enum(["gas", "oil", "lpg"])),
    installedOnOrAfter: z.string(),
    landlordPercentCo2: z.number(),
    landlordPercentGridFees: z.number(),
    landlordPercentBiogenicComponent: z.number().nullable(),
    biogenicTiers: z.array(z.number().int()).nullable(),
  }),
  versions: [
    {
      version: "2028-01",
      validFrom: "2028-01-01",
      validTo: "2029-01-01",
      status: "beschlossen",
      summary: "Hälftige Teilung von CO2-Kosten und Gasnetzentgelten.",
      params: {
        energyCarriers: ["gas", "oil", "lpg"],
        installedOnOrAfter: "2026-07-29",
        landlordPercentCo2: 50,
        landlordPercentGridFees: 50,
        landlordPercentBiogenicComponent: null,
        biogenicTiers: null,
      },
      sources: [src.gmodg],
      rechtPruefen: ["R-010"],
      changelog: "GModG: Ab 01.01.2028 hälftige Teilung von CO2-Kosten und Gasnetzentgelten bei neu eingebauten fossilen Heizungen.",
    },
    {
      version: "2029-01",
      validFrom: "2029-01-01",
      status: "beschlossen",
      summary: "Zusätzlich hälftige Teilung des Preisbestandteils für biogene Brennstoffe (Stufen 1–3).",
      params: {
        energyCarriers: ["gas", "oil", "lpg"],
        installedOnOrAfter: "2026-07-29",
        landlordPercentCo2: 50,
        landlordPercentGridFees: 50,
        landlordPercentBiogenicComponent: 50,
        biogenicTiers: [1, 2, 3],
      },
      sources: [src.gmodg],
      rechtPruefen: ["R-010"],
      changelog: "GModG: Ab 01.01.2029 zusätzlich hälftige Teilung des Bio-Treppen-Anteils.",
    },
  ],
});
