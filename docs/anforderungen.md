# Anforderungen → Code → Test

Rückverfolgbarkeit (Arbeitsweise). Jede Zeile nennt den Ort im Code und den Test. `pnpm traceability` prüft, dass V1–V32 vollständig sind und alle genannten Pfade existieren.

Status: **umgesetzt** (für den Umfang der genannten Phase fertig und getestet) · **teilweise** (Grundlage steht, Rest geplant) · **geplant** (noch kein Code).

## Abnahmekriterien Phase 0

| ID | Kriterium | Status | Umsetzung | Test |
| --- | --- | --- | --- | --- |
| A0-1 | Demo-Mandant wird aus CSV/XLSX ohne Fehler importiert | umgesetzt | `modules/importer/src/jobs.ts`, `demo/import/objekte.csv`, `demo/import/demo-mandant.xlsx` | `modules/importer/test/import.test.ts`, `apps/api/test/imports-and-seed.test.ts` |
| A0-2 | Rechte greifen objektgenau (Test mit drei Rollen) | umgesetzt | `packages/db/migrations/0003_security.sql`, `modules/access/src/principal.ts` | `modules/access/test/rls.test.ts` |
| A0-3 | Jede Änderung steht im Audit-Log | umgesetzt | `packages/db/migrations/0004_audit.sql` | `modules/access/test/audit.test.ts`, `packages/db/test/schema.test.ts` |
| A0-4 | Regel-Engine liefert datierte Regeln mit Quellenverweis | umgesetzt | `packages/rules/src/engine.ts`, `packages/rules/catalog/index.ts` | `packages/rules/test/rules.test.ts` |
| A0-5 | Durchgängig: WCAG 2.2 AA | teilweise | `apps/web/src/ui/styles.css`, `apps/web/src/ui/components.tsx` | `apps/web/e2e/app.spec.ts` |

## Verbesserungsmatrix V1–V32

