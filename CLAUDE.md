# Arbeitsanweisungen für Agenten

Diese Codebasis setzt den Projekt-Prompt „Hausverwaltungsplattform“ um. Vor jeder Änderung: `docs/architektur.md`, `docs/anforderungen.md` und die ADRs in `docs/adr/` lesen.

## Regeln

- **Vertikale Scheiben:** Datenbank → Modul → API → Oberfläche → Test in einem Zug. Keine Schicht ohne Test.
- **Modulgrenzen:** Import nur über `@hv/<paket>`, nie über `src/`-Pfade (ESLint erzwingt das). `apps/web` importiert keine `@hv/*`-Pakete, sondern spricht nur über die API.
- **Geld:** ganze Cent (`@hv/money`), nie Gleitkommazahlen. Flächen und Anteile sind Dezimal-Strings.
- **Recht als Daten:** Fristen, Schlüssel, Kappungen und Stufen gehören in `packages/rules/catalog`, mit Gültigkeit, Status und Quelle. Nie fest im Code, auch nicht in der Oberfläche.
- **Unsicheres markieren:** Rechtsfragen als `RECHT-PRÜFEN R-xxx` im Katalog vermerken und in `docs/recht-pruefen.md` eintragen (ein Test prüft das).
- **Neue Tabellen:** `tenant_id`, Fremdschlüssel mit `tenant_id`, `ENABLE` + `FORCE ROW LEVEL SECURITY`, Policies für `hv_app`, `SELECT app.attach_audit('<tabelle>')`, Typen in `packages/db/src/schema.ts` und `columns.ts`. `packages/db/test/schema.test.ts` prüft RLS und Audit-Trigger.
- **Migrationen** sind unveränderlich, sobald sie in `main` sind. Änderungen gehören in eine neue Datei `NNNN_name.sql`.
- **Rechte:** jede Service-Funktion prüft `requirePermission(ctx.principal, …)` (Schicht 2); RLS ist Schicht 1 (`docs/rechtekonzept.md`).
- **Fehlermeldungen** sind deutsch und für Endnutzer verständlich (`@hv/core` Fehlerklassen, problem+json).
- **Sprache:** Code englisch, Fachbegriffe laut `docs/glossar.md`, Oberfläche und Doku deutsch.
- **API-Änderungen:** danach `pnpm --filter @hv/web gen:api` ausführen; die CI vergleicht Spezifikation und Typen.
- **Abhängigkeiten:** nur Lizenzen, die SaaS erlauben; `pnpm licenses` aktualisiert `docs/lizenzen.md`.
- **Rückverfolgbarkeit:** jede neue Anforderung oder Statusänderung in `docs/anforderungen.md` eintragen (`pnpm traceability`).
- **Demo-Mandant** (`demo/import/*.csv`) muss alle Kernfälle abdecken; nach Änderungen `pnpm demo:xlsx`.

## Befehle

```bash
pnpm db:start && pnpm db:seed   # lokale Datenbank mit Demo-Mandant
pnpm dev:api / pnpm dev:web
pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e
```

Tests starten selbst einen PostgreSQL-Wegwerf-Cluster (`packages/db/test-support`). In CI kommt die Datenbank über `TEST_DATABASE_ADMIN_URL`. Unter root läuft PostgreSQL automatisch als Benutzer `postgres`.

## Struktur je Fachmodul

`src/schemas.ts` (zod, auch für OpenAPI) · Service-Funktionen `(ctx: Ctx, …)` mit Rechteprüfung · `src/index.ts` als einziger Einstieg · `test/*.test.ts` mit eigener Datenbank je Datei (`createTestDatabase`) und Standard-Szenario (`seedScenario`).
