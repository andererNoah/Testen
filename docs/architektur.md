# Architektur

Stand: 18.10.2026 · Phase 0 „Fundament“

[PRODUKTNAME] ist ein **modularer Monolith**: ein Deployment, eine Datenbank, aber harte Modulgrenzen. Alle Oberflächen sprechen ausschließlich über die versionierte HTTP-API. Fristen, Schlüssel, Kappungen und Stufenmodelle kommen aus der Regel-Engine, nie aus fest verdrahtetem Code.

## Schichten

```
┌────────────────────────────────────────────────────────────────────────┐
│ Oberflächen: Verwaltung (apps/web) · Portale (später) · Fremdsysteme   │
└───────────────────────────────┬────────────────────────────────────────┘
                                │ nur HTTP-API (REST, OpenAPI, /v1)
┌───────────────────────────────▼────────────────────────────────────────┐
│ API-Schicht (apps/api): Auth (OIDC/JWT), Mandanten-Kontext, Rechte,    │
│ Validierung (zod), Problem+JSON-Fehler, OpenAPI                        │
└───────────────────────────────┬────────────────────────────────────────┘
┌───────────────────────────────▼────────────────────────────────────────┐
│ Fachmodule (modules/*): access · masterdata · importer · documents     │
│ (Phase 1+: rental, accounting, banking, billing, weg, cases, …)       │
└───────────────────────────────┬────────────────────────────────────────┘
┌───────────────────────────────▼────────────────────────────────────────┐
│ Querschnitt (packages/*): core · money · rules (Regel-Engine) ·        │
│ deadlines (Fristen-Engine) · db (Migrationen, Mandanten-Transaktionen) │
└───────────────────────────────┬────────────────────────────────────────┘
┌───────────────────────────────▼────────────────────────────────────────┐
│ PostgreSQL 16: Row-Level-Security je Mandant und Objekt · Audit-Trigger│
│ (nur anhängend) · bitemporale Tabellen · Dateiablage (Adapter)         │
└────────────────────────────────────────────────────────────────────────┘
```

## Modulgrenzen

| Paket | Verantwortung | Darf importieren |
| --- | --- | --- |
| `packages/core` | Fachliche Fehlerklassen, Übersetzung von Datenbankfehlern | – |
| `packages/money` | Integer-Cent, zentrale Rundung, Verteilung | – |
| `packages/rules` | Versionierte Rechtsregeln mit Gültigkeit und Quelle | – |
| `packages/deadlines` | Fristberechnung (§§ 187–193 BGB), Feiertage, Ampel | `rules` |
| `packages/db` | Verbindung, Migrationen, Mandanten-Transaktion, Tabellentypen | – |
| `modules/access` | Rollen, Rechte, Objektbezug, Benutzer | `core`, `db` |
| `modules/masterdata` | Objekte, Gebäude, Einheiten, Flächen/Anteile, Personen, Anlagen, Zähler, eigene Felder | `db`, `access`, `money`, `rules`, `deadlines` |
| `modules/importer` | Import-Assistent (CSV/XLSX, Mapping, Validierung, Probeimport) | `db`, `access`, `masterdata`, `deadlines` |
| `modules/documents` | Dokumente, Versionen, Akten-Verknüpfung, Aufbewahrung, Speicher-Adapter | `db`, `access`, `masterdata` (Kontext), `rules` |
| `apps/api` | Komposition, HTTP, Auth | alle Module über deren `index.ts` |
| `apps/web` | Verwaltungsoberfläche | nur die API (kein Import von Modulen) |

Regeln:

1. Ein Modul importiert ein anderes nur über dessen öffentlichen Einstiegspunkt (`@hv/<modul>`), nie über interne Pfade. ESLint erzwingt das (`no-restricted-imports`).
2. Ein Modul schreibt nur in eigene Tabellen. Lesender Zugriff auf fremde Daten läuft über die öffentliche Funktion des Eigentümermoduls.
3. Module kommunizieren mit Seiteneffekten künftig über Domänenereignisse (Outbox-Tabelle, Phase 1). In Phase 0 gibt es nur direkte Aufrufe.

## Anfrage-Ablauf

1. Die API prüft das Bearer-Token (OIDC-kompatibel, ADR-0009) und ermittelt Mandant, Benutzer und Rollen.
2. Jede Anfrage läuft in **einer** Datenbank-Transaktion. Zu Beginn setzt `withTenant()` die Sitzungsvariablen `app.tenant_id`, `app.user_id` und `app.request_id` per `set_config(..., true)`.
3. Row-Level-Security filtert jede Abfrage auf den Mandanten **und** auf die Objekte, für die der Benutzer eine Rollenzuweisung hat. Die Anwendung prüft zusätzlich die fachliche Berechtigung (z. B. `stammdaten.schreiben`). Zwei unabhängige Schichten: ein Programmierfehler in der Anwendung legt keine fremden Daten offen.
4. Datenbank-Trigger schreiben jede Änderung mit Benutzer, Zeitpunkt, Alt- und Neuwert ins Audit-Log. Das Log kann die Anwendung nicht ändern oder löschen.

## Regel-Engine

Rechtsregeln liegen als versionierter Katalog im Repo (`packages/rules/catalog`). Jede Regelversion hat Gültigkeit (`validFrom`, `validTo`), Status (`in_kraft`, `beschlossen`, `entwurf`, `deaktiviert`), Parameter und Quellen. Abfragen lauten immer „Regel X zum Stichtag D“. Ein Regel-Update ist ein Katalog-Commit mit Datum und Quelle, ohne Codeänderung in den Fachmodulen. Details: ADR-0005.

## Fristen-Engine

Fristen entstehen aus Fachdaten plus Regel: z. B. Trinkwasseranlage + Regel `trinkwv.legionellen` → nächste Prüfung. Die Berechnung folgt §§ 187, 188 BGB. § 193 BGB (Wochenende/Feiertag) wird nur informativ ausgewiesen. Warnungen richten sich immer nach dem **unverschobenen** Datum, damit keine Frist durch eine zu großzügige Verschiebung verpasst wird (RECHT-PRÜFEN R-003).

## Betrieb (Phase 0)

Kein Hosting. Lokal laufen PostgreSQL (eigener Cluster unter `.data/pg`, gestartet mit `pnpm db:start`), API (`pnpm dev:api`) und Web (`pnpm dev:web`). CI läuft auf GitHub Actions mit Postgres-Service. Hosting in Deutschland und Zertifizierungsziel sind offene Entscheidungen (siehe `offene-fragen.md`).

## Schnittstelle zur Oberfläche

Die API beschreibt sich selbst als OpenAPI 3 (`/v1/openapi.json`, Oberfläche unter `/v1/docs`). Die Web-App erzeugt daraus ihre Typen (`pnpm --filter @hv/web gen:api`). Die CI prüft, dass Spezifikation und Typen zum Code passen, damit Oberfläche und API nicht auseinanderlaufen.

## Verweise

- Datenmodell: `datenmodell.md`
- Rechte: `rechtekonzept.md`
- Entscheidungen: `adr/`
- Anforderungen → Code → Test: `anforderungen.md`
- Import: `import-vorlage.md`
- Lizenzen: `lizenzen.md`
- Abnahme Phase 0: `phase-0-abnahme.md`
