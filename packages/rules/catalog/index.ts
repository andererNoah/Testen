import { anfechtungsfrist, einberufungsfrist, virtuelleEtv } from "./weg";
import { co2Stufen, fernablesbarkeit, gmodgTeilung, uvi } from "./heizkosten";
import { eichfristen, legionellen, rauchwarnmelder } from "./technik";
import { aufbewahrung, eRechnung, haushaltsnah } from "./steuer";
import { kiKennzeichnung } from "./datenschutz";
import {
  abrechnungsfrist,
  belegeinsicht,
  kappungsgrenze,
  mietpreisbremse,
  mietrecht2Indexkappung,
  mietrecht2Kurzzeit,
  mietrecht2Moeblierung,
  mietrecht2Schonfrist,
  umlageschluessel,
} from "./miete";

/** The legal rule catalog. Every entry key must equal the rule's `key`. */
export const catalog = {
  "bgb.556.abrechnungsfrist": abrechnungsfrist,
  "bgb.556.belegeinsicht": belegeinsicht,
  "bgb.556a.umlageschluessel": umlageschluessel,
  "bgb.558.kappungsgrenze": kappungsgrenze,
  "bgb.556d.mietpreisbremse": mietpreisbremse,
  "mietrecht2.indexkappung": mietrecht2Indexkappung,
  "mietrecht2.moeblierungszuschlag": mietrecht2Moeblierung,
  "mietrecht2.kurzzeitmiete": mietrecht2Kurzzeit,
  "mietrecht2.schonfrist": mietrecht2Schonfrist,
  "weg.45.anfechtungsfrist": anfechtungsfrist,
  "weg.24.einberufungsfrist": einberufungsfrist,
  "weg.23.virtuelle_etv": virtuelleEtv,
  "heizkv.5.fernablesbarkeit": fernablesbarkeit,
  "heizkv.6a.uvi": uvi,
  "co2kostaufg.aufteilung": co2Stufen,
  "gmodg.neue_fossile_heizung": gmodgTeilung,
  "trinkwv.31.legionellen": legionellen,
  "lbo.rauchwarnmelder": rauchwarnmelder,
  "messev.eichfristen": eichfristen,
  "ao.147.aufbewahrung": aufbewahrung,
  "ustg.erechnung": eRechnung,
  "estg.35a.haushaltsnah": haushaltsnah,
  "eu.kivo.art50.kennzeichnung": kiKennzeichnung,
};

export type Catalog = typeof catalog;
export type RuleKey = keyof Catalog;
