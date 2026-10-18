import { z } from "zod";
import { defineRule } from "../src/types";
import { src } from "./sources";

export const legionellen = defineRule({
  key: "trinkwv.31.legionellen",
  title: "Untersuchung auf Legionellen",
  area: "technik",
  description:
    "Bei Großanlagen zur Trinkwassererwärmung mit Duschen oder Vernebelung im Rahmen gewerblicher Tätigkeit (z. B. Vermietung) ist mindestens alle drei Jahre auf Legionellen zu untersuchen.",
  paramsSchema: z.object({
    intervalYears: z.number().int().positive(),
    warnMonthsBefore: z.number().int().nonnegative(),
    requiresLargeSystem: z.boolean(),
    requiresShowersOrAerosol: z.boolean(),
    requiresCommercialActivity: z.boolean(),
  }),
  versions: [
    {
      version: "2023-06",
      validFrom: "2023-06-24",
      status: "in_kraft",
      summary: "Mindestens alle 3 Jahre bei Großanlage, Duschen und gewerblicher Tätigkeit.",
      params: { intervalYears: 3, warnMonthsBefore: 3, requiresLargeSystem: true, requiresShowersOrAerosol: true, requiresCommercialActivity: true },
      sources: [src.trinkwv31],
      rechtPruefen: ["R-005"],
    },
  ],
});

export const rauchwarnmelder = defineRule({
  key: "lbo.rauchwarnmelder",
  title: "Wartung von Rauchwarnmeldern",
  area: "technik",
  description: "Rauchwarnmelder sind nach Landesrecht vorgeschrieben und jährlich auf Betriebsbereitschaft zu prüfen.",
  paramsSchema: z.object({
    maintenanceIntervalMonths: z.number().int().positive(),
    warnMonthsBefore: z.number().int().nonnegative(),
    states: z.array(z.string().length(2)),
  }),
  versions: [
    {
      version: "2021-01",
      validFrom: "2021-01-01",
      status: "in_kraft",
      summary: "Pflicht in allen 16 Bundesländern; Wartung alle 12 Monate.",
      params: {
        maintenanceIntervalMonths: 12,
        warnMonthsBefore: 2,
        states: ["BW", "BY", "BE", "BB", "HB", "HH", "HE", "MV", "NI", "NW", "RP", "SL", "SN", "ST", "SH", "TH"],
      },
      sources: [src.lbo],
      rechtPruefen: ["R-006"],
    },
  ],
});

export const eichfristen = defineRule({
  key: "messev.eichfristen",
  title: "Eichfristen für Zähler",
  area: "technik",
  description: "Geeichte Zähler dürfen nur bis zum Ablauf der Eichfrist verwendet werden. Heizkostenverteiler sind nicht eichpflichtig.",
  paramsSchema: z.object({
    yearsByMeterKind: z.object({
      heat: z.number().int().positive(),
      hot_water: z.number().int().positive(),
      cold_water: z.number().int().positive(),
      gas: z.number().int().positive(),
      electricity: z.number().int().positive(),
    }),
    warnMonthsBefore: z.number().int().nonnegative(),
  }),
  versions: [
    {
      version: "2015-01",
      validFrom: "2015-01-01",
      status: "in_kraft",
      summary: "Wärme- und Warmwasserzähler 5 Jahre, Kaltwasser 6 Jahre, Gas (Balgen) und elektronische Stromzähler 8 Jahre.",
      params: { yearsByMeterKind: { heat: 5, hot_water: 5, cold_water: 6, gas: 8, electricity: 8 }, warnMonthsBefore: 6 },
      sources: [src.messev],
      rechtPruefen: ["R-019"],
    },
  ],
});
