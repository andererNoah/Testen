# ADR-0004: Geldbeträge als Integer-Cent, zentrale Rundung

Status: angenommen · 18.10.2026

## Entscheidung

- Beträge sind ganze Cent (`number`, geprüft mit `Number.isSafeInteger`, also bis ca. 90 Billionen Euro). In der Datenbank: `bigint`.
- Rechnen mit Anteilen (Fläche, MEA, Verbrauch) geschieht mit `decimal.js` auf Dezimalzahlen; das Ergebnis wird **einmal** zentral gerundet (`roundToCents`, Standard: kaufmännisch, halbe Cent weg von null).
- Verteilungen (Umlage auf Einheiten) nutzen das Verfahren des größten Rests: Die Summe der verteilten Cent ist immer exakt der Gesamtbetrag. Eigenschaftstests (fast-check) belegen das.
- Gleitkommazahlen für Geld sind verboten (Lint-Regel und Review).

## Konsequenzen

- API liefert Beträge als ganze Cent plus Währung (`{ "cents": 12345, "currency": "EUR" }`); die Oberfläche formatiert.
- Rundungsdifferenzen werden nie stillschweigend verteilt, sondern deterministisch (größter Rest, bei Gleichstand stabile Reihenfolge).
