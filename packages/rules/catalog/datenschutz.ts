import { z } from "zod";
import { defineRule } from "../src/types";
import { src } from "./sources";

export const kiKennzeichnung = defineRule({
  key: "eu.kivo.art50.kennzeichnung",
  title: "Kennzeichnung von KI-Interaktionen",
  area: "datenschutz",
  description: "Portalnutzer müssen erkennen können, dass sie mit einem KI-System interagieren oder KI-generierte Inhalte erhalten.",
  paramsSchema: z.object({ labelRequired: z.boolean() }),
  versions: [
    {
      version: "2026-08",
      validFrom: "2026-08-02",
      status: "beschlossen",
      summary: "Kennzeichnungspflicht nach Art. 50 KI-VO; Geltungsbeginn vor Go-live prüfen.",
      params: { labelRequired: true },
      sources: [src.kiVo],
      rechtPruefen: ["R-018"],
    },
  ],
});