| ID | Pflichtanforderung (kurz) | Phase | Status | Umsetzung | Test |
| --- | --- | --- | --- | --- | --- |
| V1 | Geführte Ersteinrichtung, Demo-Mandant, kontextuelle Hilfe, Expertenfunktionen bei Bedarf | 0–1 | teilweise | `apps/api/src/demo-seed.ts`, `apps/web/src/ui/components.tsx` (Help), `modules/masterdata/src/completeness.ts` | `apps/api/test/imports-and-seed.test.ts` |
| V2 | Modernes Designsystem, Klartext-Labels mit Tooltip, Dashboards mit Diagrammen | 0 | teilweise | `apps/web/src/ui/styles.css`, `apps/web/src/pages/DashboardPage.tsx`, `modules/masterdata/src/dashboard.ts` | `apps/web/e2e/app.spec.ts` |
| V3 | Alarm bei Zahlungsverzug, offene Posten mit einem Klick | 1 | geplant | – | – |
| V4 | Umlageschlüssel, Abrechnungskreis, § 35a beim Belegeingang | 1 | geplant | Regel `packages/rules/catalog/steuer.ts` | – |
| V5 | Eingangsadresse je Mandant/Objekt, E-Rechnung auslesen und vorkontieren | 1 | geplant | Regel `packages/rules/catalog/steuer.ts` | – |
| V6 | Messdienstleister-Schnittstellen, Funkzähler, Zähler-App | 2 | teilweise | Zählerinventar `modules/masterdata/src/assets.ts` | `modules/masterdata/test/masterdata.test.ts` |
| V7 | Öffentliche Preis- und Funktionsmatrix, Portal und Chat im Grundumfang | vor Pilot | geplant | – | – |
| V8 | Abrechnungsergebnis auf Seite 1, Positionen interaktiv erklärt | 1–2 | geplant | – | – |
| V9 | In-App-Support, Statusseite, Changelog | 1 | teilweise | Rechts-Changelog `apps/web/src/pages/RulesPage.tsx`, Vorgangsnummer in Fehlern `apps/api/src/plugins/errors.ts` | `apps/api/test/api.test.ts` |
| V10 | Schlank einrichtbar, Preis nach Einheiten, Privat-Modus auf derselben Codebasis | 0–3 | teilweise | Mandant mit Modulen `packages/db/migrations/0001_organisation.sql` | – |
| V11 | Regel-Editor für Benachrichtigungen | 1 | geplant | – | – |
| V12 | Magic Link, Passkey, Self-Service-Entsperrung, verständliche Fehlermeldungen | 1 | teilweise | `apps/api/src/plugins/errors.ts`, `apps/api/src/auth.ts`, Rate-Limit `apps/api/src/routes/dev.ts` | `apps/api/test/api.test.ts` |
| V13 | Zuständigkeit im Portal sichtbar | 1 | geplant | – | – |
| V14 | Portal, Buchhaltung, Vorgänge auf einer Datenbasis | 0 | umgesetzt | `docs/architektur.md`, `packages/db/migrations/0002_masterdata.sql` | `packages/db/test/schema.test.ts` |
| V15 | Preisänderungen mit 3 Monaten Vorlauf, Preisrechner | vor Pilot | geplant | – | – |
| V16 | FinTS, EBICS, PSD2, CAMT-Import, Verbindungs-Monitoring | 1 | geplant | – | – |
| V17 | Verrechnung nach §§ 366, 367 BGB, Rücklastschriften | 1 | geplant | Geld exakt `packages/money/src/index.ts` | `packages/money/test/money.test.ts` |
| V18 | Eigene Felder, Vorlagen, Workflow-Regeln, Ansichten, Berichte ohne Programmierung | 0–3 | teilweise | `modules/masterdata/src/custom-fields.ts`, `apps/web/src/pages/SettingsPage.tsx` | `modules/masterdata/test/masterdata.test.ts` |
| V19 | Öffentliche Roadmap, Rechtsänderungen als datierte Regel-Updates | 0 | teilweise | `packages/rules/catalog/index.ts`, `apps/api/src/routes/rules.ts` | `packages/rules/test/rules.test.ts` |
| V20 | Migrationsassistent: Feld-Mapping, Validierungsbericht, Probeimport, Parallelbetrieb | 0 | umgesetzt | `modules/importer/src/mapping.ts`, `modules/importer/src/execute.ts`, `apps/web/src/pages/ImportPage.tsx` | `modules/importer/test/import.test.ts`, `modules/importer/test/parsing.test.ts`, `apps/web/e2e/app.spec.ts` |
| V21 | Module jederzeit zuschaltbar ohne Datenumzug | 1 | teilweise | `packages/db/migrations/0001_organisation.sql` (tenants.modules) | – |
| V22 | Integriertes CRM, offene API, Webhooks, Export aus jeder Liste | 0–3 | teilweise | `modules/masterdata/src/persons.ts`, `apps/api/src/app.ts` (OpenAPI) | `apps/api/test/api.test.ts` |
| V23 | Vollständiger Export jederzeit in offenen Formaten | 1 | geplant | Dokumentiertes Schema `docs/datenmodell.md` | – |
| V24 | 360°-Akte je Objekt, Einheit, Person; Dokumente landen in der richtigen Akte | 0–1 | teilweise | `modules/masterdata/src/overview.ts`, `modules/documents/src/documents.ts`, `apps/web/src/pages/PropertyPage.tsx` | `modules/masterdata/test/masterdata.test.ts`, `modules/documents/test/documents.test.ts` |
| V25 | Ereignisgesteuerte Bewohnerinfo | 1–2 | geplant | – | – |
| V26 | KI nur mit Begründung und Quelle, menschliche Freigabe | 3 | geplant | Regel `packages/rules/catalog/datenschutz.ts` | – |
| V27 | Versionierte API, Abkündigung mit 6 Monaten Vorlauf | 0 | teilweise | `apps/api/src/app.ts` (/v1, OpenAPI), `apps/api/src/openapi-export.ts` | `apps/api/test/api.test.ts` |
| V28 | Jeder Bericht portfolioweit, filter- und planbar | 0–3 | teilweise | `modules/masterdata/src/dashboard.ts`, `modules/masterdata/src/deadlines.ts` | `apps/api/test/api.test.ts` |
| V29 | Dublettenerkennung bei Anlage und Import, Zusammenführen mit Historie | 0 | umgesetzt | `modules/masterdata/src/duplicates.ts`, `modules/masterdata/src/phonetics.ts`, `modules/masterdata/src/persons.ts` | `modules/masterdata/test/masterdata.test.ts`, `modules/masterdata/test/pure.test.ts` |
| V30 | Fortsetzbare Uploads großer Dateien, Kalender-Sync | 1–3 | geplant | – | – |
| V31 | Nachtragsassistent mit Vertragshistorie | 1 | geplant | – | – |
| V32 | Browser-Zurück überall, Deep-Links, Rückgängig | 0–1 | teilweise | `apps/web/src/main.tsx`, `apps/web/src/pages/PropertyPage.tsx` | `apps/web/e2e/app.spec.ts` |

