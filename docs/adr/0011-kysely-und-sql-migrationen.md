# ADR-0011: Kysely als Query-Builder, Migrationen in reinem SQL

Status: angenommen · 18.10.2026

## Entscheidung

- Datenzugriff mit **Kysely** (typsicherer SQL-Builder, MIT) auf `pg`. Kein ORM mit eigener Laufzeit-Magie.
- Migrationen sind nummerierte SQL-Dateien in `packages/db/migrations`, ausgeführt von einem eigenen kleinen Runner (Tabelle `schema_migrations`, Prüfsumme je Datei, keine Rückwärtsmigrationen).
- Tabellentypen für Kysely stehen handgeschrieben in `packages/db/src/schema.ts`. Ein Test vergleicht sie mit dem tatsächlichen Schema (Spaltennamen je Tabelle).

## Begründung

RLS-Policies, Trigger, Exclusion-Constraints und `SECURITY DEFINER`-Funktionen sind ohnehin SQL. Ein ORM-Schema könnte sie nicht ausdrücken; reines SQL bleibt lesbar und prüfbar.
