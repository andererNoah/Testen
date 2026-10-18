# Rechtekonzept

Rechte ergeben sich aus **Rolle × Bereich**. Eine Rollenzuweisung verbindet Benutzer, Rolle und Bereich (`tenant` = ganzer Mandant, `property` = ein Verwaltungsobjekt, `unit` = eine Einheit) mit einer Gültigkeit. Rollen sind je Mandant anpassbar; die Vorlagen unten werden bei Anlage eines Mandanten erzeugt.

## Zwei unabhängige Schichten

1. **Datenbank (RLS):** Welche Zeilen sieht der Benutzer überhaupt? Mandant muss passen, und für objektgebundene Daten braucht der Benutzer eine Zuweisung auf Mandant, Objekt oder Einheit. Ohne gesetzten Kontext sieht niemand etwas.
2. **Anwendung:** Darf der Benutzer diese Aktion auf diesem Objekt ausführen? Geprüft wird die Berechtigung (z. B. `masterdata.write`) im Bereich des Objekts.

Ein Fehler in Schicht 2 kann keine Daten anderer Mandanten oder nicht zugewiesener Objekte offenlegen, weil Schicht 1 unabhängig filtert.

## Sichtbarkeit in der Datenbank

| Datenart | Sichtbar bei Zuweisung auf … |
| --- | --- |
| Objekt, Gebäude, Anlagen | Mandant · dieses Objekt · eine Einheit darin |
| Einheit, Flächen, Zähler der Einheit | Mandant · Objekt der Einheit · genau diese Einheit |
| Personenrolle | Mandant · Objekt (nur Bereich Mandant/Objekt) · eigene Person |
| Person | Mandant · Person hat Rolle in einem Objekt, auf das der Benutzer Bereich Mandant/Objekt hat · eigene Person |
| Dokumente | wie die verknüpfte Akte (Phase 0: Objekt) |
| Audit-Log | Mandant (Berechtigung `audit.read`) |

## Berechtigungen (Phase 0)

| Schlüssel | Bedeutung |
| --- | --- |
| `tenant.admin` | Benutzer, Rollen, Module, eigene Felder verwalten |
| `masterdata.read` | Objekte, Gebäude, Einheiten, Flächen, Anlagen lesen |
| `masterdata.write` | … anlegen und ändern |
| `persons.read` | Personen und Personenrollen lesen |
| `persons.write` | … anlegen, ändern, zusammenführen |
| `import.run` | Import-Assistent ausführen |
| `audit.read` | Audit-Log lesen |
| `rules.read` | Regelkatalog lesen |
| `deadlines.read` | Fristen lesen |
| `documents.read` / `documents.write` | Dokumente lesen / ablegen |
| `export.run` | Exporte (Phase 1: Vollexport V23) |

Phase 1 ergänzt `finance.read`, `finance.book`, `payments.approve`, `invoices.approve`, `cases.*`.

## Rollenvorlagen

| Rolle | Typischer Bereich | Berechtigungen (Phase 0) |
| --- | --- | --- |
| Mandanten-Admin (`tenant_admin`) | Mandant | alle |
| Objektbetreuer (`property_manager`) | Objekt | `masterdata.*`, `persons.*`, `documents.*`, `rules.read`, `deadlines.read` |
| Buchhaltung (`accountant`) | Objekt | `masterdata.read`, `persons.read`, `documents.read`, `rules.read`, `deadlines.read` (+ Finanzen in Phase 1) |
| Freigeber (`approver`) | Mandant/Objekt | `masterdata.read`, `rules.read` (+ Freigaben in Phase 1) |
| Techniker/Hausmeister (`technician`) | Objekt | `masterdata.read`, `documents.read`, `deadlines.read` |
| Beirat (`advisory_board`) | Objekt (eigene WEG) | `masterdata.read`, `documents.read` |
| Eigentümer (`owner`) | Einheit | `masterdata.read`, `documents.read` |
| Mieter (`renter`) | Einheit | `masterdata.read`, `documents.read` |
| Dienstleister (`contractor`) | Objekt (künftig: Auftrag) | `masterdata.read` |
| Steuerberatung (`tax_advisor`) | Objekt | `masterdata.read`, `persons.read`, `export.run` |

## Protokollierung

- Jede Änderung: Audit-Trigger (ADR-0007).
- Jeder Lesezugriff auf Personendaten über die API: `access_log` (Benutzer, Person, Zeitpunkt, Endpunkt).

## Abnahmetest Phase 0

`modules/access/test/rls.test.ts` prüft mit drei Rollen (Mandanten-Admin, Objektbetreuer für Objekt A, Mieter einer Einheit in Objekt A) und einem zweiten Mandanten, dass jede Rolle genau die erlaubten Zeilen sieht und schreiben darf.
