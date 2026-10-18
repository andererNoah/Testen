# ADR-0005: Recht als versionierte Regeln im Katalog

Status: angenommen · 18.10.2026

## Kontext

Prinzip „Recht als versionierte Regel“: Fristen, Schlüssel, Kappungen und Stufenmodelle dürfen nicht fest im Code stehen. Rechtsänderungen sollen ohne Systemwechsel als datierte Updates kommen (V19). Kommende Regeln (GModG ab 2028, Mietrecht II) müssen vorbereitet, aber inaktiv sein.

## Entscheidung

- Eine Regel hat einen stabilen Schlüssel (z. B. `bgb.556.abrechnungsfrist`) und mehrere **Versionen**. Jede Version hat `validFrom`, optional `validTo` (exklusiv), `status`, typisierte `params`, mindestens eine `source` (Norm + URL) und optional `rechtPruefen` mit Verweis auf die Prüfliste.
- Status: `in_kraft`, `beschlossen` (verkündet, Geltung später), `entwurf` (z. B. Mietrecht II, nie automatisch angewendet), `deaktiviert`.
- Der Katalog liegt als TypeScript-Daten in `packages/rules/catalog` und wird mit zod validiert. Jede Regel hat ein Parameter-Schema; Fachcode erhält typisierte Parameter.
- `resolveRule(key, stichtag)` liefert genau eine anwendbare Version oder einen Fehler. Überlappende Gültigkeiten derselben Regel sind ein Katalogfehler (Test).
- Der Katalog wird zusätzlich in die Tabellen `legal_rules` / `legal_rule_versions` synchronisiert, damit Oberfläche und Berichte Regeln samt Quelle anzeigen können.

## Konsequenzen

- Ein Rechts-Update ist ein Commit im Katalog mit Datum, Quelle und Changelog-Eintrag (im Produkt sichtbar, V19).
- Ob Regeln später ohne Release (aus der Datenbank) aktualisiert werden, entscheiden wir in Phase 1; das Datenmodell lässt beides zu.
