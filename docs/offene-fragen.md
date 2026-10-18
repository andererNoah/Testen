# Offene Fragen und Entscheidungen

Gesammelte Fragen an den Auftraggeber (Arbeitsweise: „Stelle offene Fragen gesammelt“). Entschiedenes bleibt mit Datum stehen.

## Entschieden

| Datum | Frage | Entscheidung |
| --- | --- | --- |
| 17.10.2026 | Zielgruppe zum Start | Profi-Version für gewerbliche Verwaltungen, Privat-Modus später |
| 18.10.2026 | Tech-Stack | Entscheidet das Entwicklungsteam: TypeScript, Fastify, PostgreSQL, React/Vite (ADR-0001 bis 0011) |
| 18.10.2026 | Hosting | Vorerst kein Hosting; lokale Entwicklung und CI |
| 18.10.2026 | Native Apps oder PWA | PWA, aber später; Phase 0 baut nur die Verwaltungsoberfläche |

## Offen

| Nr. | Frage | Annahme bis zur Entscheidung | Spätestens nötig |
| --- | --- | --- | --- |
| F-01 | Hosting-Anbieter in Deutschland, Zertifizierungsziel (ISO 27001, BSI C5) | Container-fähig, keine anbieterspezifischen Dienste | vor Pilot (Gate 2) |
| F-02 | Bankanbindung: eigener FinTS/EBICS-Stack oder PSD2-Dienstleister | Adapter-Schnittstelle, Datei-Import CAMT.053 zuerst | Beginn Phase 1 |
| F-03 | Heizkosten: eigene Abrechnung nach HeizkostenV oder nur Import vom Messdienstleister | Import zuerst, eigene Abrechnung vorbereitet | Beginn Phase 2 |
| F-04 | Preismodell | Preis je Einheit und Monat (V10) | vor Pilot |
| F-05 | Produktname statt „[PRODUKTNAME]“ | Platzhalter; Code nutzt das Kürzel `hv` | jederzeit |
| F-06 | Darf eine Person (z. B. Mieter) mit einem Login mehrere Verwaltungen sehen? | Nein, ein Login je Mandant | Beginn Portale (Phase 1) |
| F-07 | Wer prüft die Golden Files für Abrechnungen fachlich? | – | Beginn Phase 1 |
| F-08 | Welche Altsysteme sollen die ersten Migrationsadapter bedienen? | CSV/XLSX nach unserer Vorlage | Phase 3 |
| F-09 | Standard-Kontenrahmen für WEG und Miete (z. B. an DATEV SKR angelehnt) | – | Beginn Phase 1 |
| F-10 | OIDC-Anbieter: Keycloak selbst betreiben oder Dienst | Keycloak (ADR-0009) | Beginn Phase 1 |
