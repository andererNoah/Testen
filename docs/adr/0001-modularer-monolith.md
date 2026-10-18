# ADR-0001: Modularer Monolith als pnpm-Monorepo in TypeScript

Status: angenommen · 18.10.2026

## Kontext

Der Prompt verlangt einen modularen Monolithen mit harten Modulgrenzen. Ein kleines Team (bzw. ein KI-Agent) baut acht Fachmodule, die sich eine Datenbasis teilen (Prinzip „Eine Datenbasis“, V14). Microservices würden Transaktionen über Modulgrenzen (z. B. Sollstellung + Buchung) unnötig verteilen.

## Entscheidung

- Ein pnpm-Workspace mit drei Ebenen: `packages/*` (fachfreie Bausteine), `modules/*` (Fachmodule), `apps/*` (API, Web).
- Durchgängig TypeScript (Node.js 22 LTS, TypeScript 6.0, `strict`). Dieselbe Sprache in Backend und Frontend; API-Schemas (zod) sind in beiden nutzbar.
- Pakete werden als TypeScript-Quelltext konsumiert (kein Build-Schritt je Paket). Die API läuft in Entwicklung mit `tsx`, für den Betrieb wird sie gebündelt.
- Modulgrenzen: Import nur über `@hv/<paket>`, ESLint verbietet tiefe Importe.

## Konsequenzen

- Ein Deployment, eine Datenbank, echte ACID-Transaktionen über Module.
- Ein Modul lässt sich später herauslösen, weil es nur über seine öffentliche Schnittstelle erreicht wird.
- Disziplin bei Tabellen-Eigentum nötig: Ein Modul schreibt nur eigene Tabellen (Review-Regel, in Phase 1 per Test geprüft).