## Fachmodule

| ID | Modul | Phase | Status | Umsetzung | Test |
| --- | --- | --- | --- | --- | --- |
| M01 | Stammdaten & Objektstruktur (Hierarchie, Flächen/Anteile bitemporal, Technik, Personen-CRM, Datenqualität, eigene Felder) | 0 | umgesetzt | `modules/masterdata/src/index.ts`, `modules/masterdata/src/measures.ts` | `modules/masterdata/test/masterdata.test.ts` |
| M02 | Mietverwaltung | 1 | geplant | – | – |
| M03 | WEG-Verwaltung & Eigentümerversammlung | 2 | geplant | Regeln `packages/rules/catalog/weg.ts` | `packages/rules/test/rules.test.ts` |
| M04 | Betriebs-, Heizkosten-, CO2-Abrechnung & UVI | 1–2 | teilweise | Regeln `packages/rules/catalog/heizkosten.ts`, Fristen `packages/deadlines/src/generators.ts` | `packages/deadlines/test/deadlines.test.ts` |
| M05 | Buchhaltung, Banking, E-Rechnung | 1 | geplant | `packages/money/src/index.ts` | `packages/money/test/money.test.ts` |
| M06 | Vorgänge, Instandhaltung, Prüfpflichten, Dienstleister | 1 | teilweise | Prüfpflicht-Fristen `modules/masterdata/src/deadlines.ts` | `modules/masterdata/test/masterdata.test.ts` |
| M07 | Kommunikation & Portale | 1 | geplant | – | – |
| M08 | Dokumente, Fristen, Reporting | 0 | teilweise | `modules/documents/src/documents.ts`, `modules/masterdata/src/deadlines.ts`, `modules/masterdata/src/dashboard.ts` | `modules/documents/test/documents.test.ts`, `apps/api/test/documents.test.ts` |
| M09 | KI-Assistenz mit Leitplanken | 3 | geplant | – | – |
| M10 | Migration, Onboarding, Modi, Integrationen & API | 0–3 | teilweise | `modules/importer/src/index.ts`, `apps/api/src/app.ts` | `modules/importer/test/import.test.ts` |

## Rechtlicher Pflichtenkatalog

| ID | Regelung | Status | Regel / Umsetzung | Test |
| --- | --- | --- | --- | --- |
| L01 | § 556 Abs. 3 BGB Abrechnungsfrist | teilweise (Frist umgesetzt, Abrechnung Phase 1) | `packages/rules/catalog/miete.ts`, `packages/deadlines/src/generators.ts` | `packages/deadlines/test/deadlines.test.ts` |
| L02 | § 556 Abs. 4 BGB elektronische Belegeinsicht | teilweise (Regel) | `packages/rules/catalog/miete.ts` | `packages/rules/test/rules.test.ts` |
| L03 | § 556a BGB Umlageschlüssel | teilweise (Regel) | `packages/rules/catalog/miete.ts` | `packages/rules/test/rules.test.ts` |
| L04 | HeizkostenV §§ 5, 6a: Fernablesbarkeit, UVI, Interoperabilität | teilweise (Fristen je Zähler) | `packages/rules/catalog/heizkosten.ts`, `packages/deadlines/src/generators.ts` | `packages/deadlines/test/deadlines.test.ts` |
| L05 | CO2KostAufG 10-Stufen-Modell | teilweise (Regel) | `packages/rules/catalog/heizkosten.ts` | `packages/rules/test/rules.test.ts` |
| L06 | Gebäudemodernisierungsgesetz ab 2028/2029 | teilweise (Regel, beschlossen) | `packages/rules/catalog/heizkosten.ts` | `packages/rules/test/rules.test.ts` |
| L07 | §§ 19, 28 WEG Rücklage, Wirtschaftsplan, Jahresabrechnung, Vermögensbericht | geplant | – | – |
| L08 | § 24 Abs. 7, 8 WEG Beschluss-Sammlung | geplant | – | – |
| L09 | § 23 Abs. 1a, § 48 Abs. 6 WEG virtuelle ETV | teilweise (Regel) | `packages/rules/catalog/weg.ts` | `packages/rules/test/rules.test.ts` |
| L10 | § 29 Abs. 2, § 45 WEG Beiratsprüfung, Anfechtungsfristen | teilweise (Regel, Fristberechnung) | `packages/rules/catalog/weg.ts`, `packages/deadlines/src/bgb.ts` | `packages/deadlines/test/deadlines.test.ts` |
| L11 | §§ 557b, 558, 559 BGB, Mietpreisbremse | teilweise (Regeln) | `packages/rules/catalog/miete.ts` | `packages/rules/test/rules.test.ts` |
| L12 | Mietrecht II (Entwurf) | teilweise (deaktivierte Entwurfsregeln) | `packages/rules/catalog/miete.ts` | `packages/rules/test/rules.test.ts` |
| L13 | E-Rechnung (UStG) | teilweise (Regel) | `packages/rules/catalog/steuer.ts` | `packages/rules/test/rules.test.ts` |
| L14 | GoBD, § 147 AO, BEG IV | teilweise (Aufbewahrung, Löschsperre, Audit) | `packages/rules/catalog/steuer.ts`, `modules/documents/src/documents.ts` | `modules/documents/test/documents.test.ts` |
| L15 | § 35a EStG | teilweise (Regel) | `packages/rules/catalog/steuer.ts` | `packages/rules/test/rules.test.ts` |
| L16 | TrinkwV § 31 Legionellenprüfung | umgesetzt (Frist) | `packages/rules/catalog/technik.ts`, `packages/deadlines/src/generators.ts` | `packages/deadlines/test/deadlines.test.ts` |
| L17 | Landesbauordnungen Rauchwarnmelder | umgesetzt (Frist, RECHT-PRÜFEN R-006) | `packages/rules/catalog/technik.ts` | `packages/deadlines/test/deadlines.test.ts` |
| L18 | DSGVO, BDSG | teilweise (Mandantentrennung, Zugriffsprotokoll; Löschkonzept Phase 1) | `packages/db/migrations/0004_audit.sql`, `modules/masterdata/src/persons.ts` | `modules/masterdata/test/masterdata.test.ts` |
| L19 | KI-Verordnung (EU) Kennzeichnung | teilweise (Regel) | `packages/rules/catalog/datenschutz.ts` | `packages/rules/test/rules.test.ts` |

