# RECHT-PRÜFEN: Liste für Fachanwalt und Steuerberatung

Rechtsfragen, die im Code als `RECHT-PRÜFEN R-xxx` markiert sind. Vor dem Produktivbetrieb muss jeder Punkt geprüft und mit Datum abgezeichnet werden. Die Regeln selbst stehen in `packages/rules/catalog`.

| Nr. | Thema | Annahme im System | Wo im Code | Prüfen durch | Status |
| --- | --- | --- | --- | --- | --- |
| R-001 | § 556 Abs. 3 BGB: Ende der Abrechnungsfrist | Frist endet mit Ablauf des 12. Monats nach Ende des Abrechnungszeitraums; Zugang beim Mieter maßgeblich; **keine** Verschiebung nach § 193 BGB für Warnungen | `packages/rules/catalog/bgb.ts`, `packages/deadlines/src/generators.ts` | Fachanwalt Mietrecht | offen |
| R-002 | § 45 WEG: Anfechtungs- und Begründungsfrist | 1 bzw. 2 Monate ab Beschlussfassung, Berechnung nach §§ 187 Abs. 1, 188 Abs. 2, 3 BGB | `packages/rules/catalog/weg.ts` | Fachanwalt WEG-Recht | offen |
| R-003 | § 193 BGB allgemein | Verschiebung auf den nächsten Werktag wird nur **informativ** angezeigt; Ampel und Warnung nutzen das unverschobene Datum | `packages/deadlines/src/bgb.ts` | Fachanwalt | offen |
| R-004 | Feiertage | Bundesweite und landesweite Feiertage; regionale Feiertage (Fronleichnam in Teilen von SN/TH, Mariä Himmelfahrt in Teilen von BY, Augsburger Friedensfest) fehlen | `packages/deadlines/src/holidays.ts` | Fachanwalt | offen |
| R-005 | TrinkwV § 31: Legionellenprüfung | Pflicht bei Großanlage zur Trinkwassererwärmung + Duschen/Vernebelung + gewerblicher Tätigkeit (Vermietung); Intervall 3 Jahre ab letzter Prüfung | `packages/rules/catalog/technik.ts` | Fachanwalt / Sachverständiger | offen |
| R-006 | Rauchwarnmelder (Landesbauordnungen) | Wartung alle 12 Monate in allen Bundesländern; Zuständigkeit (Eigentümer/Besitzer) je Land noch nicht abgebildet | `packages/rules/catalog/technik.ts` | Fachanwalt | offen |
| R-007 | HeizkostenV § 5 Abs. 2: Fernablesbarkeit | Nicht fernablesbare Geräte müssen bis 31.12.2026 nachgerüstet oder ersetzt sein; Ausnahmen (technische Unmöglichkeit, Unverhältnismäßigkeit) nicht abgebildet | `packages/rules/catalog/heizkosten.ts` | Fachanwalt | offen |
| R-008 | HeizkostenV § 5 Abs. 3: Interoperabilität | Frist 31.12.2031 | `packages/rules/catalog/heizkosten.ts` | Fachanwalt | offen |
| R-009 | CO2KostAufG: 10-Stufen-Modell | Stufengrenzen in kg CO2/m²/Jahr: < 12, 12–< 17, … , ≥ 52; Vermieteranteil 0 % bis 95 %; Nichtwohngebäude 50:50; gemischt genutzte Gebäude noch offen | `packages/rules/catalog/heizkosten.ts` | Fachanwalt / Steuerberatung | offen |
| R-010 | Gebäudemodernisierungsgesetz (GModG) | Inhalte und Stichtage (hälftige Teilung ab 01.01.2028 bzw. 01.01.2029, Inkrafttreten 29.07.2026) aus dem Projekt-Prompt übernommen, **nicht unabhängig verifiziert**; ab welchem Einbaudatum „neu eingebaut“ gilt, ist offen | `packages/rules/catalog/heizkosten.ts` | Fachanwalt | offen |
| R-011 | Mietpreisbremse | Gilt bis 31.12.2029; Gebietsliste je Bundesland als pflegbare Tabelle noch leer | `packages/rules/catalog/bgb.ts` | Fachanwalt Mietrecht | offen |
| R-012 | § 558 Abs. 3 BGB Kappungsgrenze | 20 % in 3 Jahren, 15 % in Gebieten mit Verordnung | `packages/rules/catalog/bgb.ts` | Fachanwalt Mietrecht | offen |
| R-013 | Mietrecht II (BT-Drs. 21/6807) | Nur Entwurf: Regeln mit Status `entwurf`, nie automatisch angewendet | `packages/rules/catalog/bgb.ts` | Fachanwalt Mietrecht | offen |
| R-014 | § 147 AO / BEG IV: Aufbewahrung | Buchungsbelege 8 Jahre (für zum 01.01.2025 nicht abgelaufene Fristen), Bücher/Abschlüsse 10 Jahre, Handels- und Geschäftsbriefe 6 Jahre; Ablaufhemmung (§ 147 Abs. 3 S. 3 AO) als manueller Sperrvermerk | `packages/rules/catalog/steuer.ts` | Steuerberatung | offen |
| R-015 | E-Rechnung: Ausstellung | Übergang: bis 31.12.2026 andere Formate mit Zustimmung; bis 31.12.2027 bei Vorjahresumsatz ≤ 800.000 €; Unternehmereigenschaft der WEG | `packages/rules/catalog/steuer.ts` | Steuerberatung | offen |
| R-016 | § 24 Abs. 4 WEG: Einberufungsfrist | Mindestens 3 Wochen, Textform; Zugang maßgeblich; Fristberechnung ab Zugang | `packages/rules/catalog/weg.ts` | Fachanwalt WEG-Recht | offen |
| R-017 | § 23 Abs. 1a, § 48 Abs. 6 WEG: virtuelle ETV | Beschluss gilt höchstens 3 Jahre ab Beschlussfassung; bei Beschluss vor 01.01.2028 jährliche Präsenzversammlung bis einschließlich 2028, sofern nicht einstimmig verzichtet | `packages/rules/catalog/weg.ts` | Fachanwalt WEG-Recht | offen |
| R-018 | KI-Verordnung (EU) Art. 50 | Kennzeichnungspflicht; Geltungsbeginn vor Go-live prüfen (möglicher Aufschub durch EU-Änderungspaket) | `packages/rules/catalog/datenschutz.ts` | Fachanwalt IT-Recht | offen |
| R-019 | MessEG/MessEV: Eichfristen | Wärmezähler 5 Jahre, Warmwasserzähler 5 Jahre, Kaltwasserzähler 6 Jahre, Heizkostenverteiler nicht eichpflichtig | `packages/rules/catalog/technik.ts` | Sachverständiger | offen |
| R-020 | DSGVO: Dublettenprüfung | Phonetischer Schlüssel und Vergleich von Geburtsdatum/E-Mail/IBAN ist von Art. 6 Abs. 1 lit. b/f DSGVO gedeckt | `modules/masterdata/src/duplicates.ts` | Datenschutz | offen |
