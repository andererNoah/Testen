# Fachglossar Deutsch → Code

Verbindliche Übersetzung (ADR-0010). Neue Begriffe zuerst hier eintragen.

| Deutsch | Code | Hinweis |
| --- | --- | --- |
| Mandant (die Verwaltung) | `tenant` | Achtung: Mieter heißt **nicht** `tenant`, sondern Rolle `mieter` |
| Verwaltungsobjekt | `property` | WEG, Mietobjekt oder SEV-Bestand |
| WEG (Wohnungseigentümergemeinschaft) | `kind = 'weg'` | |
| Mietverwaltung / Mietobjekt | `kind = 'rental'` | |
| Sondereigentumsverwaltung (SEV) | `kind = 'sev'` | |
| Gebäude | `building` | |
| Einheit | `unit` | Wohnung, Gewerbe, Stellplatz, Garage, Nebenfläche |
| Wohnung | `type = 'apartment'` | |
| Gewerbeeinheit | `type = 'commercial'` | |
| Stellplatz | `type = 'parking'` | |
| Garage | `type = 'garage'` | |
| Nebenfläche (Keller, Lager) | `type = 'ancillary'` | |
| Wohnfläche (WoFlV) | `living_area` | m² |
| Nutzfläche | `usable_area` | m² |
| Heizfläche | `heated_area` | m² |
| Miteigentumsanteil (MEA) | `mea` | Zähler; Nenner am Objekt (`mea_denominator`) |
| Personenzahl | `persons` | |
| Stimmrechtsprinzip Kopf/Wert/Objekt | `voting_principle = head / value / object` | |
| Anlage (technisch) | `technical_asset` | |
| Zähler | `meter` | |
| Heizkostenverteiler | `meter.kind = 'hcd'` | |
| fernablesbar | `remote_readable` | HeizkostenV § 5 |
| Person | `person` | natürliche oder juristische |
| Eigentümer | Rolle `eigentuemer` | |
| Mieter | Rolle `mieter` | |
| Beirat | Rolle `beirat` | |
| Dienstleister/Handwerker | Rolle `dienstleister` | |
| Bürge | Rolle `buerge` | |
| Bevollmächtigter | Rolle `bevollmaechtigter` | |
| Rollenzuweisung | `role_assignment` | Rolle + Bereich |
| Bereich | `scope` | `tenant`, `property`, `unit` |
| Regel (Rechtsregel) | `legal_rule` | |
| Stichtag | `asOf` / `effectiveDate` | |
| Frist | `deadline` | |
| Ampel | `traffic light` → `status: 'green' / 'yellow' / 'red'` | |
| Akte | `file` → Verknüpfung `document_link` | Dokument kann in mehreren Akten liegen |
| Eigene Felder | `custom_fields` | V18 |
| Probeimport | `dry run` | |
| Validierungsbericht | `validation report` | |
| Sollstellung | `charge` | Phase 1 |
| Offener Posten | `open item` | Phase 1 |
| Betriebskostenabrechnung | `operating cost statement` | Phase 1 |
| Hausgeld | `house money` → `hausgeld` | Phase 2, deutscher Begriff bleibt |
| Erhaltungsrücklage | `maintenance reserve` | Phase 2 |
| Beschluss-Sammlung | `resolution register` | Phase 2 |
| Eigentümerversammlung (ETV) | `owners meeting` | Phase 2 |
| Unterjährige Verbrauchsinformation (UVI) | `uvi` | Phase 2 |
