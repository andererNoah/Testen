# ADR-0003: PostgreSQL mit Row-Level-Security für Mandanten- und Objekttrennung

Status: angenommen · 18.10.2026

## Kontext

Mandantentrennung auf Datenbankebene ist Abnahmekriterium. Zusätzlich verlangt Phase 0: „Rechte greifen objektgenau (Test mit drei Rollen)“.

## Entscheidung

- PostgreSQL 16. Jede Mandantentabelle hat `tenant_id` und `ENABLE` + `FORCE ROW LEVEL SECURITY`.
- Zwei Datenbankrollen: `hv_owner` (besitzt die Tabellen, führt Migrationen aus) und `hv_app` (Anwendung, `NOBYPASSRLS`, kein Eigentümer). Die Anwendung verbindet sich nur als `hv_app`.
- Der Kontext wird je Transaktion über `set_config('app.tenant_id', …, true)` und `app.user_id` gesetzt. Ohne Kontext liefert jede Abfrage null Zeilen (fail closed).
- Objektbezug: Policies auf objektgebundenen Tabellen (Objekte, Gebäude, Einheiten, Flächen, Anlagen, Zähler, Personenrollen, Dokumente) rufen `app.can_access_property(property_id)` auf. Die Funktion prüft die Rollenzuweisungen des Benutzers (Bereich Mandant, Objekt oder Einheit).
- Die Anwendung prüft zusätzlich fachliche Rechte (Lesen, Schreiben, Import usw.). RLS ist die zweite, unabhängige Schicht.

## Konsequenzen

- Jede Anfrage braucht eine Transaktion (`withTenant`). Verbindungs-Pooling bleibt möglich, weil `set_config(..., true)` nur transaktionslokal gilt.
- Neue Tabellen müssen RLS bekommen; ein Test prüft, dass jede Tabelle mit `tenant_id` RLS aktiviert hat.
- Hilfsfunktionen für RLS sind `SECURITY DEFINER` mit festem `search_path`, damit sie Rollenzuweisungen lesen können, ohne Rekursion durch Policies.
