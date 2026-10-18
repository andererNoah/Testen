import { z } from "zod";
import { defineRule } from "../src/types";
import { src } from "./sources";

export const anfechtungsfrist = defineRule({
  key: "weg.45.anfechtungsfrist",
  title: "Anfechtungs- und Begründungsfrist für Beschlüsse",
  area: "weg",
  description: "Die Anfechtungsklage muss innerhalb eines Monats nach Beschlussfassung erhoben und innerhalb zweier Monate begründet werden.",
  paramsSchema: z.object({ challengeMonths: z.number().int().positive(), justificationMonths: z.number().int().positive() }),
  versions: [
    {
      version: "2020-12",
      validFrom: "2020-12-01",
      status: "in_kraft",
      summary: "Klage 1 Monat, Begründung 2 Monate ab Beschlussfassung.",
      params: { challengeMonths: 1, justificationMonths: 2 },
      sources: [src.weg45],
      rechtPruefen: ["R-002"],
    },
  ],
});

export const einberufungsfrist = defineRule({
  key: "weg.24.einberufungsfrist",
  title: "Einberufungsfrist der Eigentümerversammlung",
  area: "weg",
  description: "Die Einberufung erfolgt in Textform mit einer Frist von mindestens drei Wochen, außer bei besonderer Dringlichkeit.",
  paramsSchema: z.object({ minWeeks: z.number().int().positive() }),
  versions: [
    {
      version: "2020-12",
      validFrom: "2020-12-01",
      status: "in_kraft",
      summary: "Mindestens drei Wochen, Textform.",
      params: { minWeeks: 3 },
      sources: [src.weg24],
      rechtPruefen: ["R-016"],
    },
  ],
});

export const virtuelleEtv = defineRule({
  key: "weg.23.virtuelle_etv",
  title: "Beschluss über virtuelle Eigentümerversammlungen",
  area: "weg",
  description:
    "Mit mindestens drei Vierteln der abgegebenen Stimmen kann beschlossen werden, dass Versammlungen für höchstens drei Jahre virtuell stattfinden. Bei Beschluss vor dem 01.01.2028 ist bis einschließlich 2028 jährlich eine Präsenzversammlung nötig, sofern nicht einstimmig verzichtet wird.",
  paramsSchema: z.object({
    requiredMajorityNumerator: z.number().int().positive(),
    requiredMajorityDenominator: z.number().int().positive(),
    maxDurationYears: z.number().int().positive(),
    transitionDecisionBefore: z.string(),
    annualPresenceMeetingThroughYear: z.number().int(),
  }),
  versions: [
    {
      version: "2024-10",
      validFrom: "2024-10-17",
      status: "in_kraft",
      summary: "3/4 der abgegebenen Stimmen, höchstens 3 Jahre; Übergangsregel bis 2028.",
      params: {
        requiredMajorityNumerator: 3,
        requiredMajorityDenominator: 4,
        maxDurationYears: 3,
        transitionDecisionBefore: "2028-01-01",
        annualPresenceMeetingThroughYear: 2028,
      },
      sources: [src.weg23, src.weg48],
      rechtPruefen: ["R-017"],
      changelog: "Virtuelle Eigentümerversammlung per Beschluss möglich (§ 23 Abs. 1a WEG).",
    },
  ],
});
