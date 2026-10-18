# ADR-0007: Audit-Log per Datenbank-Trigger, nur anhängend

Status: angenommen · 18.10.2026

## Entscheidung

- Ein generischer Trigger `audit.log_change()` hängt an jeder fachlichen Tabelle (INSERT, UPDATE, DELETE) und schreibt Mandant, Tabelle, Zeilen-ID, Aktion, Alt- und Neuwert (JSONB), geänderte Felder, Benutzer (`app.user_id`), Herkunft (`app.actor_kind`: Benutzer, System, Import), Anfrage-ID und Zeitstempel.
- `hv_app` hat auf `audit_log` nur `INSERT` (über den Trigger) und `SELECT`. Ein zusätzlicher Trigger verhindert `UPDATE` und `DELETE` auch für Eigentümer-Rollen außer bei expliziter Archivierung (Phase 3).
- Lesezugriffe auf personenbezogene Daten werden in der API protokolliert (`access_log`), weil Trigger keine SELECTs sehen.

## Begründung

Ein Trigger kann nicht vergessen werden: Auch Importe, Skripte und künftige Module erzeugen Einträge. Das erfüllt „jede Änderung steht im Audit-Log“ (Abnahmekriterium Phase 0) strukturell statt per Disziplin.

## Konsequenzen

- Ein Test prüft, dass jede Tabelle mit `tenant_id` (außer dem Log selbst) den Audit-Trigger hat.
- Manipulationsschutz per Hash-Kette ist vorbereitet (Spalte `entry_hash`), wird aber erst mit der Buchhaltung (Phase 1, GoBD) aktiviert.
