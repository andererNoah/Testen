# ADR-0010: Englische Bezeichner im Code, Fachglossar, deutsche Oberfläche

Status: angenommen · 18.10.2026

## Entscheidung

- Bezeichner, Tabellen, API-Pfade und Kommentare sind englisch. Fachbegriffe werden einheitlich übersetzt; die verbindliche Zuordnung steht in `docs/glossar.md` (z. B. Verwaltungsobjekt = `property`, Einheit = `unit`, Miteigentumsanteil = `coOwnershipShare`/`mea`).
- Rechtsbegriffe ohne gute Übersetzung behalten den deutschen Begriff als Wert (z. B. Rollen `eigentuemer`, `mieter`, `beirat`; Regelschlüssel `bgb.556.abrechnungsfrist`), damit Fachleute sie wiedererkennen.
- Oberfläche, Fehlermeldungen und Dokumentation sind deutsch; die Oberfläche ist für Englisch vorbereitet (i18n).

## Konsequenzen

- Neue Fachbegriffe kommen zuerst ins Glossar, dann in den Code.
