# Import-Assistent und Importvorlage

Der Import-Assistent (V20) bringt eine Verwaltung an einem Arbeitstag ins System. Er läuft in vier Schritten, und jeder Schritt lässt sich wiederholen.

1. **Hochladen und analysieren.** Erlaubt sind CSV (Trennzeichen `;`, `,` oder Tab, UTF-8 oder Windows-1252) und XLSX mit einem Tabellenblatt je Datenart. Das System erkennt die Datenart am Datei- oder Blattnamen, sonst an den Spalten, und schlägt für jede Spalte ein Feld vor.
2. **Zuordnung prüfen.** Datenart und Spalten lassen sich korrigieren. Nicht zugeordnete Spalten werden ignoriert.
3. **Prüfen (Probeimport).** Erst wird jede Zeile gelesen und geprüft: Formate, Pflichtfelder, Dubletten in der Datei, MEA-Summen. Danach läuft der echte Import gegen die Datenbank und wird anschließend vollständig zurückgerollt. Der Bericht nennt Tabelle, Zeile und Spalte jedes Fehlers sowie die Anzahl neuer, geänderter und unveränderter Datensätze.
4. **Übernehmen.** Das geht nur nach einem Probeimport ohne Fehler, und es gilt alles oder nichts. Im Audit-Log steht jede Änderung mit Benutzer und Herkunft `import`.

**Parallelbetrieb bis zum Stichtag:** Derselbe Import lässt sich beliebig oft wiederholen. Objekte werden über die Objektnummer gefunden, Gebäude über Objekt + Name, Einheiten über Objekt + Einheitennummer, Zähler über Art + Zählernummer. Personen werden über die **Personennummer** aus dem Altsystem gefunden; die Zuordnung steht in `external_keys` je Quelle (Feld „Quelle“ beim Upload, z. B. `altsystem-x`). Geändert wird nur, was sich unterscheidet.

## Vorlage

Die Vorlage gibt es unter `GET /v1/imports/template.xlsx` und in der Oberfläche unter „Import“. Beispieldaten liegen in `demo/import/`, als CSV-Dateien und als `demo-mandant.xlsx`.

| Tabelle | Pflichtspalten | Weitere Spalten |
| --- | --- | --- |
| Objekte | Objektnummer, Art (WEG/Miete/SEV), Name | Straße, Hausnummer, PLZ, Ort, Bundesland, MEA-Nenner, Stimmrecht, Abrechnungsbeginn (Monat) |
| Gebäude | Objektnummer, Gebäude | Straße, Hausnummer, PLZ, Ort, Baujahr, Nutzung |
| Einheiten | Objektnummer, Einheit, Typ | Gebäude, Etage, Lage, Wohnfläche, Nutzfläche, Heizfläche, MEA, Personen, Gültig ab, WEG-Objektnummer, WEG-Einheit (nur SEV) |
| Personen | Personennummer | Art, Anrede, Titel, Vorname, Nachname, Firma, Geburtsdatum, E-Mail, Telefon, Mobil, Anschrift, Land, Kommunikation, IBAN |
| Rollen | Personennummer, Rolle, Objektnummer | Einheit, Von, Bis, Anteil |
| Anlagen | Objektnummer, Art, Bezeichnung | Gebäude, Einbau, Energieträger, Letzte Prüfung, Großanlage |
| Zähler | Objektnummer, Art, Zählernummer | Einheit, Ort, Fernablesbar, Interoperabel, Eichung gültig bis, Eichjahr |

## Formate

| Art | Beispiele |
| --- | --- |
| Datum | `01.07.2024`, `1.7.24`, `2024-07-01`, Excel-Datumszelle |
| Zahl | `62,5`, `1.234,56`, `62.5`, `68,40 m²` (höchstens vier Nachkommastellen) |
| Ja/Nein | `ja`, `x`, `1`, `nein`, `0`, `-` |
| Auswahl | Deutsche Bezeichnungen und gängige Kürzel, z. B. `WMZ` für Wärmezähler, `TG` für Stellplatz, `Eigentümerin` |
| IBAN | mit oder ohne Leerzeichen; Prüfziffer wird geprüft |

**Rollen:** „Bis“ ist der erste Tag, an dem die Rolle nicht mehr gilt. Beispiel: Auszug am 31.07.2026 bedeutet `Bis = 01.08.2026`.

**Flächen und Anteile** gelten ab „Gültig ab“, ohne Angabe ab dem 01.01. des laufenden Jahres. Ändert ein späterer Import einen Wert, entsteht ein neuer bitemporaler Eintrag. Der alte Stand bleibt nachvollziehbar (ADR-0006).

## Noch nicht enthalten (Phase 1)

Offene Posten, Salden, Bankkonten und Bankumsatz-Historie gehören zum Ziel „produktiv an einem Arbeitstag“. Sie kommen mit der Buchhaltung (Phase 1) als weitere Tabellen in diese Vorlage. DATEV und Adapter für Altsysteme folgen in Phase 3.
