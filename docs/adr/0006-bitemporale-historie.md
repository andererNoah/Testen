# ADR-0006: Bitemporale Historie für Flächen, Anteile und Rollen

Status: angenommen · 18.10.2026

## Kontext

Abrechnungen müssen rückwirkend korrekt bleiben. Beispiel: Die Wohnfläche wird 2026 korrigiert, gilt aber ab 2024. Die Abrechnung 2024 soll man mit „damaligem Wissen“ reproduzieren und mit „heutigem Wissen“ neu rechnen können.

## Entscheidung

- Bitemporale Tabellen haben zwei Achsen: **Gültigkeit** (`valid_from` inklusiv, `valid_to` exklusiv, Datum) und **Erfassung** (`recorded_at`, `superseded_at`, Zeitstempel).
- Eine Änderung überschreibt nie. Sie setzt `superseded_at` auf den betroffenen Zeilen und legt neue Zeilen an (auch für die nicht betroffenen Teilzeiträume).
- Ein Exclusion-Constraint (`btree_gist`) verhindert überlappende Gültigkeiten unter den aktuellen Zeilen.
- Abfrage `asOf(validDate, knownAt?)`: ohne `knownAt` gilt der aktuelle Wissensstand.
- Phase 0: `unit_measures` (Flächen, MEA, Personenzahl). Rollen am Objekt (`person_roles`) haben nur die Gültigkeitsachse; die Erfassungsachse liefert das Audit-Log.

## Konsequenzen

- Schreiben ist etwas aufwendiger (gekapselt in `recordMeasure()` mit Tests).
- Zeiträume sind halboffen `[von, bis)`. Die Oberfläche zeigt „bis einschließlich“ als `valid_to - 1 Tag`.