## Nicht-funktionale Anforderungen

| ID | Bereich | Status | Umsetzung | Test |
| --- | --- | --- | --- | --- |
| N01 | Datenschutz: Hosting DE, AVV, Verzeichnis, Löschkonzept, Betroffenenauskunft | geplant (Hosting offen, F-01) | – | – |
| N02 | Sicherheit: Mandantentrennung per RLS, rollen- und objektbezogene Rechte, Audit-Log | umgesetzt | `packages/db/migrations/0003_security.sql`, `packages/db/migrations/0004_audit.sql` | `modules/access/test/rls.test.ts` |
| N03 | GoBD: unveränderbares Journal, Protokollierung | teilweise (Audit-Log unveränderlich; Journal Phase 1) | `packages/db/migrations/0004_audit.sql` | `modules/access/test/audit.test.ts` |
| N04 | Verfügbarkeit 99,9 %, Backups, RPO/RTO | geplant | – | – |
| N05 | Performance p95 < 300 ms, Abrechnung 500 Einheiten < 60 s | geplant (Lasttests Phase 1) | – | – |
| N06 | Bedienbarkeit: Befehlspalette, Tastatur, Deep-Links | teilweise | `apps/web/src/layout/CommandPalette.tsx` | `apps/web/e2e/app.spec.ts` |
| N07 | Barrierefreiheit WCAG 2.2 AA | teilweise (axe ohne schwere Befunde; manuelle Prüfung offen) | `apps/web/src/ui/components.tsx` | `apps/web/e2e/app.spec.ts` |
| N08 | Mobil und offline | geplant (PWA später, Entscheidung 18.10.2026) | – | – |
| N09 | Uploads: groß, fortsetzbar | teilweise (50 MB, Prüfsumme; fortsetzbar Phase 1) | `modules/documents/src/files.ts` | `modules/documents/test/documents.test.ts` |
| N10 | Rechtsregeln versioniert mit Changelog | umgesetzt | `packages/rules/src/engine.ts` | `packages/rules/test/rules.test.ts` |
| N11 | Lizenzverzeichnis, nur SaaS-taugliche Lizenzen | umgesetzt | `scripts/check-licenses.mjs`, `docs/lizenzen.md` | `scripts/check-licenses.mjs` |
| N12 | Geld exakt (Integer-Cent), Rundung zentral | umgesetzt | `packages/money/src/index.ts` | `packages/money/test/money.test.ts` |
