# Changelog

Rechtsänderungen erscheinen zusätzlich im Produkt unter „Regeln & Recht → Rechtsänderungen“ (V19).

## Unveröffentlicht

### Neu

- GitHub Codespaces: Entwicklungsumgebung mit Node.js 22, pnpm und PostgreSQL 16; richtet Datenbank und Demo-Mandant beim ersten Start ein und startet die App automatisch (`.devcontainer/`)
- `pnpm dev` startet API und Oberfläche zusammen

## 0.1.0 – Phase 0 „Fundament“ (18.10.2026)

### Neu

- Monorepo (TypeScript), Architektur, ADR-0001 bis 0011, Datenmodell, Rechtekonzept, Glossar, Rückverfolgbarkeitsmatrix
- PostgreSQL-Schema mit Row-Level-Security je Mandant und Objekt, Rollenvorlagen, unveränderliches Audit-Log, Zugriffsprotokoll für Personendaten
- Stammdaten mit bitemporalen Flächen und Anteilen, Anlagen, Zählern, eigenen Feldern, Vollständigkeitsampel, 360°-Objektansicht
- Personen-CRM mit Dublettenprüfung und Zusammenführen
- Regel-Engine mit 23 Rechtsregeln, Fristen-Engine nach §§ 187–193 BGB mit Feiertagen je Bundesland
- Import-Assistent (CSV/XLSX) mit Probeimport, idempotent für den Parallelbetrieb; Importvorlage
- Dokumentenablage mit Versionen, Prüfsummen, Akten und Aufbewahrungsfristen
- REST-API `/v1` mit OpenAPI, problem+json-Fehlern, Entwicklungs-Login
- Web-Oberfläche mit Designsystem (hell/dunkel), Befehlspalette, Import-Assistent
- Demo-Mandant „Hausverwaltung Muster GmbH“ (WEG, Mietshaus, SEV-Bestand, Gewerbe)
- CI: Lint, Typen, Tests mit PostgreSQL, Browser-Tests mit axe, Lizenz- und Schwachstellenprüfung
