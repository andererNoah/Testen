# Abnahme Phase 0 „Fundament“

Stand 18.10.2026. Gate „Datenbasis steht – Demo-Import fehlerfrei“: **erreicht**. Alle vier Abnahmekriterien sind durch automatische Tests belegt. Offen ist die fachliche Prüfung der Rechtsregeln (`recht-pruefen.md`).

## Abnahmekriterien

| Kriterium | Ergebnis | Beleg |
| --- | --- | --- |
| Demo-Mandant wird aus CSV/XLSX ohne Fehler importiert | erfüllt: 4 Objekte, 4 Gebäude, 22 Einheiten, 25 Personen, 32 Rollen, 10 Anlagen, 35 Zähler, 0 Fehler; zweiter Import ändert nichts | `modules/importer/test/import.test.ts` |
| Rechte greifen objektgenau (Test mit drei Rollen) | erfüllt: Admin, Objektbetreuer, Mieter und ein zweiter Mandant, lesend und schreibend, auf Datenbank- und Anwendungsebene | `modules/access/test/rls.test.ts` |
| Jede Änderung steht im Audit-Log | erfüllt: Trigger an allen Mandantentabellen (per Test erzwungen), unveränderlich auch für den Eigentümer | `modules/access/test/audit.test.ts`, `packages/db/test/schema.test.ts` |
| Regel-Engine liefert datierte Regeln mit Quellenverweis | erfüllt: 23 Regeln, Katalogprüfung auf Überlappung, Quellen, Schema und RECHT-PRÜFEN-Verweise | `packages/rules/test/rules.test.ts` |

Testumfang: 204 Einheits- und Datenbanktests, 10 Browser-Tests mit axe (WCAG 2.2 A/AA, keine schweren Befunde in hellem und dunklem Design).

## Demo

```bash
pnpm db:start && pnpm db:seed && pnpm dev:api & pnpm dev:web
```

Ablauf für die Vorführung:

1. Als **Anna Admin** anmelden. Die Startseite zeigt 4 Objekte, 22 Einheiten, 1 Leerstand und die Fristen-Ampel (1 dringend, 37 Vorwarnung).
2. **W001 WEG Lindenstraße 12**: Vollständigkeit 100 %, MEA-Summe 1.000/1000, Miteigentum 1/2 bei WE 03, Eigentümerwechsel WE 05 zum 01.07.2024, Gasheizung von 09/2026 (GModG ab 2028).
3. **Fristen**: Rauchwarnmelder Mietshaus dringend; Umrüstung nicht fernablesbarer Zähler bis 31.12.2026; jede Frist mit Norm und RECHT-PRÜFEN-Hinweis.
4. **Einheit** öffnen und rückwirkend eine Fläche korrigieren. Die Historie zeigt alten und neuen Wissensstand.
5. **Import**: `demo/import/demo-mandant.xlsx` hochladen und prüfen. Alles bleibt „unverändert“ (idempotent).
6. Als **Paul Richter** (Mieter) anmelden: Er sieht nur das Mietshaus und seine Wohnung WE 01, keine Fristen und kein Audit-Log.
7. <kbd>Strg</kbd>+<kbd>K</kbd>: „gohl“ tippen, dann <kbd>Enter</kbd> drücken. Das Mietshaus öffnet sich.

## Abgleich mit der Verbesserungsmatrix

14 Anforderungen sind umgesetzt, 38 teilweise und 26 geplant (über V1–V32, Module, Rechtskatalog und nicht-funktionale Anforderungen; Details in `anforderungen.md`). Vollständig für Phase 0: **V14** (eine Datenbasis), **V20** (Migrationsassistent für Stammdaten), **V29** (Dubletten). Begonnen: V1, V2, V6, V9, V10, V12, V18, V19, V21, V22, V24, V27, V28, V32.

## Abweichungen vom Plan

| Nr. | Abweichung | Grund / Folge | Nachholen in |
| --- | --- | --- | --- |
| AB-01 | Fastify statt NestJS, React+Vite statt Next.js | Begründet in ADR-0002 und ADR-0008 | – |
| AB-02 | Entwicklungs-Login statt OIDC (Magic Link, Passkey, MFA) | Hosting und Identitätsanbieter noch offen (F-01, F-10) | Phase 1 |
| AB-03 | Import ohne offene Posten, Salden, Bankkonten | Buchhaltung kommt in Phase 1; Ziel „produktiv an einem Tag“ erst dann messbar | Phase 1 |
| AB-04 | Dokumente ohne Objektspeicher (S3), Volltext- und semantische Suche, Signatur, Klassifizierung | Grundfunktion mit Dateisystem-Adapter reicht für Phase 0 | Phase 1–3 |
| AB-05 | Designsystem liegt in `apps/web`, noch kein eigenes Paket | Wird ausgelagert, sobald die Portale entstehen (ADR-0008) | Phase 1 |
| AB-06 | Keine Workflow-Engine (Temporal), keine Ereignis-Outbox | Erst nötig für Freigaben und Mahnläufe | Phase 1 |
| AB-07 | Fristen werden berechnet, nicht als erledigt markiert | Erledigt-Status hängt an Abrechnung und Vorgängen | Phase 1 |
| AB-08 | Hash-Kette im Audit-Log vorbereitet, nicht aktiv | Kommt mit dem GoBD-Journal | Phase 1 |
| AB-09 | Keine Last- und Sicherheitstests, keine Performance-Messung | Kein Hosting; Lasttests mit Buchhaltungsdaten aussagekräftiger | Phase 1 |
| AB-10 | Barrierefreiheit nur automatisch geprüft (axe) | Manueller Test mit Screenreader und Tastatur steht aus | vor Pilot |
| AB-11 | Dublettenprüfung nur innerhalb der sichtbaren Personen | Datenschutz: Objektbetreuer sehen keine fremden Personen | Entscheidung vor Pilot |
| AB-12 | Mietpreisbremse ohne Gebietsliste | Landesverordnungen müssen als Daten gepflegt werden | Phase 1 |
| AB-13 | Code-Splitting der Web-App fehlt (ein Bundle ~600 kB) | Für Phase 0 unkritisch | Phase 1 |

## Nächste Schritte (Phase 1 „Mietverwaltung MVP“)

1. Offene Fragen F-02 (Bank), F-07 (Golden Files), F-09 (Kontenrahmen), F-10 (OIDC) entscheiden.
2. Verträge, Nachträge, Sollstellung; Buchungsjournal (nur anhängend) mit Eigenschaftstest „stets ausgeglichen“.
3. Banking über CAMT-Import zuerst, dann FinTS/EBICS oder PSD2; Abgleich mit Lernregeln.
4. E-Rechnungseingang mit KoSIT-Validator; Freigabe-Workflow.
5. Betriebskostenabrechnung gegen ein fachlich geprüftes Golden File; formelle Prüfung blockiert den Versand.
6. Mieterportal und Vorgänge auf derselben Datenbasis.
