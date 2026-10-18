import { z } from "zod";
import { defineRule } from "../src/types";
import { src } from "./sources";

const retention = z.object({ bookingVouchersYears: z.number().int(), booksYears: z.number().int(), businessLettersYears: z.number().int() });

export const aufbewahrung = defineRule({
  key: "ao.147.aufbewahrung",
  title: "Aufbewahrungsfristen",
  area: "steuer",
  description: "Aufbewahrungsfristen für Buchungsbelege, Bücher und Abschlüsse sowie Handels- und Geschäftsbriefe.",
  paramsSchema: retention,
  versions: [
    {
      version: "vor-beg-iv",
      validFrom: "2000-01-01",
      validTo: "2025-01-01",
      status: "in_kraft",
      summary: "Belege und Bücher 10 Jahre, Briefe 6 Jahre (frühere Rechtslage nicht weiter modelliert).",
      params: { bookingVouchersYears: 10, booksYears: 10, businessLettersYears: 6 },
      sources: [src.ao147],
      rechtPruefen: ["R-014"],
    },
    {
      version: "beg-iv",
      validFrom: "2025-01-01",
      status: "in_kraft",
      summary: "Buchungsbelege 8 Jahre (BEG IV), Bücher und Abschlüsse 10 Jahre, Briefe 6 Jahre.",
      params: { bookingVouchersYears: 8, booksYears: 10, businessLettersYears: 6 },
      sources: [src.ao147],
      rechtPruefen: ["R-014"],
      changelog: "BEG IV: Aufbewahrungsfrist für Buchungsbelege von 10 auf 8 Jahre verkürzt.",
    },
  ],
});

export const eRechnung = defineRule({
  key: "ustg.erechnung",
  title: "E-Rechnung: Empfang und Ausstellung",
  area: "steuer",
  description:
    "Seit 01.01.2025 müssen alle Unternehmer (auch Vermieter und WEG) E-Rechnungen empfangen können. Für die Ausstellung gelten Übergangsfristen bis Ende 2026 bzw. 2027.",
  paramsSchema: z.object({
    receiveRequired: z.boolean(),
    formats: z.array(z.string()),
    otherFormatsAllowedUntil: z.string(),
    smallBusinessOtherFormatsAllowedUntil: z.string(),
    smallBusinessPriorYearRevenueLimitCents: z.number().int().positive(),
  }),
  versions: [
    {
      version: "2025-01",
      validFrom: "2025-01-01",
      status: "in_kraft",
      summary: "Empfangspflicht; Ausstellung in anderen Formaten bis 31.12.2026, bei Vorjahresumsatz bis 800.000 € bis 31.12.2027.",
      params: {
        receiveRequired: true,
        formats: ["XRechnung", "ZUGFeRD >= 2.0.1"],
        otherFormatsAllowedUntil: "2026-12-31",
        smallBusinessOtherFormatsAllowedUntil: "2027-12-31",
        smallBusinessPriorYearRevenueLimitCents: 80_000_000,
      },
      sources: [src.ustg14, src.ustg27],
      rechtPruefen: ["R-015"],
      changelog: "E-Rechnung: Empfangspflicht für alle Unternehmer seit 01.01.2025.",
    },
  ],
});

export const haushaltsnah = defineRule({
  key: "estg.35a.haushaltsnah",
  title: "Steuerermäßigung für haushaltsnahe Dienstleistungen und Handwerkerleistungen",
  area: "steuer",
  description: "Ausweis der begünstigten Arbeitskosten je Einheit in der Abrechnung, damit Nutzer die Ermäßigung nach § 35a EStG geltend machen können.",
  paramsSchema: z.object({
    householdServicesPercent: z.number(),
    householdServicesMaxCents: z.number().int(),
    craftsmenPercent: z.number(),
    craftsmenMaxCents: z.number().int(),
    laborCostsOnly: z.boolean(),
  }),
  versions: [
    {
      version: "2009-01",
      validFrom: "2009-01-01",
      status: "in_kraft",
      summary: "20 % der Arbeitskosten, höchstens 4.000 € (Dienstleistungen) bzw. 1.200 € (Handwerker).",
      params: { householdServicesPercent: 20, householdServicesMaxCents: 400_000, craftsmenPercent: 20, craftsmenMaxCents: 120_000, laborCostsOnly: true },
      sources: [src.estg35a],
    },
  ],
});
