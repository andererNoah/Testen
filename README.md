# [PRODUKTNAME]

Mandantenfähige Plattform für professionelle Hausverwaltungen in Deutschland: Miet-, WEG- und Sondereigentumsverwaltung in einem System. Diese Codebasis setzt den Projekt-Prompt „Hausverwaltungsplattform“ (Stand 17.10.2026) um. **Aktueller Stand: Phase 0 „Fundament“**, siehe [Abnahme Phase 0](docs/phase-0-abnahme.md).

## Was es schon gibt

- **Mandanten, Rollen, Rechte:** Mandantentrennung und objektgenaue Rechte direkt in PostgreSQL (Row-Level-Security), zehn Rollenvorlagen
- **Audit-Log:** jede Änderung per Datenbank-Trigger, unveränderlich
- **Stammdaten:** Objekte (WEG, Miete, SEV), Gebäude, Einheiten, Flächen und Miteigentumsanteile **bitemporal**, Anlagen, Zähler, eigene Felder
- **Personen-CRM:** eine Person, viele Rollen; Dublettenprüfung (Kölner Phonetik, E-Mail, IBAN), Zusammenführen mit Historie
- **Regel-Engine:** 23 Rechtsregeln mit Gültigkeit, Status und Quelle, darunter BGB, WEG, HeizkostenV, CO2KostAufG, GModG, TrinkwV, AO und UStG. Mietrecht II ist als Entwurf vorbereitet.
- **Fristen-Engine:** §§ 187–193 BGB, Feiertage je Bundesland; Fristen für Betriebskostenabrechnung, Legionellen, Rauchwarnmelder, Fernablesung, Interoperabilität und Eichung
- **Import-Assistent:** CSV/XLSX, automatische Spaltenzuordnung, Validierungsbericht, Probeimport, idempotente Übernahme
- **Dokumente:** Versionen mit Prüfsumme, mehrere Akten je Dokument, Aufbewahrungsfristen, Löschsperre
- **Web-Oberfläche:** Startseite, Objekt-360°, Einheiten mit Historie, Personen, Fristen, Regeln, Audit-Log, Import, Befehlspalette (<kbd>Strg</kbd>+<kbd>K</kbd>), heller und dunkler Modus, WCAG 2.2 AA geprüft mit axe
- **API:** REST unter `/v1`, OpenAPI unter `/v1/openapi.json` und `/v1/docs`

## Schnellstart

Voraussetzungen: Node.js 22, pnpm 10, PostgreSQL 16 (Binärdateien lokal, z. B. `apt install postgresql-16`).

```bash
pnpm install
cp .env.example .env
pnpm db:start        # lokaler Cluster auf 127.0.0.1:54320, Rollen, Datenbank, Migrationen
pnpm db:seed         # Demo-Mandant „Hausverwaltung Muster GmbH“ mit acht Benutzern
pnpm dev:api         # API auf http://127.0.0.1:3000 (Doku: /v1/docs)
pnpm dev:web         # Oberfläche auf http://127.0.0.1:5173
```

Danach im Browser einen Demo-Benutzer wählen, zum Beispiel Anna Admin (alles), Olaf Objektbetreuer (WEG und SEV) oder Paul Richter (Mieter, sieht nur seine Wohnung).

## Prüfen

```bash
pnpm lint            # ESLint inkl. Modulgrenzen
pnpm typecheck       # TypeScript in allen Paketen
pnpm test            # Einheit + Datenbank (startet einen Wegwerf-Cluster)
pnpm test:e2e        # Playwright + axe gegen echte API und Demo-Mandant
pnpm licenses        # Lizenzverzeichnis docs/lizenzen.md
pnpm traceability    # Rückverfolgbarkeit V1–V32 → Code → Test
```

## Aufbau

```
packages/  core · money · rules (Regelkatalog) · deadlines · db (Migrationen)
modules/   access · masterdata · importer · documents
apps/      api (Fastify) · web (React + Vite)
demo/      Demo-Mandant als CSV und XLSX
docs/      Architektur, ADRs, Datenmodell, Rechtekonzept, Glossar, Anforderungen,
           RECHT-PRÜFEN-Liste, offene Fragen, Lizenzen
```

Wichtige Dokumente: [Architektur](docs/architektur.md) · [ADRs](docs/adr/README.md) · [Datenmodell](docs/datenmodell.md) · [Rechtekonzept](docs/rechtekonzept.md) · [Anforderungen](docs/anforderungen.md) · [RECHT-PRÜFEN](docs/recht-pruefen.md) · [Offene Fragen](docs/offene-fragen.md)

> Rechtsregeln vor dem Produktivbetrieb von Fachanwalt und Steuerberatung prüfen lassen (`docs/recht-pruefen.md`).
